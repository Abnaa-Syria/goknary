import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { z } from 'zod';
import { slugify } from '../lib/utils';
import { loadAllCategories, wouldCreateCategoryCycle } from '../lib/category-tree';

const categorySchema = z.object({
  name: z.string().trim().min(1),
  nameAr: z.string().optional().nullable(), // Arabic name
  slug: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  descriptionAr: z.string().optional().nullable(), // Arabic description
  image: z.string().optional().nullable(),
  parentId: z.string().nullable().optional(),
  orderIndex: z.coerce.number().int().optional(),
});

const SLUG_TAKEN = 'Category slug is already in use';

const isUniqueConstraintError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

const emptyToNull = (value: string | null | undefined) => (value && value.trim() ? value : null);

/** Valid parent id, null for top level, or an error message. */
const resolveParent = async (
  categoryId: string | null,
  rawParentId: string | null | undefined,
): Promise<{ parentId: string | null } | { error: string }> => {
  const parentId = rawParentId && rawParentId.trim() ? rawParentId.trim() : null;
  if (!parentId) return { parentId: null };

  const categories = await loadAllCategories();
  if (!categories.some((c) => c.id === parentId)) return { error: 'Parent category not found' };
  if (categoryId && wouldCreateCategoryCycle(categories, categoryId, parentId)) {
    return { error: 'A category cannot be moved under itself or one of its subcategories' };
  }
  return { parentId };
};

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
    const slug = slugify(categoryData.slug?.trim() || categoryData.name);
    if (!slug) return res.status(400).json({ error: 'Category slug is invalid' });

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) {
      return res.status(409).json({ error: SLUG_TAKEN });
    }

    const parent = await resolveParent(null, categoryData.parentId);
    if ('error' in parent) return res.status(400).json({ error: parent.error });

    const category = await prisma.category.create({
      data: {
        name: categoryData.name,
        nameAr: emptyToNull(categoryData.nameAr),
        slug,
        description: emptyToNull(categoryData.description),
        descriptionAr: emptyToNull(categoryData.descriptionAr),
        image: emptyToNull(categoryData.image),
        orderIndex: categoryData.orderIndex ?? 0,
        parentId: parent.parentId,
      },
      include: {
        parent: true,
      },
    });

    res.status(201).json({ category });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: SLUG_TAKEN });
    }
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category' });
  }
};

/** Only fields present in the body change; omitted fields (image, orderIndex, ...) keep their value. */
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const input = categorySchema.partial().parse(req.body);

    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const data: Prisma.CategoryUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.nameAr !== undefined) data.nameAr = emptyToNull(input.nameAr);
    if (input.description !== undefined) data.description = emptyToNull(input.description);
    if (input.descriptionAr !== undefined) data.descriptionAr = emptyToNull(input.descriptionAr);
    if (input.image !== undefined) data.image = emptyToNull(input.image);
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;

    if (input.parentId !== undefined) {
      const parent = await resolveParent(id, input.parentId);
      if ('error' in parent) return res.status(400).json({ error: parent.error });
      data.parentId = parent.parentId;
    }

    // An explicit slug wins; an empty one is regenerated from the name; otherwise a rename regenerates it.
    let newSlug: string | undefined;
    if (input.slug !== undefined) {
      newSlug = slugify(input.slug?.trim() || input.name || category.name);
    } else if (input.name && input.name !== category.name) {
      newSlug = slugify(input.name);
    }
    if (newSlug !== undefined && newSlug !== category.slug) {
      if (!newSlug) return res.status(400).json({ error: 'Category slug is invalid' });
      const existing = await prisma.category.findUnique({ where: { slug: newSlug } });
      if (existing && existing.id !== id) {
        return res.status(409).json({ error: SLUG_TAKEN });
      }
      data.slug = newSlug;
    }

    const updated = await prisma.category.update({
      where: { id },
      data,
    });

    res.json({ category: updated });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (isUniqueConstraintError(error)) {
      return res.status(409).json({ error: SLUG_TAKEN });
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
        _count: { select: { children: true, products: true } },
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    if (category._count.children > 0) {
      return res.status(400).json({ error: 'Cannot delete category with subcategories. Move or delete them first.' });
    }

    if (category._count.products > 0) {
      return res.status(400).json({ error: 'Cannot delete category with products. Move the products to another category first.' });
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
