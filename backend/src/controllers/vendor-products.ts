import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

const variantInputSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(), // Arabic name
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().optional().nullable(),
  attributes: z.array(z.object({
    name: z.string(),
    nameAr: z.string().optional(), // Arabic attribute name
    value: z.string(),
    valueAr: z.string().optional(), // Arabic attribute value
  })),
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});

const productSchema = z.object({
  categoryId: z.string(),
  brandId: z.string().optional(),
  name: z.string().min(1),
  nameAr: z.string().optional(), // Arabic name
  description: z.string().optional(),
  descriptionAr: z.string().optional(), // Arabic description
  price: z.number().positive(),
  discountPrice: z.number().positive().optional(),
  stock: z.number().int().nonnegative(),
  images: z.array(z.string()).min(1),
  featured: z.boolean().default(false),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
  hasVariants: z.boolean().optional().default(false),
  variants: z.array(variantInputSchema).optional(),
});

const variantSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(), // Arabic name
  price: z.number().positive(),
  discountPrice: z.number().positive().optional().nullable(),
  stock: z.number().int().nonnegative(),
  image: z.string().optional().nullable(),
  attributes: z.array(z.object({
    name: z.string(),
    nameAr: z.string().optional(), // Arabic attribute name
    value: z.string(),
    valueAr: z.string().optional(), // Arabic attribute value
  })),
  isDefault: z.boolean().optional().default(false),
  status: z.boolean().optional().default(true),
});

export const getVendorProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { page = '1', limit = '20', status } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { vendorId: vendor.id };
    if (status) {
      where.status = status;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: {
            select: {
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { id } = req.params;

    const product = await prisma.product.findFirst({
      where: {
        id,
        vendorId: vendor.id,
      },
      include: {
        category: true,
        brand: true,
        variants: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor || vendor.status !== 'APPROVED') {
      return res.status(403).json({ error: 'Vendor account not approved' });
    }

    const productData = productSchema.parse(req.body);

    // Generate slug and SKU
    const slug = slugify(productData.name);
    const existingSlug = await prisma.product.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      return res.status(400).json({ error: 'Product name is already taken' });
    }

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const sku = `SKU-${productData.categoryId.substring(0, 3).toUpperCase()}-${productId.substring(productId.length - 6).toUpperCase()}`;

    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: productData.categoryId,
        brandId: productData.brandId || null,
        name: productData.name,
        nameAr: productData.nameAr || null, // Arabic name
        slug,
        description: productData.description || '',
        descriptionAr: productData.descriptionAr || null, // Arabic description
        sku,
        price: productData.price,
        discountPrice: productData.discountPrice || null,
        stock: productData.stock,
        images: JSON.stringify(productData.images),
        status: productData.status || 'ACTIVE',
        featured: productData.featured || false,
        hasVariants: productData.hasVariants || false,
      },
      include: {
        category: {
          select: {
            name: true,
            slug: true,
          },
        },
        brand: {
          select: {
            name: true,
          },
        },
        variants: true,
      },
    });

    // Create variants if provided
    if (productData.hasVariants && productData.variants && productData.variants.length > 0) {
      await prisma.productVariant.createMany({
        data: productData.variants.map((v, index) => ({
          productId: product.id,
          sku: `${sku}-V${index + 1}`, // Generate unique SKU for each variant
          name: v.name,
          nameAr: v.nameAr || null, // Arabic name
          attributes: JSON.stringify(v.attributes),
          price: v.price,
          discountPrice: v.discountPrice || null,
          stock: v.stock,
          image: v.imageUrl || null,
          isDefault: v.isDefault || false,
        })),
      });

      // Fetch updated product with variants
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { id } = req.params;
    const updateData = productSchema.partial().parse(req.body);

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: {
        id,
        vendorId: vendor.id,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Handle slug update if name changes
    if (updateData.name && updateData.name !== product.name) {
      const newSlug = slugify(updateData.name);
      const existingSlug = await prisma.product.findUnique({
        where: { slug: newSlug },
      });

      if (existingSlug && existingSlug.id !== id) {
        return res.status(400).json({ error: 'Product name is already taken' });
      }

      (updateData as any).slug = newSlug;
    }

    // Handle images
    if (updateData.images) {
      (updateData as any).images = JSON.stringify(updateData.images);
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: {
          select: {
            name: true,
            nameAr: true,
            slug: true,
          },
        },
        brand: {
          select: {
            name: true,
            nameAr: true,
          },
        },
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { id } = req.params;

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: {
        id,
        vendorId: vendor.id,
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    await prisma.product.delete({
      where: { id },
    });

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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { productId } = req.params;

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { productId } = req.params;
    const variantData = variantSchema.parse(req.body);

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Generate unique SKU for variant
    const variantSku = `${product.sku}-V${Date.now().toString(36).toUpperCase()}`;

    // If this is default variant, unset other defaults
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
        nameAr: variantData.nameAr || null, // Arabic name
        price: variantData.price,
        discountPrice: variantData.discountPrice || null,
        stock: variantData.stock,
        image: variantData.image || null,
        attributes: JSON.stringify(variantData.attributes),
        isDefault: variantData.isDefault || false,
        status: variantData.status ?? true,
      },
    });

    // Update product to indicate it has variants
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { productId, variantId } = req.params;
    const variantData = variantSchema.partial().parse(req.body);

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify variant exists
    const existingVariant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!existingVariant) {
      throw new NotFoundError('Variant not found');
    }

    // If setting as default, unset other defaults
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

    const vendor = await prisma.vendor.findUnique({
      where: { userId: req.user.id },
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    const { productId, variantId } = req.params;

    // Verify product belongs to vendor
    const product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Verify variant exists
    const variant = await prisma.productVariant.findFirst({
      where: { id: variantId, productId },
    });

    if (!variant) {
      throw new NotFoundError('Variant not found');
    }

    await prisma.productVariant.delete({
      where: { id: variantId },
    });

    // Check if product still has variants
    const remainingVariants = await prisma.productVariant.count({
      where: { productId },
    });

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

