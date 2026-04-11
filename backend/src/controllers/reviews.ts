import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import { NotFoundError, ValidationError, ForbiddenError } from '../lib/errors';
import { z } from 'zod';

const reviewSchema = z.object({
  productId: z.string(),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  comment: z.string().optional(),
  images: z.string().optional(),
});

export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.user.id;
    const { productId, rating, title, comment, images } = reviewSchema.parse(req.body);

    // Verify user has purchased the product
    const orderItem = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: 'DELIVERED',
        },
      },
    });

    if (!orderItem) {
      return res.status(403).json({ error: 'You can only review products you have purchased and received' });
    }

    // Check for existing review
    const existingReview = await prisma.review.findUnique({
      where: {
        productId_userId: { productId, userId },
      },
    });

    if (existingReview) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    const review = await prisma.$transaction(async (tx) => {
      const createdReview = await tx.review.create({
        data: {
          productId,
          userId,
          rating,
          title,
          comment,
          images,
        },
      });

      // Update product rating stats
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { ratingAvg: true, ratingCount: true },
      });

      if (product) {
        const newCount = product.ratingCount + 1;
        const newAvg = (product.ratingAvg * product.ratingCount + rating) / newCount;

        await tx.product.update({
          where: { id: productId },
          data: {
            ratingAvg: newAvg,
            ratingCount: newCount,
          },
        });
      }

      return createdReview;
    });

    res.status(201).json({ review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error creating review:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
};

export const updateReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;
    const { rating, title, comment, images } = reviewSchema.partial().parse(req.body);

    const review = await prisma.review.findFirst({
      where: { id, userId },
    });

    if (!review) {
      throw new NotFoundError('Review not found or not owned by you');
    }

    const updatedReview = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id },
        data: { rating, title, comment, images },
      });

      // Update product rating stats if rating changed
      if (rating && rating !== review.rating) {
        const product = await tx.product.findUnique({
          where: { id: review.productId },
          select: { ratingAvg: true, ratingCount: true },
        });

        if (product) {
          const newAvg = (product.ratingAvg * product.ratingCount - review.rating + rating) / product.ratingCount;
          await tx.product.update({
            where: { id: review.productId },
            data: { ratingAvg: newAvg },
          });
        }
      }

      return updated;
    });

    res.json({ review: updatedReview });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating review:', error);
    res.status(500).json({ error: 'Failed to update review' });
  }
};

export const deleteReview = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    const userId = req.user.id;

    const review = await prisma.review.findFirst({
      where: { id, userId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });

      // Update product rating stats
      const product = await tx.product.findUnique({
        where: { id: review.productId },
        select: { ratingAvg: true, ratingCount: true },
      });

      if (product && product.ratingCount > 0) {
        const newCount = product.ratingCount - 1;
        const newAvg = newCount > 0 
          ? (product.ratingAvg * product.ratingCount - review.rating) / newCount 
          : 0;

        await tx.product.update({
          where: { id: review.productId },
          data: {
            ratingAvg: newAvg,
            ratingCount: newCount,
          },
        });
      }
    });

    res.json({ message: 'Review deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting review:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};

export const getAdminReviews = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        include: {
          user: { select: { name: true, email: true } },
          product: { select: { name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.review.count(),
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
  } catch (error) {
    console.error('Error fetching admin reviews:', error);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
};

export const deleteAdminReview = async (req: AuthRequest, res: Response) => {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access only' });
    }

    const { id } = req.params;

    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundError('Review not found');

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });

      const product = await tx.product.findUnique({
        where: { id: review.productId },
        select: { ratingAvg: true, ratingCount: true },
      });

      if (product && product.ratingCount > 0) {
        const newCount = product.ratingCount - 1;
        const newAvg = newCount > 0 
          ? (product.ratingAvg * product.ratingCount - review.rating) / newCount 
          : 0;

        await tx.product.update({
          where: { id: review.productId },
          data: {
            ratingAvg: newAvg,
            ratingCount: newCount,
          },
        });
      }
    });

    res.json({ message: 'Review deleted by admin' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error in admin review deletion:', error);
    res.status(500).json({ error: 'Failed to delete review' });
  }
};
