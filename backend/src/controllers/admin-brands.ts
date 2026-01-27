import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

const brandSchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(), // Arabic name
  description: z.string().optional(),
  descriptionAr: z.string().optional(), // Arabic description
  logo: z.string().optional(),
});

export const getBrands = async (req: Request, res: Response) => {
  try {
    const brands = await prisma.brand.findMany({
      orderBy: {
        name: 'asc',
      },
    });

    res.json({ brands });
  } catch (error) {
    console.error('Error fetching brands:', error);
    res.status(500).json({ error: 'Failed to fetch brands' });
  }
};

export const getBrandById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    res.json({ brand });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching brand:', error);
    res.status(500).json({ error: 'Failed to fetch brand' });
  }
};

export const createBrand = async (req: Request, res: Response) => {
  try {
    const brandData = brandSchema.parse(req.body);
    const slug = slugify(brandData.name);

    // Check if slug exists
    const existing = await prisma.brand.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Brand name already exists' });
    }

    const brand = await prisma.brand.create({
      data: {
        ...brandData,
        slug,
      },
    });

    res.status(201).json({ brand });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error creating brand:', error);
    res.status(500).json({ error: 'Failed to create brand' });
  }
};

export const updateBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = brandSchema.partial().parse(req.body);

    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // Handle slug update if name changes
    if (updateData.name && updateData.name !== brand.name) {
      const newSlug = slugify(updateData.name);
      const existing = await prisma.brand.findUnique({
        where: { slug: newSlug },
      });

      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Brand name already exists' });
      }

      (updateData as any).slug = newSlug;
    }

    const updated = await prisma.brand.update({
      where: { id },
      data: updateData,
    });

    res.json({ brand: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating brand:', error);
    res.status(500).json({ error: 'Failed to update brand' });
  }
};

export const deleteBrand = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    if (brand.products.length > 0) {
      return res.status(400).json({ error: 'Cannot delete brand with products' });
    }

    await prisma.brand.delete({
      where: { id },
    });

    res.json({ message: 'Brand deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting brand:', error);
    res.status(500).json({ error: 'Failed to delete brand' });
  }
};

