import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const variantInputSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().optional().nullable(),
  attributes: z.array(z.object({
    name: z.string(),
    nameAr: z.string().optional(),
    value: z.string(),
    valueAr: z.string().optional(),
  })),
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});

const productSchema = z.object({
  vendorId: z.string().optional(),
  categoryId: z.string(),
  brandId: z.string().optional().nullable(),
  name: z.string().min(1),
  nameAr: z.string().optional(),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string()).min(1),
  featured: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PENDING', 'ACTIVE', 'APPROVED', 'INACTIVE', 'REJECTED']).optional().default('ACTIVE'),
  hasVariants: z.boolean().optional().default(false),
});

const variantSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(),
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']).optional().nullable(),
  discountValue: z.number().nonnegative().optional().nullable(),
  stock: z.number().int().nonnegative(),
  image: z.string().optional().nullable(),
  attributes: z.array(z.object({
    name: z.string(),
    nameAr: z.string().optional(),
    value: z.string(),
    valueAr: z.string().optional(),
  })),
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});

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

    const vendorId = await resolveVendorId(req, res, 'query');
    if (!vendorId) return; // resolveVendorId already sent the error response

    const { page = '1', limit = '20', status } = req.query;
    const pageNum  = parseInt(page  as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorId };
    if (status) where.status = status;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } },
          brand:    { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: products.map((p) => ({
        ...p,
        images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
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

    res.json({
      ...product,
      images: typeof product!.images === 'string' ? JSON.parse(product!.images) : product!.images,
      variants: product!.variants.map((v) => ({
        ...v,
        attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes,
      })),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

// ─── POST / — create product ──────────────────────────────────────────────────

export const createVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const productData = productSchema.parse(req.body);

    // ADMIN and STAFF must supply vendorId in body
    // VENDOR resolves it from their account
    const vendorId = await resolveVendorId(req, res, 'body');
    if (!vendorId) return;

    const slug = slugify(productData.name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });
    if (existingSlug) {
      return res.status(400).json({ error: 'Product name is already taken' });
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sku = `SKU-${productData.categoryId.substring(0, 3).toUpperCase()}-${productId.substring(productId.length - 6).toUpperCase()}`;

    const product = await prisma.product.create({
      data: {
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
        images:        JSON.stringify(productData.images),
        status:        productData.status  || 'ACTIVE',
        featured:      productData.featured || false,
        hasVariants:   productData.hasVariants || false,
      },
      include: {
        category: { select: { name: true, slug: true } },
        brand:    { select: { name: true } },
        variants: true,
      },
    });

    if (productData.hasVariants && (productData as any).variants?.length > 0) {
      await prisma.productVariant.createMany({
        data: (productData as any).variants.map((v: any, index: number) => ({
          productId: product.id,
          sku:        `${sku}-V${index + 1}`,
          name:       v.name,
          nameAr:     v.nameAr    || null,
          attributes: JSON.stringify(v.attributes),
          price:      v.price,
          discountPrice: v.discountPrice || null,
          stock:      v.stock,
          image:      v.imageUrl  || null,
          isDefault:  v.isDefault || false,
        })),
      });

      const updatedProduct = await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          category: { select: { name: true, slug: true } },
          brand:    { select: { name: true } },
          variants: true,
        },
      });

      return res.status(201).json({
        ...updatedProduct,
        images: typeof updatedProduct?.images === 'string'
          ? JSON.parse(updatedProduct.images)
          : updatedProduct?.images,
        variants: updatedProduct?.variants.map((v) => ({
          ...v,
          attributes: typeof v.attributes === 'string'
            ? JSON.parse(v.attributes)
            : v.attributes,
        })),
      });
    }

    res.status(201).json({
      ...product,
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
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
      description,
      descriptionAr,
      price,
      discountPrice,
      discountType,
      discountValue,
      stock,
      images,
      featured,
      status,
      hasVariants,
    } = parsed;

    const updateData: any = {};

    if (categoryId    !== undefined) updateData.categoryId    = categoryId;
    if (brandId       !== undefined) updateData.brandId       = brandId ?? null;
    if (nameAr        !== undefined) updateData.nameAr        = nameAr ?? null;
    if (description   !== undefined) updateData.description   = description;
    if (descriptionAr !== undefined) updateData.descriptionAr = descriptionAr ?? null;
    if (price         !== undefined) updateData.price         = price;
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice ?? null;
    if (discountType  !== undefined) updateData.discountType  = discountType  ?? null;
    if (discountValue !== undefined) updateData.discountValue = discountValue ?? null;
    if (stock         !== undefined) updateData.stock         = stock;
    if (images        !== undefined) updateData.images        = JSON.stringify(images);
    if (featured      !== undefined) updateData.featured      = featured;
    if (status        !== undefined) updateData.status        = status;
    if (hasVariants   !== undefined) updateData.hasVariants   = hasVariants;

    if (name !== undefined) {
      updateData.name = name;
      if (name !== product.name) {
        const newSlug = slugify(name);
        const existingSlug = await prisma.product.findUnique({ where: { slug: newSlug } });
        if (existingSlug && existingSlug.id !== id) {
          return res.status(400).json({ error: 'Product name is already taken' });
        }
        updateData.slug = newSlug;
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { name: true, nameAr: true, slug: true } },
        brand:    { select: { name: true, nameAr: true } },
      },
    });

    res.json({
      ...updated,
      images: typeof updated.images === 'string' ? JSON.parse(updated.images) : updated.images,
    });
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

// ─── DELETE /:id — delete product ─────────────────────────────────────────────

export const deleteVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const result = await verifyProductOwnership(req, res, id);
    if (!result) return;

    await prisma.product.delete({ where: { id } });

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
      variants: variants.map((v) => ({
        ...v,
        attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes,
      })),
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
    const variantSku = `${product.sku}-V${Date.now().toString(36).toUpperCase()}`;

    if (variantData.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId,
        sku:          variantSku,
        name:         variantData.name,
        nameAr:       variantData.nameAr       || null,
        price:        variantData.price,
        discountPrice: variantData.discountPrice || null,
        stock:        variantData.stock,
        image:        variantData.image         || null,
        attributes:   JSON.stringify(variantData.attributes),
        isDefault:    variantData.isDefault     || false,
        status:       variantData.status        ?? true,
      },
    });

    await prisma.product.update({
      where: { id: productId },
      data: { hasVariants: true },
    });

    res.status(201).json({
      ...variant,
      attributes: variantData.attributes,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
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

    if (variantData.isDefault) {
      await prisma.productVariant.updateMany({
        where: { productId, isDefault: true, id: { not: variantId } },
        data: { isDefault: false },
      });
    }

    const updateData: any = { ...variantData };
    if (variantData.attributes) {
      updateData.attributes = JSON.stringify(variantData.attributes);
    }

    const variant = await prisma.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    res.json({
      ...variant,
      attributes: typeof variant.attributes === 'string'
        ? JSON.parse(variant.attributes)
        : variant.attributes,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
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

    await prisma.productVariant.delete({ where: { id: variantId } });

    const remainingVariants = await prisma.productVariant.count({ where: { productId } });
    if (remainingVariants === 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { hasVariants: false },
      });
    }

    res.json({ message: 'Variant deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting variant:', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
};