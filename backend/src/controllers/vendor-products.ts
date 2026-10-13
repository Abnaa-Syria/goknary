import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError } from '../lib/errors';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { slugify } from '../lib/utils';
import {
  formatVariantForResponse,
  parseVariantAttributes,
  syncProductFromVariants,
} from '../lib/variants';
import { findInvalidProductReferences, INVALID_REFERENCES_ERROR } from '../lib/product-validation';
import { imageMetadataSchema, parseStoredImages, serializeImageMetadata, variantAltSchema } from '../lib/product-images';
import {
  ADMIN_TRANSITION_ERROR,
  VENDOR_SUBMITTABLE_STATUSES,
  classifyAdminStatusChange,
  resolveVendorCreateStatus,
  resolveVendorStatusChange,
  submissionData,
} from '../lib/product-moderation';
import {
  buildCatalogWhere,
  catalogOrderBy,
  catalogPagination,
  catalogSelect,
  formatCatalogProduct,
  getCatalogSummary,
  parseCatalogQuery,
} from '../lib/product-catalog';
import { formatPreviewProduct, previewProductInclude } from '../lib/product-preview';
import { getProductCommandCenterData } from '../lib/product-command-center';

/** Vendors never filter by vendor or featured placement; the scope is always their own store. */
const VENDOR_CATALOG_OPTIONS = { allowVendor: false, allowFeatured: false };

const isPlatformRole = (role: string) => role === 'ADMIN' || role === 'STAFF';

/** Who reviewed a product is internal; vendors only see the decision, its date and its reason. */
const forRole = <T extends { reviewedBy?: string | null }>(product: T, role: string) => {
  if (isPlatformRole(role)) return product;
  const { reviewedBy: _reviewedBy, ...rest } = product;
  return rest;
};

// ─── Schemas ──────────────────────────────────────────────────────────────────

// Accepts the UI's `[{ name, nameAr?, value, valueAr? }]` list or a `{ "Color": "Black" }` map;
// both are stored in the list shape. ProductVariant has no discountType/discountValue columns,
// so variant discounts are expressed only through `discountPrice`.
const variantAttributesSchema = z
  .union([
    z.array(z.object({
      name: z.string(),
      nameAr: z.string().optional(),
      value: z.string(),
      valueAr: z.string().optional(),
    })),
    z.record(z.string()),
  ])
  .transform((attrs) => parseVariantAttributes(attrs).filter((a) => a.name.trim() && a.value.trim()));

const variantSkuSchema = z.string().trim().min(1).max(100).optional().nullable();

const variantInputSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  sku: variantSkuSchema,
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  imageAlt: variantAltSchema,
  imageAltAr: variantAltSchema,
  attributes: variantAttributesSchema,
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});

const discountPriceError = (price: number, discountPrice: number | null | undefined) =>
  discountPrice != null && discountPrice >= price
    ? 'Variant discount price must be lower than its price'
    : null;

const productSchema = z.object({
  vendorId: z.string().optional(),
  categoryId: z.string(),
  brandId: z.string().optional().nullable(),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  slug: z.string().optional().nullable(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
  images: z.array(z.string()).min(1),
  imageMetadata: imageMetadataSchema.optional().nullable(),
  featured: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'APPROVED', 'INACTIVE', 'REJECTED']).optional().default('ACTIVE'),
  hasVariants: z.boolean().optional().default(false),
  variants: z.array(variantInputSchema).optional(),
});

const variantSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  sku: variantSkuSchema,
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative(),
  image: z.string().optional().nullable(),
  imageAlt: variantAltSchema,
  imageAltAr: variantAltSchema,
  attributes: variantAttributesSchema,
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});
const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const SLUG_TAKEN_ERROR = 'Slug or product name is already taken';
const VARIANT_SKU_TAKEN_ERROR = 'Variant SKU is already in use';

/** Field-level errors for inline create variants whose SKU repeats in the request or already exists. */
const findTakenInlineVariantSkus = async (variants: Array<{ sku?: string | null }>) => {
  const wanted = variants.map((v) => v.sku?.trim() || '');
  const filled = wanted.filter(Boolean);
  if (!filled.length) return [];
  const existing = await prisma.productVariant.findMany({ where: { sku: { in: filled } }, select: { sku: true } });
  const taken = new Set(existing.map((v) => v.sku.toLowerCase()));
  const seen = new Set<string>();
  const details: Array<{ path: Array<string | number>; message: string }> = [];
  wanted.forEach((sku, index) => {
    if (!sku) return;
    const key = sku.toLowerCase();
    if (taken.has(key) || seen.has(key)) details.push({ path: ['variants', index, 'sku'], message: VARIANT_SKU_TAKEN_ERROR });
    seen.add(key);
  });
  return details;
};

// ─── Helper: resolve vendorId for any role ────────────────────────────────────
/**
 * ADMIN  → must pass vendorId in query or body (no linked vendor required)
 * STAFF  → must pass vendorId in query or body (no linked vendor required)
 * VENDOR → resolved automatically from their own user account
 *
 * Returns { vendorId } on success, or calls res.status(4xx) and returns null.
 */
async function resolveVendorId(
  req: AuthRequest,
  res: Response,
  source: 'query' | 'body' = 'query'
): Promise<string | null> {
  const role = req.user!.role;

  if (role === 'ADMIN' || role === 'STAFF') {
    const id = source === 'query'
      ? (req.query.vendorId as string)
      : req.body?.vendorId;

    if (!id) {
      res.status(400).json({
        error: `vendorId is required for ${role} users`,
        hint: source === 'query'
          ? 'Pass ?vendorId=... as a query param'
          : 'Pass vendorId in the request body',
      });
      return null;
    }

    // Verify the vendor actually exists
    const vendor = await prisma.vendor.findUnique({ where: { id } });
    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return null;
    }

    return id;
  }

  // VENDOR role — resolve from their own account
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user!.id },
  });

  if (!vendor) {
    res.status(404).json({ error: 'Vendor not found' });
    return null;
  }

  if (vendor.status !== 'APPROVED') {
    res.status(403).json({ error: 'Vendor account not approved' });
    return null;
  }

  return vendor.id;
}

// ─── Helper: verify product ownership (skip for ADMIN & STAFF) ───────────────
async function verifyProductOwnership(
  req: AuthRequest,
  res: Response,
  productId: string
): Promise<{ product: any } | null> {
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    res.status(404).json({ error: 'Product not found' });
    return null;
  }

  // ADMIN and STAFF can access any product
  if (req.user!.role === 'ADMIN' || req.user!.role === 'STAFF') {
    return { product };
  }

  // VENDOR can only access their own products
  const vendor = await prisma.vendor.findUnique({
    where: { userId: req.user!.id },
  });

  if (!vendor || product.vendorId !== vendor.id) {
    res.status(403).json({ error: 'Unauthorized to access this product' });
    return null;
  }

  return { product };
}

// ─── GET / — list products ────────────────────────────────────────────────────

export const getVendorProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    // Validate the query before resolving the vendor, so a bad filter is a 400 for every role.
    const query = parseCatalogQuery(req.query as Record<string, unknown>, VENDOR_CATALOG_OPTIONS);

    const vendorId = await resolveVendorId(req, res, 'query');
    if (!vendorId) return; // resolveVendorId already sent the error response

    const scope = { vendorId };
    const where = await buildCatalogWhere(scope, query, VENDOR_CATALOG_OPTIONS);

    const [products, total, summary] = await Promise.all([
      prisma.product.findMany({
        where,
        select: catalogSelect,
        orderBy: catalogOrderBy(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.product.count({ where }),
      query.includeSummary ? getCatalogSummary(scope) : undefined,
    ]);

    res.json({
      products: products.map((p) => ({
        ...formatCatalogProduct(p),
        // Older clients read the full gallery from the list.
        images: parseStoredImages(p.images),
      })),
      pagination: catalogPagination(query, total),
      ...(summary ? { summary } : {}),
    });
  } catch (error) {
    if (error instanceof ValidationError) return res.status(400).json({ error: error.message });
    console.error('Error fetching vendor products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

// ─── GET /:id — single product ────────────────────────────────────────────────

export const getVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const result = await verifyProductOwnership(req, res, id);
    if (!result) return;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand:    true,
        variants: { orderBy: { createdAt: 'asc' } },
      },
    });

    res.json(forRole({
      ...product!,
      images: typeof product!.images === 'string' ? JSON.parse(product!.images) : product!.images,
      variants: product!.variants.map(formatVariantForResponse),
    }, req.user.role));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// ─── GET /:id/preview — the product as customers would see it, for any status ──
/**
 * Ownership is part of the query, so another store's product (any status) is the same 404 as a missing one.
 * The public slug endpoint is untouched and keeps hiding unpublished products.
 */
export const getVendorProductPreview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const where: Prisma.ProductWhereInput = { id: req.params.id };
    if (!isPlatformRole(req.user.role)) {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: 'Product not found', errorAr: 'المنتج غير موجود' });
      where.vendorId = vendor.id;
    }

    const product = await prisma.product.findFirst({ where, include: previewProductInclude(true) });
    if (!product) return res.status(404).json({ error: 'Product not found', errorAr: 'المنتج غير موجود' });

    res.json(await formatPreviewProduct(product));
  } catch (error) {
    console.error('Error loading product preview:', error);
    res.status(500).json({ error: 'Failed to load product preview', errorAr: 'تعذر تحميل معاينة المنتج' });
  }
};

/**
 * GET /:id/hub — Operational Product Command Center (Hub)
 * Ownership is enforced: if caller is a vendor, only their own product can be accessed.
 * Any other vendor's product returns 404 safe error.
 */
export const getVendorProductHub = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    let vendorIdConstraint: string | undefined = undefined;
    if (!isPlatformRole(req.user.role)) {
      const vendor = await prisma.vendor.findUnique({ where: { userId: req.user.id }, select: { id: true } });
      if (!vendor) return res.status(404).json({ error: 'Product not found', errorAr: 'المنتج غير موجود' });
      vendorIdConstraint = vendor.id;
    }

    const data = await getProductCommandCenterData(req.params.id, {
      isPlatformStaff: isPlatformRole(req.user.role),
      vendorIdConstraint,
    });

    res.json(data);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message, errorAr: 'المنتج غير موجود' });
    }
    console.error('Error fetching product command center data:', error);
    res.status(500).json({ error: 'Failed to load product command center data' });
  }
};

// ─── POST / — create product ──────────────────────────────────────────────────

export const createVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const productData = productSchema.parse(req.body);
    const inlineVariants = productData.variants ?? [];

    for (const [index, v] of inlineVariants.entries()) {
      const discountError = discountPriceError(v.price, v.discountPrice);
      if (discountError) {
        return res.status(400).json({
          error: `${v.name}: ${discountError}`,
          details: [{ path: ['variants', index, 'discountPrice'], message: discountError }],
        });
      }
    }

    // ADMIN and STAFF must supply vendorId in body
    // VENDOR resolves it from their account
    const vendorId = await resolveVendorId(req, res, 'body');
    if (!vendorId) return;

    const referenceIssues = await findInvalidProductReferences(prisma, {
      categoryId: productData.categoryId,
      brandId: productData.brandId || null,
    });
    if (referenceIssues.length) return res.status(400).json({ error: INVALID_REFERENCES_ERROR, details: referenceIssues });

    const rawSlug = productData.slug ? productData.slug.trim() : '';
    const slug = rawSlug ? slugify(rawSlug) : slugify(productData.name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: SLUG_TAKEN_ERROR, details: [{ path: ['slug'], message: SLUG_TAKEN_ERROR }] });
    }

    const skuDetails = await findTakenInlineVariantSkus(inlineVariants);
    if (skuDetails.length) {
      return res.status(400).json({ error: VARIANT_SKU_TAKEN_ERROR, details: skuDetails });
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sku = `SKU-${productData.categoryId.substring(0, 3).toUpperCase()}-${productId.substring(productId.length - 6).toUpperCase()}`;

    // Vendors save a draft or send for review (older clients sending ACTIVE get review);
    // only platform staff create live or featured products directly.
    const platform = isPlatformRole(req.user!.role);
    const finalStatus = platform ? productData.status || 'ACTIVE' : resolveVendorCreateStatus(req.body?.status);

    const productCreateData = {
      vendorId,
      categoryId:    productData.categoryId,
      brandId:       productData.brandId       || null,
      name:          productData.name,
      nameAr:        productData.nameAr        || null,
      slug,
      description:   productData.description   || '',
      descriptionAr: productData.descriptionAr || null,
      sku,
      price:         productData.price,
      discountPrice: productData.discountPrice  ?? null,
      discountType:  productData.discountType   ?? null,
      discountValue: productData.discountValue  ?? null,
      stock:         productData.stock,
      ...(productData.lowStockThreshold !== undefined && { lowStockThreshold: productData.lowStockThreshold }),
      images:        JSON.stringify(productData.images),
      imageMetadata: serializeImageMetadata(productData.images, productData.imageMetadata),
      status:        finalStatus,
      submittedAt:   finalStatus === 'PENDING' ? new Date() : null,
      featured:      platform ? productData.featured || false : false,
      hasVariants:   productData.hasVariants || false,
    };
    const productInclude = {
      category: { select: { name: true, slug: true } },
      brand:    { select: { name: true } },
      variants: true,
    };

    if (inlineVariants.length > 0) {
      // Only the first variant flagged as default keeps the flag; it must also be active.
      const defaultIndex = inlineVariants.findIndex((v) => v.isDefault && v.status !== false);

      const createdProduct = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: { ...productCreateData, hasVariants: true },
        });

        await tx.productVariant.createMany({
          data: inlineVariants.map((v, index) => ({
            productId:     created.id,
            sku:           v.sku || `${sku}-V${index + 1}`,
            name:          v.name,
            nameAr:        v.nameAr || null,
            attributes:    JSON.stringify(v.attributes),
            price:         v.price,
            discountPrice: v.discountPrice || null,
            stock:         v.stock,
            image:         v.imageUrl || v.image || null,
            imageAlt:      v.imageAlt ?? null,
            imageAltAr:    v.imageAltAr ?? null,
            isDefault:     index === defaultIndex,
            status:        v.status ?? true,
          })),
        });

        await syncProductFromVariants(tx, created.id);

        return tx.product.findUnique({ where: { id: created.id }, include: productInclude });
      });

      return res.status(201).json({
        ...createdProduct,
        images: typeof createdProduct?.images === 'string'
          ? JSON.parse(createdProduct.images)
          : createdProduct?.images,
        variants: createdProduct?.variants.map(formatVariantForResponse),
      });
    }

    const product = await prisma.product.create({
      data: productCreateData,
      include: productInclude,
    });

    res.status(201).json({
      ...product,
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (isUniqueConstraintError(error)) {
      const target = String((error as Prisma.PrismaClientKnownRequestError).meta?.target ?? '');
      if (target.includes('slug')) {
        return res.status(400).json({ error: SLUG_TAKEN_ERROR, details: [{ path: ['slug'], message: SLUG_TAKEN_ERROR }] });
      }
      return res.status(400).json({ error: 'SKU is already in use', details: [{ path: ['variants'], message: VARIANT_SKU_TAKEN_ERROR }] });
    }
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
};

// ─── PATCH /:id — update product ──────────────────────────────────────────────

export const updateVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const parsed = productSchema.partial().parse(req.body);

    const result = await verifyProductOwnership(req, res, id);
    if (!result) return;

    const { product } = result;

    const {
      vendorId: _vendorId, // strip — cannot reassign vendor
      categoryId,
      brandId,
      name,
      nameAr,
      slug,
      description,
      descriptionAr,
      price,
      discountPrice,
      discountType,
      discountValue,
      stock,
      lowStockThreshold,
      images,
      imageMetadata,
      featured,
      status,
      hasVariants,
    } = parsed;

    const updateData: any = {};
    const platform = isPlatformRole(req.user!.role);

    const nextBrandId = brandId === undefined ? undefined : brandId || null;
    const referenceIssues = await findInvalidProductReferences(prisma, {
      categoryId: categoryId !== undefined && categoryId !== product.categoryId ? categoryId : undefined,
      brandId: nextBrandId && nextBrandId !== product.brandId ? nextBrandId : undefined,
    });
    if (referenceIssues.length) return res.status(400).json({ error: INVALID_REFERENCES_ERROR, details: referenceIssues });

    if (name          !== undefined) updateData.name          = name;
    if (categoryId    !== undefined) updateData.categoryId    = categoryId;
    if (brandId       !== undefined) updateData.brandId       = (brandId === '' || brandId === null) ? null : brandId;
    if (nameAr        !== undefined) updateData.nameAr        = nameAr ?? null;
    if (description   !== undefined) updateData.description   = description;
    if (descriptionAr !== undefined) updateData.descriptionAr = descriptionAr ?? null;
    if (price         !== undefined) updateData.price         = price;
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice ?? null;
    if (discountType  !== undefined) updateData.discountType  = (discountType as any) === '' ? null : discountType;
    if (discountValue !== undefined) updateData.discountValue = discountValue ?? null;
    if (stock         !== undefined) updateData.stock         = stock;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (images        !== undefined) updateData.images        = JSON.stringify(images);
    // Alt text follows its URL: a new gallery without new metadata keeps the alt of images that remain.
    if (images !== undefined || imageMetadata !== undefined) {
      const galleryUrls = images ?? parseStoredImages(product.images);
      updateData.imageMetadata = serializeImageMetadata(
        galleryUrls,
        imageMetadata !== undefined ? imageMetadata : product.imageMetadata,
      );
    }
    // Featured placement is admin-controlled; vendor edits leave the current value untouched.
    if (featured      !== undefined && platform) updateData.featured = featured;
    // Variant rows decide hasVariants; a stale form value must not turn variant pricing off.
    if (hasVariants   !== undefined) {
      const variantCount = await prisma.productVariant.count({ where: { productId: id } });
      updateData.hasVariants = variantCount > 0 ? true : hasVariants;
    }

    // Raw body status, so a missing field never falls back to the schema default.
    const requestedStatus: string | undefined = req.body?.status ?? undefined;
    if (requestedStatus !== undefined && status === undefined) {
      return res.status(400).json({ error: 'Invalid product status' });
    }
    if (status !== undefined) {
      if (platform) {
        const change = classifyAdminStatusChange(product.status, status);
        if (change === 'approve' || change === 'reject' || change === 'invalid') {
          return res.status(400).json({ error: ADMIN_TRANSITION_ERROR });
        }
        if (change === 'operational') updateData.status = status;
      } else {
        // Published products stay published when edited; nothing here can publish without review.
        const change = resolveVendorStatusChange(product.status, status);
        if (change.kind === 'error') return res.status(400).json({ error: change.message });
        if (change.kind === 'set') {
          updateData.status = change.status;
          if (change.status === 'DRAFT') updateData.submittedAt = null;
        }
        if (change.kind === 'submit') Object.assign(updateData, submissionData());
      }
    }

    const rawSlug = slug !== undefined ? (slug ? slug.trim() : '') : undefined;

    if (rawSlug !== undefined) {
      const newSlug = rawSlug ? slugify(rawSlug) : slugify(name || product.name);
      if (newSlug !== product.slug) {
        const existingSlug = await prisma.product.findUnique({ where: { slug: newSlug } });
        if (existingSlug && existingSlug.id !== id) {
          return res.status(400).json({ error: 'Slug is already taken', details: [{ path: ['slug'], message: 'Slug is already taken' }] });
        }
        updateData.slug = newSlug;
      }
    } else if (name !== undefined && name !== product.name) {
      const newSlug = slugify(name);
      const existingSlug = await prisma.product.findUnique({ where: { slug: newSlug } });
      if (existingSlug && existingSlug.id !== id) {
        return res.status(400).json({ error: 'Product name is already taken', details: [{ path: ['name'], message: 'Product name is already taken' }] });
      }
      updateData.slug = newSlug;
    }

    // For variant products, form price/discount/stock are not authoritative: the summary is
    // re-derived from the variants in the same transaction.
    const updated = await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: updateData });
      await syncProductFromVariants(tx, id);
      return tx.product.findUniqueOrThrow({
        where: { id },
        include: {
          category: { select: { name: true, nameAr: true, slug: true } },
          brand:    { select: { name: true, nameAr: true } },
        },
      });
    });

    res.json(forRole({
      ...updated,
      images: typeof updated.images === 'string' ? JSON.parse(updated.images) : updated.images,
    }, req.user.role));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
};

// ─── POST /:id/submit — send for review ───────────────────────────────────────

export const submitVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const result = await verifyProductOwnership(req, res, id);
    if (!result) return;
    const { product } = result;

    const vendor = await prisma.vendor.findUnique({ where: { id: product.vendorId }, select: { status: true } });
    if (vendor?.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Vendor account not approved' });
    }

    if (!VENDOR_SUBMITTABLE_STATUSES.includes(product.status)) {
      const message = product.status === 'PENDING'
        ? 'Product is already waiting for review'
        : 'Only draft or rejected products can be submitted for review';
      return res.status(409).json({ error: message });
    }

    // Conditional on the status just read, so a double submit cannot reset submittedAt twice.
    const { count } = await prisma.product.updateMany({
      where: { id, status: product.status },
      data: submissionData(),
    });
    if (count === 0) return res.status(409).json({ error: 'Product status changed, please refresh' });

    const updated = await prisma.product.findUniqueOrThrow({ where: { id } });
    res.json({
      message: 'Product submitted for review',
      product: forRole({
        ...updated,
        images: typeof updated.images === 'string' ? JSON.parse(updated.images) : updated.images,
      }, req.user.role),
    });
  } catch (error) {
    console.error('Error submitting product:', error);
    res.status(500).json({ error: 'Failed to submit product' });
  }
};

// ─── DELETE /:id — delete product ─────────────────────────────────────────────

export const deleteVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const result = await verifyProductOwnership(req, res, id);
    if (!result) return;

    // Check if product has been purchased
    const orderCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete product because it has associated purchase history. You can deactivate it (mark as INACTIVE) instead.',
        errorAr: 'لا يمكن حذف المنتج لأنه مرتبط بعمليات شراء سابقة. يمكنك إلغاء تفعيله (جعله غير نشط) بدلاً من ذلك.',
      });
    }

    // Clean up dependent records and delete product in a transaction
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { productId: id } }),
      prisma.wishlistItem.deleteMany({ where: { productId: id } }),
      prisma.compareItem.deleteMany({ where: { productId: id } }),
      prisma.review.deleteMany({ where: { productId: id } }),
      prisma.productVariant.deleteMany({ where: { productId: id } }),
      prisma.product.delete({ where: { id } }),
    ]);

    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting product:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
};

// ─── GET /:productId/variants ─────────────────────────────────────────────────

export const getProductVariants = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId } = req.params;
    const result = await verifyProductOwnership(req, res, productId);
    if (!result) return;

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      variants: variants.map(formatVariantForResponse),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching variants:', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
};

// ─── POST /:productId/variants ────────────────────────────────────────────────

export const createProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId } = req.params;
    const variantData = variantSchema.parse(req.body);

    const result = await verifyProductOwnership(req, res, productId);
    if (!result) return;

    const { product } = result;
    const variantSku = variantData.sku || `${product.sku}-V${Date.now().toString(36).toUpperCase()}`;

    const discountError = discountPriceError(variantData.price, variantData.discountPrice);
    if (discountError) return res.status(400).json({ error: discountError, details: [{ path: ['discountPrice'], message: discountError }] });

    const status = variantData.status ?? true;
    // A default variant must be active
    const isDefault = !!variantData.isDefault && status;

    const variant = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const created = await tx.productVariant.create({
        data: {
          productId,
          sku:           variantSku,
          name:          variantData.name,
          nameAr:        variantData.nameAr        || null,
          price:         variantData.price,
          discountPrice: variantData.discountPrice || null,
          stock:         variantData.stock,
          image:         variantData.image         || null,
          imageAlt:      variantData.imageAlt      ?? null,
          imageAltAr:    variantData.imageAltAr    ?? null,
          attributes:    JSON.stringify(variantData.attributes),
          isDefault,
          status,
        },
      });

      await syncProductFromVariants(tx, productId);

      return tx.productVariant.findUniqueOrThrow({ where: { id: created.id } });
    });

    res.status(201).json(formatVariantForResponse(variant));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (isUniqueConstraintError(error)) {
      return res.status(400).json({ error: VARIANT_SKU_TAKEN_ERROR, details: [{ path: ['sku'], message: VARIANT_SKU_TAKEN_ERROR }] });
    }
    console.error('Error creating variant:', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
};

// ─── PATCH /:productId/variants/:variantId ────────────────────────────────────

export const updateProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId, variantId } = req.params;
    const variantData = variantSchema.partial().parse(req.body);

    const result = await verifyProductOwnership(req, res, productId);
    if (!result) return;

    const existingVariant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!existingVariant) throw new NotFoundError('Variant not found');

    const discountError = discountPriceError(
      variantData.price ?? existingVariant.price,
      variantData.discountPrice !== undefined ? variantData.discountPrice : existingVariant.discountPrice
    );
    if (discountError) return res.status(400).json({ error: discountError, details: [{ path: ['discountPrice'], message: discountError }] });

    const { sku, attributes, ...rest } = variantData;
    const updateData: Prisma.ProductVariantUpdateInput = { ...rest };
    if (sku) updateData.sku = sku;
    if (attributes) updateData.attributes = JSON.stringify(attributes);

    const nextStatus = variantData.status ?? existingVariant.status;
    const nextIsDefault = (variantData.isDefault ?? existingVariant.isDefault) && nextStatus;
    updateData.isDefault = nextIsDefault;

    const variant = await prisma.$transaction(async (tx) => {
      if (nextIsDefault) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true, id: { not: variantId } },
          data: { isDefault: false },
        });
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: updateData,
      });
      await syncProductFromVariants(tx, productId);

      return tx.productVariant.findUniqueOrThrow({ where: { id: variantId } });
    });

    res.json(formatVariantForResponse(variant));
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (isUniqueConstraintError(error)) {
      return res.status(400).json({ error: VARIANT_SKU_TAKEN_ERROR, details: [{ path: ['sku'], message: VARIANT_SKU_TAKEN_ERROR }] });
    }
    console.error('Error updating variant:', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
};

// ─── DELETE /:productId/variants/:variantId ───────────────────────────────────

export const deleteProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { productId, variantId } = req.params;

    const result = await verifyProductOwnership(req, res, productId);
    if (!result) return;

    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });
    if (!variant) throw new NotFoundError('Variant not found');

    // Variants with purchase history are deactivated instead of deleted, so order
    // links and stock restoration on later cancellations keep pointing at a real variant.
    const orderCount = await prisma.orderItem.count({ where: { variantId } });
    if (orderCount > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { status: false, isDefault: false },
        });
        await syncProductFromVariants(tx, productId);
      });

      return res.json({
        message: 'Variant has purchase history, so it was deactivated instead of deleted.',
        messageAr: 'هذا الخيار مرتبط بطلبات سابقة، لذلك تم إيقافه بدلاً من حذفه.',
        deactivated: true,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.cartItem.deleteMany({ where: { variantId } });
      await tx.productVariant.delete({ where: { id: variantId } });

      const remainingVariants = await tx.productVariant.count({ where: { productId } });
      if (remainingVariants === 0) {
        // The stock cache belonged to the deleted variants; the product must not stay sellable with it.
        await tx.product.update({
          where: { id: productId },
          data: { hasVariants: false, stock: 0 },
        });
      } else {
        await syncProductFromVariants(tx, productId);
      }
    });

    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
};

const bulkImportSchema = z.object({
  products: z.array(
    z.object({
      name: z.string().min(1),
      nameAr: z.string().optional(),
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      price: z.number().positive(),
      discountPrice: z.number().positive().optional().nullable(),
      discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
      discountValue: z.number().nonnegative().optional().nullable(),
      stock: z.number().int().nonnegative().default(0),
      lowStockThreshold: z.number().int().nonnegative().optional().default(5),
      categoryId: z.string().min(1),
      brandId: z.string().optional().nullable(),
      images: z.array(z.string()).optional(),
      featured: z.boolean().optional().default(false),
    })
  ).min(1),
  vendorId: z.string().optional(),
});

// POST /api/vendor/products/import
export const importProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { products, vendorId: bodyVendorId } = bulkImportSchema.parse(req.body);

    // Resolve vendorId based on user role (Admin can specify bodyVendorId)
    const vendorId = await resolveVendorId(req, res, 'body');
    if (!vendorId) return;

    // Validate Categories exist
    const categoryIds = Array.from(new Set(products.map((p) => p.categoryId)));
    const existingCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    const existingCategoryIds = new Set(existingCategories.map((c) => c.id));
    const invalidCategories = categoryIds.filter((id) => !existingCategoryIds.has(id));
    if (invalidCategories.length > 0) {
      return res.status(400).json({
        error: 'Invalid categoryId(s) provided in batch',
        invalidCategoryIds: invalidCategories,
      });
    }

    // Validate Brands exist if provided
    const brandIds = Array.from(new Set(products.map((p) => p.brandId).filter(Boolean) as string[]));
    if (brandIds.length > 0) {
      const existingBrands = await prisma.brand.findMany({
        where: { id: { in: brandIds } },
        select: { id: true },
      });
      const existingBrandIds = new Set(existingBrands.map((b) => b.id));
      const invalidBrands = brandIds.filter((id) => !existingBrandIds.has(id));
      if (invalidBrands.length > 0) {
        return res.status(400).json({
          error: 'Invalid brandId(s) provided in batch',
          invalidBrandIds: invalidBrands,
        });
      }
    }

    // Determine initial status based on role
    const platform = isPlatformRole(req.user.role);
    const initialStatus = platform ? 'ACTIVE' : 'PENDING';
    const submittedAt = platform ? null : new Date();

    const batchSize = 100;
    let totalImported = 0;

    for (let i = 0; i < products.length; i += batchSize) {
      const chunk = products.slice(i, i + batchSize);

      const mappedChunk = chunk.map((p, idx) => {
        const id = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}_${i + idx}`;
        const slug = `${slugify(p.name)}-${Math.random().toString(36).substring(2, 7)}`;
        const sku = `SKU-${p.categoryId.substring(0, 3).toUpperCase()}-${id.substring(id.length - 6).toUpperCase()}`;

        return {
          id,
          vendorId,
          categoryId: p.categoryId,
          brandId: p.brandId || null,
          name: p.name,
          nameAr: p.nameAr || null,
          slug,
          description: p.description || '',
          descriptionAr: p.descriptionAr || null,
          sku,
          price: p.price,
          discountPrice: p.discountPrice || null,
          discountType: p.discountType || null,
          discountValue: p.discountValue || null,
          stock: p.stock,
          lowStockThreshold: p.lowStockThreshold ?? 5,
          images: JSON.stringify(p.images || []),
          status: initialStatus as any,
          submittedAt,
          featured: platform ? p.featured || false : false,
          hasVariants: false,
        };
      });

      await prisma.product.createMany({
        data: mappedChunk,
      });

      totalImported += mappedChunk.length;

      // Yield execution back to the Event Loop to keep the server responsive
      await new Promise((resolve) => setImmediate(resolve));
    }

    res.status(201).json({
      message: `Bulk import completed successfully. Imported ${totalImported} products.`,
      count: totalImported,
      status: initialStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.errors });
    }
    console.error('Error in bulk import:', error);
    res.status(500).json({ error: 'Failed to import products' });
  }
};
