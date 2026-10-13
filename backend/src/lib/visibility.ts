import { Prisma, ProductStatus, VendorStatus } from '@prisma/client';

/** Same rule as the public product listing: published product of an approved vendor. */
export const PUBLIC_VENDOR_STATUS: VendorStatus = 'APPROVED';
export const PUBLIC_PRODUCT_STATUSES: ProductStatus[] = ['ACTIVE', 'APPROVED'];

export const publicProductWhere = (extra: Prisma.ProductWhereInput = {}): Prisma.ProductWhereInput => ({
  ...extra,
  status: { in: PUBLIC_PRODUCT_STATUSES },
  vendor: { status: PUBLIC_VENDOR_STATUS },
});

type InternalProductField =
  | 'rankingScore'
  | 'rankingUpdatedAt'
  | 'lowStockThreshold'
  | 'rejectionReason'
  | 'submittedAt'
  | 'reviewedAt'
  | 'reviewedBy'
  | 'status';

/** Customer product responses must not expose moderation, staff, ranking, or stock-policy fields. */
export const toPublicProduct = <T extends object>(product: T): Omit<T, InternalProductField> => {
  const {
    rankingScore: _rankingScore,
    rankingUpdatedAt: _rankingUpdatedAt,
    lowStockThreshold: _lowStockThreshold,
    rejectionReason: _rejectionReason,
    submittedAt: _submittedAt,
    reviewedAt: _reviewedAt,
    reviewedBy: _reviewedBy,
    status: _status,
    ...rest
  } = product as T & {
    rankingScore?: unknown;
    rankingUpdatedAt?: unknown;
    lowStockThreshold?: unknown;
    rejectionReason?: unknown;
    submittedAt?: unknown;
    reviewedAt?: unknown;
    reviewedBy?: unknown;
    status?: unknown;
  };
  return rest;
};
