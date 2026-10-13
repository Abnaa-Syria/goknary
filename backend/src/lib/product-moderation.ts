import { ProductStatus } from '@prisma/client';
import { prisma } from './prisma';
import { ConflictError, NotFoundError, ValidationError } from './errors';
import { NotificationType, notifyVendor } from './notify';
import { PUBLIC_PRODUCT_STATUSES } from './visibility';

/**
 * Business names map onto the existing enum: "pending review" is PENDING, "published" is ACTIVE or
 * APPROVED (both are public). Once a product is published, vendor edits keep it published.
 */
export const isLiveStatus = (status: ProductStatus | string) => PUBLIC_PRODUCT_STATUSES.includes(status as ProductStatus);

export const VENDOR_SUBMITTABLE_STATUSES: ProductStatus[] = ['DRAFT', 'REJECTED'];

export const REJECTION_REASON_MIN = 3;
export const REJECTION_REASON_MAX = 1000;

export const submissionData = (now = new Date()) => ({
  status: 'PENDING' as ProductStatus,
  submittedAt: now,
  rejectionReason: null,
  reviewedAt: null,
  reviewedBy: null,
});

/** Vendors only choose between saving a draft and sending for review; older clients sent ACTIVE. */
export const resolveVendorCreateStatus = (requested?: string | null): ProductStatus =>
  requested === 'DRAFT' || requested === 'INACTIVE' || requested === 'REJECTED' ? 'DRAFT' : 'PENDING';

export type VendorStatusChange =
  | { kind: 'keep' }
  | { kind: 'set'; status: ProductStatus }
  | { kind: 'submit' }
  | { kind: 'error'; message: string };

/**
 * Status changes a vendor may make through the product update endpoint. A vendor can never reach a
 * public status on their own: anything unpublished that asks to go live is sent to review instead.
 */
export const resolveVendorStatusChange = (current: ProductStatus, requested?: string | null): VendorStatusChange => {
  if (!requested || requested === current) return { kind: 'keep' };
  const wantsLive = isLiveStatus(requested) || requested === 'PENDING';

  switch (current) {
    case 'ACTIVE':
    case 'APPROVED':
      if (isLiveStatus(requested)) return { kind: 'keep' };
      if (requested === 'INACTIVE' || requested === 'DRAFT') return { kind: 'set', status: requested };
      return { kind: 'error', message: 'Published products can only be hidden or kept visible' };
    case 'INACTIVE':
    case 'DRAFT':
      if (wantsLive) return { kind: 'submit' };
      if (requested === 'INACTIVE' || requested === 'DRAFT') return { kind: 'set', status: requested };
      return { kind: 'error', message: 'Invalid product status' };
    case 'PENDING':
      if (wantsLive) return { kind: 'keep' };
      if (requested === 'DRAFT') return { kind: 'set', status: 'DRAFT' };
      return { kind: 'error', message: 'This product is waiting for review' };
    case 'REJECTED':
      // Edits keep the product rejected (and its reason visible) until it is resubmitted.
      return wantsLive ? { kind: 'submit' } : { kind: 'keep' };
    default:
      return { kind: 'error', message: 'Invalid product status' };
  }
};

export type AdminStatusChange = 'noop' | 'approve' | 'reject' | 'operational' | 'invalid';

/**
 * Admin status changes: moderation decisions only from PENDING, and operational hide/show only for
 * products that already passed review. Drafts and rejected products must go through submission.
 */
export const classifyAdminStatusChange = (current: ProductStatus, requested: ProductStatus): AdminStatusChange => {
  if (requested === current) return 'noop';
  if (current === 'PENDING') {
    if (isLiveStatus(requested)) return 'approve';
    if (requested === 'REJECTED') return 'reject';
    return 'invalid';
  }
  if (isLiveStatus(current)) return requested === 'INACTIVE' || isLiveStatus(requested) ? 'operational' : 'invalid';
  if (current === 'INACTIVE') return isLiveStatus(requested) ? 'operational' : 'invalid';
  return 'invalid';
};

export const ADMIN_TRANSITION_ERROR =
  'This status change is not allowed. Drafts and rejected products must be submitted by the vendor, and pending products are approved or rejected from the review queue.';

const productLabel = (product: { name: string; nameAr: string | null }) => ({
  en: product.name,
  ar: product.nameAr || product.name,
});

/** PENDING → live. The conditional update makes a repeated or concurrent decision fail instead of re-notifying. */
export const approvePendingProduct = async (productId: string, reviewerId: string, target: ProductStatus = 'APPROVED') => {
  if (!isLiveStatus(target)) throw new ValidationError('Approval must publish the product');
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');
  if (product.status !== 'PENDING') {
    throw new ConflictError(isLiveStatus(product.status) ? 'Product is already approved' : `Only pending products can be approved (current: ${product.status})`);
  }

  const { count } = await prisma.product.updateMany({
    where: { id: productId, status: 'PENDING' },
    data: { status: target, rejectionReason: null, reviewedAt: new Date(), reviewedBy: reviewerId },
  });
  if (count === 0) throw new ConflictError('Product was already reviewed');

  const label = productLabel(product);
  await notifyVendor(product.vendorId, {
    type: NotificationType.PRODUCT_APPROVED,
    title: 'Product approved',
    titleAr: 'تمت الموافقة على المنتج',
    message: `"${label.en}" is now live on the marketplace.`,
    messageAr: `المنتج "${label.ar}" أصبح ظاهراً في المتجر.`,
    link: `/vendor/products/${product.id}/edit`,
    entityType: 'PRODUCT',
    entityId: product.id,
  });

  return prisma.product.findUniqueOrThrow({ where: { id: productId } });
};

export const normalizeRejectionReason = (reason: unknown) => {
  const value = typeof reason === 'string' ? reason.trim() : '';
  if (value.length < REJECTION_REASON_MIN) throw new ValidationError('A rejection reason is required');
  if (value.length > REJECTION_REASON_MAX) {
    throw new ValidationError(`Rejection reason must be at most ${REJECTION_REASON_MAX} characters`);
  }
  return value;
};

/** PENDING → REJECTED with a stored reason the vendor sees on the product. */
export const rejectPendingProduct = async (productId: string, reviewerId: string, rawReason: unknown) => {
  const reason = normalizeRejectionReason(rawReason);
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');
  if (product.status !== 'PENDING') {
    throw new ConflictError(product.status === 'REJECTED' ? 'Product is already rejected' : `Only pending products can be rejected (current: ${product.status})`);
  }

  const { count } = await prisma.product.updateMany({
    where: { id: productId, status: 'PENDING' },
    data: { status: 'REJECTED', rejectionReason: reason, reviewedAt: new Date(), reviewedBy: reviewerId },
  });
  if (count === 0) throw new ConflictError('Product was already reviewed');

  const label = productLabel(product);
  await notifyVendor(product.vendorId, {
    type: NotificationType.PRODUCT_REJECTED,
    title: 'Product rejected',
    titleAr: 'تم رفض المنتج',
    message: `"${label.en}" was not approved. Reason: ${reason}`,
    messageAr: `لم تتم الموافقة على المنتج "${label.ar}". السبب: ${reason}`,
    link: `/vendor/products/${product.id}/edit`,
    entityType: 'PRODUCT',
    entityId: product.id,
  });

  return prisma.product.findUniqueOrThrow({ where: { id: productId } });
};
