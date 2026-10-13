import { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

/** Same shape as Zod issues, so clients read one `details` format for every 400. */
export interface FieldIssue {
  path: string[];
  message: string;
}

export const INVALID_REFERENCES_ERROR = 'Invalid product data';

/**
 * Checks that the category (and the brand, when one is set) exist, so a bad id is a 400
 * instead of a foreign-key 500. Only pass the fields that are being written.
 */
export const findInvalidProductReferences = async (
  db: Db,
  refs: { categoryId?: string | null; brandId?: string | null }
): Promise<FieldIssue[]> => {
  const issues: FieldIssue[] = [];
  const [category, brand] = await Promise.all([
    refs.categoryId ? db.category.findUnique({ where: { id: refs.categoryId }, select: { id: true } }) : null,
    refs.brandId ? db.brand.findUnique({ where: { id: refs.brandId }, select: { id: true } }) : null,
  ]);
  if (refs.categoryId !== undefined && (!refs.categoryId || !category)) {
    issues.push({ path: ['categoryId'], message: 'Category not found' });
  }
  if (refs.brandId && !brand) {
    issues.push({ path: ['brandId'], message: 'Brand not found' });
  }
  return issues;
};
