import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';


export const getProducts = async (req: Request, res: Response) => {
  try {
    const {
      q,
      category,
      brand,
      vendorId,
      priceMin,
      priceMax,
      rating,
      sort = 'relevance',
      page = '1',
      limit = '24',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.max(1, parseInt(limit as string, 10));
    const skip = (pageNum - 1) * limitNum;

    // Use AND to combine different filter groups safely
    const and: Prisma.ProductWhereInput[] = [
      { status: { in: ['ACTIVE' as any, 'APPROVED' as any] } }
    ];

    // Category filtering
    if (category) {
      const categoryList = (Array.isArray(category) ? category : [category]) as string[];
      and.push({ categoryId: { in: categoryList } });
    }

    // Brand filtering
    if (brand) {
      const brandList = (Array.isArray(brand) ? brand : [brand]) as string[];
      and.push({ brandId: { in: brandList } });
    }

    if (vendorId) {
      and.push({ vendorId: vendorId as string });
    }

    // Advanced Price Filtering (Strict Parsing)
    if (priceMin || priceMax) {
      const pMin = priceMin ? Number(priceMin) : NaN;
      const pMax = priceMax ? Number(priceMax) : NaN;
      
      const priceFilter: Prisma.FloatFilter = {};
      if (!isNaN(pMin)) priceFilter.gte = pMin;
      if (!isNaN(pMax)) priceFilter.lte = pMax;
      
      if (Object.keys(priceFilter).length > 0) {
        and.push({ price: priceFilter });
      }
    }

    // Rating (Strict Parsing)
    const ratingNum = rating ? Number(rating) : NaN;
    if (!isNaN(ratingNum)) {
      and.push({ ratingAvg: { gte: ratingNum } });
    }

    // Search Query (Wrapped in OR, but pushed to AND array)
    if (q) {
      const searchTerm = String(q).slice(0, 100);
      and.push({
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ]
      });
    }

    const where: Prisma.ProductWhereInput = { AND: and };

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
      default:
        orderBy = { createdAt: 'desc' };
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
      totalCount: total,
      pagination: {
        totalCount: total,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to synchronize product catalog' });
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

