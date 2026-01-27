import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';

export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      where: {
        parentId: null, // Only top-level categories
      },
      include: {
        children: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
      orderBy: {
        orderIndex: 'asc',
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        parent: {
          include: {
            children: {
              orderBy: {
                orderIndex: 'asc',
              },
            },
          },
        },
        children: {
          orderBy: {
            orderIndex: 'asc',
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    // If this category has a parent, include siblings (other children of parent)
    const siblings = category.parent?.children?.filter(c => c.id !== category.id) || [];

    res.json({
      ...category,
      siblings,
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};

