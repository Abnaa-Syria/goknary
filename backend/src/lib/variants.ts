import { OrderStatus, Prisma, ProductVariant } from '@prisma/client';
import { ValidationError } from './errors';

type Tx = Prisma.TransactionClient;

export interface VariantAttribute {
  name: string;
  nameAr?: string;
  value: string;
  valueAr?: string;
}

/**
 * Normalizes stored variant attributes to the array shape the vendor UI writes:
 * `[{ name, nameAr?, value, valueAr? }]`. Also accepts a plain object map
 * (`{ "Color": "Black" }`). Malformed legacy data yields an empty list instead of throwing.
 */
export const parseVariantAttributes = (raw: unknown): VariantAttribute[] => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (Array.isArray(value)) {
    return value
      .filter((a) => a && typeof a === 'object' && a.name != null && a.value != null)
      .map((a) => ({
        name: String(a.name),
        value: String(a.value),
        ...(a.nameAr ? { nameAr: String(a.nameAr) } : {}),
        ...(a.valueAr ? { valueAr: String(a.valueAr) } : {}),
      }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .map(([name, v]) => ({ name, value: String(v) }));
  }

  return [];
};

export const attributesToMap = (attributes: VariantAttribute[]): Record<string, string> =>
  Object.fromEntries(attributes.map((a) => [a.name, a.value]));

export const formatVariantForResponse = <T extends { attributes: unknown }>(variant: T) => ({
  ...variant,
  attributes: parseVariantAttributes(variant.attributes),
});

/** Same pricing rule products already use: the discount price wins when set. */
export const getUnitPrice = (source: { price: number; discountPrice: number | null }) =>
  source.discountPrice || source.price;

/** Purchase-time snapshot stored in `OrderItem.variantInfo`; order history must not depend on the live variant. */
export const buildVariantSnapshot = (variant: ProductVariant): string => {
  const attributeList = parseVariantAttributes(variant.attributes);
  return JSON.stringify({
    variantId: variant.id,
    sku: variant.sku,
    name: variant.name,
    nameAr: variant.nameAr,
    attributes: attributesToMap(attributeList),
    attributeList,
    image: variant.image,
    imageAlt: variant.imageAlt,
    imageAltAr: variant.imageAltAr,
    price: variant.price,
    discountPrice: variant.discountPrice,
  });
};

export type VariantResolution =
  | { ok: true; variant: ProductVariant | null }
  | { ok: false; code: 'VARIANT_REQUIRED' | 'VARIANT_NOT_FOUND' | 'VARIANT_INACTIVE'; message: string };

/**
 * Decides which variant (if any) a cart/order line refers to.
 * For products without variants any supplied variantId is ignored so legacy clients keep working.
 */
export const resolveVariant = async (
  db: Tx,
  product: { id: string; name: string; hasVariants: boolean },
  variantId: string | null | undefined
): Promise<VariantResolution> => {
  if (!product.hasVariants) return { ok: true, variant: null };

  if (!variantId) {
    // Legacy rows flagged hasVariants without any variant records stay purchasable as plain products.
    const variantCount = await db.productVariant.count({ where: { productId: product.id } });
    if (variantCount === 0) return { ok: true, variant: null };
    return {
      ok: false,
      code: 'VARIANT_REQUIRED',
      message: `Please select an option for "${product.name}".`,
    };
  }

  const variant = await db.productVariant.findFirst({ where: { id: variantId, productId: product.id } });
  if (!variant) {
    return {
      ok: false,
      code: 'VARIANT_NOT_FOUND',
      message: `The selected option does not belong to "${product.name}".`,
    };
  }
  if (!variant.status) {
    return {
      ok: false,
      code: 'VARIANT_INACTIVE',
      message: `The selected option for "${product.name}" is no longer available.`,
    };
  }

  return { ok: true, variant };
};

/**
 * Keeps `Product.stock` as a cache of the active variants' total so listing,
 * search and dashboards (which read Product.stock) stay meaningful.
 * Products without any variants are left untouched.
 */
export const syncProductStockFromVariants = async (db: Tx, productId: string) => {
  const [total, active] = await Promise.all([
    db.productVariant.count({ where: { productId } }),
    db.productVariant.aggregate({ where: { productId, status: true }, _sum: { stock: true } }),
  ]);
  if (total === 0) return;

  await db.product.update({
    where: { id: productId },
    data: { stock: active._sum.stock ?? 0 },
  });
};

/**
 * Invariant: a product with active variants has exactly one default, and it is active.
 * An explicit default is kept; otherwise the oldest active variant (createdAt, then id) is promoted.
 * Inactive variants never stay default. Call after every variant create, update or delete.
 */
export const ensureDefaultVariant = async (db: Tx, productId: string) => {
  await db.productVariant.updateMany({
    where: { productId, status: false, isDefault: true },
    data: { isDefault: false },
  });

  const active = await db.productVariant.findMany({
    where: { productId, status: true },
    select: { id: true, isDefault: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  if (active.length === 0) return;

  const keep = active.find((v) => v.isDefault) ?? active[0];
  await db.productVariant.updateMany({
    where: { productId, isDefault: true, id: { not: keep.id } },
    data: { isDefault: false },
  });
  if (!keep.isDefault) {
    await db.productVariant.update({ where: { id: keep.id }, data: { isDefault: true } });
  }
};

/**
 * The single sync point after any variant create, update, delete or discount change.
 * Enforces the default invariant, then derives the product's catalog summary from its variants:
 * - stock = total stock of active variants;
 * - price / discountPrice mirror the active default variant (display only; cart and checkout
 *   always price the selected variant), and product-level discountType/discountValue are cleared;
 * - with no active variant, stock becomes 0 and the last price is kept, since there is nothing to
 *   mirror. The product is not purchasable: a variant is required and none is active.
 * Products with no variant rows at all are left untouched.
 */
export const syncProductFromVariants = async (db: Tx, productId: string) => {
  await ensureDefaultVariant(db, productId);

  const variants = await db.productVariant.findMany({
    where: { productId },
    select: { price: true, discountPrice: true, stock: true, status: true, isDefault: true },
  });
  if (variants.length === 0) return;

  const active = variants.filter((v) => v.status);
  const defaultVariant = active.find((v) => v.isDefault);

  await db.product.update({
    where: { id: productId },
    data: {
      hasVariants: true,
      stock: active.reduce((sum, v) => sum + v.stock, 0),
      ...(defaultVariant && {
        price: defaultVariant.price,
        discountPrice: defaultVariant.discountPrice ?? null,
        discountType: null,
        discountValue: null,
      }),
    },
  });
};

interface StockLine {
  productId: string;
  variantId?: string | null;
  quantity: number;
  label: string;
}

/**
 * Atomically decrements stock only if enough is available (single conditional UPDATE),
 * so concurrent checkouts cannot drive stock negative.
 */
export const reserveStock = async (tx: Tx, line: StockLine) => {
  if (line.variantId) {
    const { count } = await tx.productVariant.updateMany({
      where: { id: line.variantId, productId: line.productId, status: true, stock: { gte: line.quantity } },
      data: { stock: { decrement: line.quantity } },
    });
    if (count === 0) {
      const current = await tx.productVariant.findUnique({ where: { id: line.variantId }, select: { stock: true } });
      throw new ValidationError(`Insufficient stock for "${line.label}". Only ${current?.stock ?? 0} left.`);
    }
    await syncProductStockFromVariants(tx, line.productId);
    return;
  }

  const { count } = await tx.product.updateMany({
    where: { id: line.productId, stock: { gte: line.quantity } },
    data: { stock: { decrement: line.quantity } },
  });
  if (count === 0) {
    const current = await tx.product.findUnique({ where: { id: line.productId }, select: { stock: true } });
    throw new ValidationError(`Insufficient stock for "${line.label}". Only ${current?.stock ?? 0} left.`);
  }
};

/** Returns stock to the variant that was sold, or to the product for non-variant (and legacy) lines. */
export const restoreStock = async (
  tx: Tx,
  line: { productId: string; variantId?: string | null; quantity: number }
) => {
  if (line.variantId) {
    const { count } = await tx.productVariant.updateMany({
      where: { id: line.variantId, productId: line.productId },
      data: { stock: { increment: line.quantity } },
    });
    if (count > 0) {
      await syncProductStockFromVariants(tx, line.productId);
      return;
    }
  }

  await tx.product.update({
    where: { id: line.productId },
    data: { stock: { increment: line.quantity } },
  });
};

/**
 * Moves an order to CANCELLED only if it is still in one of `fromStatuses` (a conditional UPDATE),
 * and restores its stock only when this call performed the transition. Concurrent cancellations
 * or payment-failure webhooks therefore restore stock exactly once.
 */
export const cancelOrderWithStockRestore = async (
  tx: Tx,
  orderId: string,
  fromStatuses: OrderStatus[]
): Promise<boolean> => {
  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: { in: fromStatuses } },
    data: { status: 'CANCELLED' },
  });
  if (count === 0) return false;
  await restoreOrderStock(tx, orderId);
  return true;
};

/**
 * Restores stock for every item of a cancelled order, minus units that returns already put back
 * (legacy ADMIN_APPROVED requests, or requests that reached ITEM_RECEIVED), to avoid double counting.
 */
export const restoreOrderStock = async (tx: Tx, orderId: string) => {
  const items = await tx.orderItem.findMany({
    where: { orderId },
    select: {
      productId: true,
      variantId: true,
      quantity: true,
      refundRequests: { select: { status: true, quantity: true, receivedAt: true } },
    },
  });

  for (const item of items) {
    const alreadyRestored = item.refundRequests
      .filter((r) => r.status === 'ADMIN_APPROVED' || r.receivedAt != null)
      .reduce((sum, r) => sum + r.quantity, 0);
    const quantity = item.quantity - alreadyRestored;
    if (quantity <= 0) continue;
    await restoreStock(tx, { productId: item.productId, variantId: item.variantId, quantity });
  }
};
