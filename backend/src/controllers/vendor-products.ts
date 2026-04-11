import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

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

export const getVendorProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let targetVendorId: string;

    if (req.user.role === 'ADMIN') {
      const queryVendorId = req.query.vendorId as string;
      if (queryVendorId) {
        targetVendorId = queryVendorId;
      } else {
        const vendor = await prisma.vendor.findUnique({
          where: { userId: req.user.id },
        });
        if (!vendor) return res.status(400).json({ error: 'Admin must provide vendorId or have a linked vendor account' });
        targetVendorId = vendor.id;
      }
    } else {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });

      if (!vendor) {
        return res.status(404).json({ error: 'Vendor not found' });
      }
      targetVendorId = vendor.id;
    }

    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorId: targetVendorId };
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true } },
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

export const getVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        variants: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to access this product' });
      }
    }

    res.json({
      ...product,
      images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
      variants: product.variants.map(v => ({
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

export const createVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const productData = productSchema.parse(req.body);

    let targetVendorId: string;

    if (req.user.role === 'ADMIN') {
      if (!productData.vendorId) {
        return res.status(400).json({ error: 'Admin must provide vendorId to create a product' });
      }
      targetVendorId = productData.vendorId;
    } else {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });

      if (!vendor || vendor.status !== 'APPROVED') {
        return res.status(403).json({ error: 'Vendor account not approved' });
      }
      targetVendorId = vendor.id;
    }

    const slug = slugify(productData.name);
    const existingSlug = await prisma.product.findUnique({ where: { slug } });

    if (existingSlug) {
      return res.status(400).json({ error: 'Product name is already taken' });
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sku = `SKU-${productData.categoryId.substring(0, 3).toUpperCase()}-${productId.substring(productId.length - 6).toUpperCase()}`;

    const product = await prisma.product.create({
      data: {
        vendorId: targetVendorId,
        categoryId: productData.categoryId,
        brandId: productData.brandId || null,
        name: productData.name,
        nameAr: productData.nameAr || null,
        slug,
        description: productData.description || '',
        descriptionAr: productData.descriptionAr || null,
        sku,
        price: productData.price,
        discountPrice: productData.discountPrice ?? null,
        discountType: productData.discountType ?? null,
        discountValue: productData.discountValue ?? null,
        stock: productData.stock,
        images: JSON.stringify(productData.images),
        status: productData.status || 'ACTIVE',
        featured: productData.featured || false,
        hasVariants: productData.hasVariants || false,
      },
      include: {
        category: { select: { name: true, slug: true } },
        brand: { select: { name: true } },
        variants: true,
      },
    });

    if (productData.hasVariants && (productData as any).variants?.length > 0) {
      await prisma.productVariant.createMany({
        data: (productData as any).variants.map((v: any, index: number) => ({
          productId: product.id,
          sku: `${sku}-V${index + 1}`,
          name: v.name,
          nameAr: v.nameAr || null,
          attributes: JSON.stringify(v.attributes),
          price: v.price,
          discountPrice: v.discountPrice || null,
          stock: v.stock,
          image: v.imageUrl || null,
          isDefault: v.isDefault || false,
        })),
      });

      const updatedProduct = await prisma.product.findUnique({
        where: { id: product.id },
        include: {
          category: { select: { name: true, slug: true } },
          brand: { select: { name: true } },
          variants: true,
        },
      });

      return res.status(201).json({
        ...updatedProduct,
        images: typeof updatedProduct?.images === 'string' ? JSON.parse(updatedProduct.images) : updatedProduct?.images,
        variants: updatedProduct?.variants.map(v => ({
          ...v,
          attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes,
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

export const updateVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const parsed = productSchema.partial().parse(req.body);

    // FIX: Extract only the scalar fields that Prisma accepts directly
    // Never pass vendorId/categoryId/brandId as plain strings — Prisma treats them as relation updates
    const {
      vendorId: _vendorId,   // strip — can't reassign vendor via update
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

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to update this product' });
      }
    }

    // Build update data explicitly — only include fields that were actually sent
    const updateData: any = {};

    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (brandId !== undefined) updateData.brandId = brandId ?? null;
    if (name !== undefined) {
      updateData.name = name;
      // Handle slug if name changed
      if (name !== product.name) {
        const newSlug = slugify(name);
        const existingSlug = await prisma.product.findUnique({ where: { slug: newSlug } });
        if (existingSlug && existingSlug.id !== id) {
          return res.status(400).json({ error: 'Product name is already taken' });
        }
        updateData.slug = newSlug;
      }
    }
    if (nameAr !== undefined) updateData.nameAr = nameAr ?? null;
    if (description !== undefined) updateData.description = description;
    if (descriptionAr !== undefined) updateData.descriptionAr = descriptionAr ?? null;
    if (price !== undefined) updateData.price = price;
    if (discountPrice !== undefined) updateData.discountPrice = discountPrice ?? null;
    if (discountType !== undefined) updateData.discountType = discountType ?? null;
    if (discountValue !== undefined) updateData.discountValue = discountValue ?? null;
    if (stock !== undefined) updateData.stock = stock;
    if (images !== undefined) updateData.images = JSON.stringify(images);
    if (featured !== undefined) updateData.featured = featured;
    if (status !== undefined) updateData.status = status;
    if (hasVariants !== undefined) updateData.hasVariants = hasVariants;

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { name: true, nameAr: true, slug: true } },
        brand: { select: { name: true, nameAr: true } },
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

export const deleteVendorProduct = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to delete this product' });
      }
    }

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

// ============ Product Variants ============

export const getProductVariants = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to access this product' });
      }
    }

    const variants = await prisma.productVariant.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      variants: variants.map(v => ({
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

export const createProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productId } = req.params;
    const variantData = variantSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to add variants to this product' });
      }
    }

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
        sku: variantSku,
        name: variantData.name,
        nameAr: variantData.nameAr || null,
        price: variantData.price,
        discountPrice: variantData.discountPrice || null,
        stock: variantData.stock,
        image: variantData.image || null,
        attributes: JSON.stringify(variantData.attributes),
        isDefault: variantData.isDefault || false,
        status: variantData.status ?? true,
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

export const updateProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productId, variantId } = req.params;
    const variantData = variantSchema.partial().parse(req.body);

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to update this variant' });
      }
    }

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
      attributes: typeof variant.attributes === 'string' ? JSON.parse(variant.attributes) : variant.attributes,
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

export const deleteProductVariant = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { productId, variantId } = req.params;

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product not found');

    if (req.user.role !== 'ADMIN') {
      const vendor = await prisma.vendor.findUnique({
        where: { userId: req.user.id },
      });
      if (!vendor || product.vendorId !== vendor.id) {
        return res.status(403).json({ error: 'Unauthorized to access this product' });
      }
    }

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