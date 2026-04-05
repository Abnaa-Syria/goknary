import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';


export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      categoryId,
      brandId,
      vendorId,
      minPrice,
      maxPrice,
      minRating,
      search,
      sort = 'relevance',
      page = '1',
      limit = '24',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ProductWhereInput = {
      status: 'ACTIVE',
    };

    if (categoryId) {
      // Get all subcategory IDs for this category
      const category = await prisma.category.findUnique({
        where: { id: categoryId as string },
        include: {
          children: true,
        },
      });

      if (category) {
        // Include the category itself and all its children
        const categoryIds = [category.id];
        if (category.children && category.children.length > 0) {
          categoryIds.push(...category.children.map(child => child.id));
        }
        
        where.categoryId = {
          in: categoryIds,
        };
      } else {
        // If category not found, use direct match
        where.categoryId = categoryId as string;
      }
    }

    if (brandId) {
      where.brandId = brandId as string;
    }

    if (vendorId) {
      where.vendorId = vendorId as string;
    }

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) {
        where.price.gte = parseFloat(minPrice as string);
      }
      if (maxPrice) {
        where.price.lte = parseFloat(maxPrice as string);
      }
    }

    if (minRating) {
      where.ratingAvg = {
        gte: parseFloat(minRating as string),
      };
    }

    if (search) {
      // L-08 Fix: cap search term length to prevent full-table-scan DoS
      const searchTerm = String(search).slice(0, 100);
      where.OR = [
        { name: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { sku: { contains: searchTerm } },
      ];
    }

    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sort) {
      case 'price_low':
        orderBy = { price: 'asc' };
        break;
      case 'price_high':
        orderBy = { price: 'desc' };
        break;
      case 'rating':
        orderBy = { ratingAvg: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'relevance':
      default:
        orderBy = { ratingAvg: 'desc' };
        break;
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          vendor: {
            select: {
              id: true,
              storeName: true,
              slug: true,
              rating: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
        orderBy,
        skip,
        take: limitNum,
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
};

export const getProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        vendor: {
          select: {
            id: true,
            storeName: true,
            slug: true,
            rating: true,
            description: true,
          },
        },
        category: {
          include: {
            parent: true,
          },
        },
        brand: true,
        variants: {
          where: { status: true },
          orderBy: { isDefault: 'desc' },
        },
        reviews: {
          take: 5,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Get similar products
    const similarProducts = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
        status: 'ACTIVE',
      },
      take: 8,
      include: {
        vendor: {
          select: {
            storeName: true,
            slug: true,
          },
        },
      },
      orderBy: {
        ratingAvg: 'desc',
      },
    });

    // Parse variants attributes
    const productWithParsedVariants = {
      ...product,
      variants: product.variants.map(v => ({
        ...v,
        attributes: typeof v.attributes === 'string' ? JSON.parse(v.attributes) : v.attributes,
      })),
    };

    res.json({
      product: productWithParsedVariants,
      similarProducts,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
};

export const getProductReviews = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { productId: product.id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limitNum,
      }),
      prisma.review.count({
        where: { productId: product.id },
      }),
    ]);

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const createProductReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { slug } = req.params;

    // H-04 Fix: Validate review body with Zod (consistent with rest of codebase)
    const reviewSchema = z.object({
      rating: z.number({ required_error: 'Rating is required' }).int().min(1).max(5),
      title: z.string().max(200).optional(),
      comment: z.string().max(2000).optional(),
      images: z.array(z.string().url()).max(5).optional(),
    });

    let reviewData: z.infer<typeof reviewSchema>;
    try {
      reviewData = reviewSchema.parse(req.body);
    } catch (zodErr) {
      if (zodErr instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid review data', details: zodErr.errors });
      }
      throw zodErr;
    }

    const { rating, title, comment, images } = reviewData;

    // Find product
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await prisma.review.findUnique({
      where: {
        productId_userId: {
          productId: product.id,
          userId: req.user.id,
        },
      },
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        productId: product.id,
        userId: req.user.id,
        rating: rating,
        title: title || null,
        comment: comment || null,
        images: images ? JSON.stringify(images) : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });

    // Update product rating average and count
    const allReviews = await prisma.review.findMany({
      where: { productId: product.id },
      select: { rating: true },
    });

    const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
    const ratingCount = allReviews.length;

    await prisma.product.update({
      where: { id: product.id },
      data: {
        ratingAvg: avgRating,
        ratingCount: ratingCount,
      },
    });

    res.status(201).json({ review });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
};

