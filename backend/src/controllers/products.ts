import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { expandWithSynonyms } from '../config/search-synonyms';

const getArabicVariations = (term: string): string[] => {
  const variations = new Set<string>();
  variations.add(term);

  const normalizeAlifs = (str: string) => str.replace(/[أإآٱ]/g, 'ا');
  const normalizeTaMarbuta = (str: string) => str.replace(/ة/g, 'ه');
  const normalizeYa = (str: string) => str.replace(/ى/g, 'ي');

  const normalizedAll = normalizeYa(normalizeTaMarbuta(normalizeAlifs(term)));
  variations.add(normalizedAll);

  const alt1 = term.replace(/[أإآٱ]/g, 'ا');
  variations.add(alt1);
  const alt2 = term.replace(/ة/g, 'ه');
  variations.add(alt2);
  const alt3 = term.replace(/ى/g, 'ي');
  variations.add(alt3);
  
  if (term.startsWith('ا')) {
    const rest = term.slice(1);
    variations.add('أ' + rest);
    variations.add('إ' + rest);
    variations.add('آ' + rest);
  }
  if (term.endsWith('ه')) {
    variations.add(term.slice(0, -1) + 'ة');
  }
  if (term.endsWith('ة')) {
    variations.add(term.slice(0, -1) + 'ه');
  }
  if (term.endsWith('ي')) {
    variations.add(term.slice(0, -1) + 'ى');
  }
  if (term.endsWith('ى')) {
    variations.add(term.slice(0, -1) + 'ي');
  }

  return Array.from(variations);
};

const getRelevanceScore = (product: any, terms: string[]): number => {
  let score = 0;
  for (const term of terms) {
    const termLower = term.toLowerCase();

    const nameLower = (product.name || '').toLowerCase();
    const nameArLower = (product.nameAr || '').toLowerCase();
    const descLower = (product.description || '').toLowerCase();
    const descArLower = (product.descriptionAr || '').toLowerCase();
    const brandNameLower = (product.brand?.name || '').toLowerCase();
    const brandNameArLower = (product.brand?.nameAr || '').toLowerCase();
    const categoryNameLower = (product.category?.name || '').toLowerCase();
    const categoryNameArLower = (product.category?.nameAr || '').toLowerCase();
    const skuLower = (product.sku || '').toLowerCase();

    if (nameLower.startsWith(termLower) || nameArLower.startsWith(termLower)) {
      score += 100;
    } else if (nameLower.includes(termLower) || nameArLower.includes(termLower)) {
      score += 50;
    }

    if (brandNameLower.includes(termLower) || brandNameArLower.includes(termLower)) {
      score += 30;
    }

    if (categoryNameLower.includes(termLower) || categoryNameArLower.includes(termLower)) {
      score += 20;
    }

    if (descLower.includes(termLower) || descArLower.includes(termLower)) {
      score += 10;
    }

    if (skuLower.includes(termLower)) {
      score += 5;
    }
  }
  return score;
};

export const getProducts = async (req: Request, res: Response) => {
  try {
    const qRaw = req.query.q !== undefined ? req.query.q : req.query.search;
    const {
      category,
      categoryId,
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
      { status: { in: ['ACTIVE' as any, 'APPROVED' as any] } },
      { vendor: { status: 'APPROVED' } }
    ];

    // Category filtering (supports both category and categoryId)
    const categoryFilter = categoryId || category;
    if (categoryFilter) {
      const categoryList = (Array.isArray(categoryFilter) ? categoryFilter : [categoryFilter]) as string[];
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

    // Search query parameter provided
    const isSearch = qRaw !== undefined;
    let qTrimmed = '';
    let allSearchTerms: string[] = [];

    if (isSearch) {
      qTrimmed = String(qRaw).trim();
      
      // If query is empty or whitespace-only, return empty results immediately
      if (!qTrimmed) {
        return res.json({
          products: [],
          totalCount: 0,
          pagination: {
            totalCount: 0,
            currentPage: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        });
      }

      // Sanitize input (strip special characters, cap at 100 characters)
      const sanitizedQuery = qTrimmed
        .replace(/[%_\\/()*+?{}|\[\]^$-]/g, '')
        .trim()
        .slice(0, 100);

      if (!sanitizedQuery) {
        return res.json({
          products: [],
          totalCount: 0,
          pagination: {
            totalCount: 0,
            currentPage: pageNum,
            limit: limitNum,
            totalPages: 0,
          },
        });
      }

      // Expand synonyms
      const synonyms = expandWithSynonyms(sanitizedQuery);

      // Generate Arabic variations for each term
      const termsSet = new Set<string>();
      for (const syn of synonyms) {
        const variations = getArabicVariations(syn);
        variations.forEach(v => termsSet.add(v.toLowerCase()));
      }
      allSearchTerms = Array.from(termsSet);

      // Build OR conditions
      const orConditions: Prisma.ProductWhereInput[] = [];
      for (const term of allSearchTerms) {
        orConditions.push(
          { name: { contains: term } },
          { nameAr: { contains: term } },
          { description: { contains: term } },
          { descriptionAr: { contains: term } },
          { sku: { contains: term } },
          { brand: { name: { contains: term } } },
          { brand: { nameAr: { contains: term } } },
          { category: { name: { contains: term } } },
          { category: { nameAr: { contains: term } } }
        );
      }
      and.push({ OR: orConditions });
    }

    const where: Prisma.ProductWhereInput = { AND: and };

    // Fetch all candidates to perform in-memory weighted scoring and out-of-stock sorting
    const products = await prisma.product.findMany({
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
            nameAr: true,
            slug: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            nameAr: true,
            slug: true,
          },
        },
      },
    });

    // Score products in memory if searching
    const scores = new Map<string, number>();
    if (isSearch) {
      for (const p of products) {
        const score = getRelevanceScore(p, allSearchTerms);
        scores.set(p.id, score);
      }
    }

    // Sort products
    const getSortValue = (a: any, b: any, sortField: string) => {
      switch (sortField) {
        case 'price_low':
          return a.price - b.price;
        case 'price_high':
          return b.price - a.price;
        case 'rating':
          return b.ratingAvg - a.ratingAvg;
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    };

    products.sort((a, b) => {
      // 1. Stock = 0 goes to bottom
      const aOutOfStock = a.stock <= 0 ? 1 : 0;
      const bOutOfStock = b.stock <= 0 ? 1 : 0;
      if (aOutOfStock !== bOutOfStock) {
        return aOutOfStock - bOutOfStock;
      }

      // 2. Sort by score if search
      if (isSearch) {
        const scoreA = scores.get(a.id) || 0;
        const scoreB = scores.get(b.id) || 0;
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
      }

      // 3. Fallback to requested sort parameter
      return getSortValue(a, b, sort as string);
    });

    const totalCount = products.length;
    const paginatedProducts = products.slice(skip, skip + limitNum);

    // Asynchronous (Fire-and-forget) search logging
    if (isSearch && qTrimmed) {
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.substring(7);
          const secret = process.env.JWT_SECRET;
          if (secret) {
            const decoded = jwt.verify(token, secret) as { id: string };
            userId = decoded.id;
          }
        } catch {
          // Ignore token parsing issues so public search remains uninterrupted
        }
      }

      prisma.searchLog.create({
        data: {
          query: qTrimmed,
          results: totalCount,
          userId: userId,
        },
      }).catch(err => {
        console.error('Failed to log search query:', err);
      });
    }

    res.json({
      products: paginatedProducts,
      totalCount,
      pagination: {
        totalCount,
        currentPage: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
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
        status: { in: ['ACTIVE' as any, 'APPROVED' as any] },
        vendor: { status: 'APPROVED' },
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

