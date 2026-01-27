import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';

const bannerSchema = z.object({
  title: z.string().optional(),
  imageUrl: z.string().min(1), // Allow both full URLs and relative paths like /imgs/...
  linkUrl: z.string().optional(),
  type: z.enum(['HERO', 'PROMO']).default('PROMO'),
  orderIndex: z.number().int().default(0),
  status: z.boolean().default(true),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const getBanners = async (req: Request, res: Response) => {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: {
        orderIndex: 'asc',
      },
    });

    res.json({ banners });
  } catch (error) {
    console.error('Error fetching banners:', error);
    res.status(500).json({ error: 'Failed to fetch banners' });
  }
};

export const getBannerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    res.json({ banner });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching banner:', error);
    res.status(500).json({ error: 'Failed to fetch banner' });
  }
};

export const createBanner = async (req: Request, res: Response) => {
  try {
    const bannerData = bannerSchema.parse(req.body);

    const banner = await prisma.banner.create({
      data: {
        ...bannerData,
        startDate: bannerData.startDate ? new Date(bannerData.startDate) : null,
        endDate: bannerData.endDate ? new Date(bannerData.endDate) : null,
      },
    });

    res.status(201).json({ banner });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error creating banner:', error);
    res.status(500).json({ error: 'Failed to create banner' });
  }
};

export const updateBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = bannerSchema.partial().parse(req.body);

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    const data: any = { ...updateData };
    if (updateData.startDate) {
      data.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      data.endDate = new Date(updateData.endDate);
    }

    const updated = await prisma.banner.update({
      where: { id },
      data,
    });

    res.json({ banner: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating banner:', error);
    res.status(500).json({ error: 'Failed to update banner' });
  }
};

export const deleteBanner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const banner = await prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundError('Banner not found');
    }

    await prisma.banner.delete({
      where: { id },
    });

    res.json({ message: 'Banner deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting banner:', error);
    res.status(500).json({ error: 'Failed to delete banner' });
  }
};

