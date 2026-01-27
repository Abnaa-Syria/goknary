import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';

const categorySchema = z.object({
  name: z.string().min(1),
  nameAr: z.string().optional(), // Arabic name
  description: z.string().optional(),
  descriptionAr: z.string().optional(), // Arabic description
  image: z.string().optional(),
  parentId: z.string().nullable().optional(),
  orderIndex: z.number().int().default(0),
});

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      include: {
        parent: true,
        children: true,
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    res.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    res.json({ category });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

export const createCategory = async (req: Request, res: Response) => {
  try {
    const categoryData = categorySchema.parse(req.body);
    const slug = slugify(categoryData.name);

    // Check if slug exists
    const existing = await prisma.category.findUnique({
      where: { slug },
    });

    if (existing) {
      return res.status(400).json({ error: 'Category name already exists' });
    }

    // Prepare data - only include parentId if it has a value
    const createData: any = {
      name: categoryData.name,
      nameAr: categoryData.nameAr || null,
      slug,
      description: categoryData.description,
      descriptionAr: categoryData.descriptionAr || null,
      image: categoryData.image,
      orderIndex: categoryData.orderIndex || 0,
    };

    // Only add parentId if it's a valid non-empty string
    if (categoryData.parentId && categoryData.parentId.trim() !== '') {
      createData.parentId = categoryData.parentId;
    }

    const category = await prisma.category.create({
      data: createData,
      include: {
        parent: true,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = categorySchema.partial().parse(req.body);

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // Handle slug update if name changes
    if (updateData.name && updateData.name !== category.name) {
      const newSlug = slugify(updateData.name);
      const existing = await prisma.category.findUnique({
        where: { slug: newSlug },
      });

      if (existing && existing.id !== id) {
        return res.status(400).json({ error: 'Category name already exists' });
      }

      (updateData as any).slug = newSlug;
    }

    const updated = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    res.json({ category: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Failed to update category' });
  }
};

export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        children: true,
        products: true,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category.children.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category with subcategories' });
    }

    if (category.products.length > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products' });
    }

    await prisma.category.delete({
      where: { id },
    });

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Failed to delete category' });
  }
};

