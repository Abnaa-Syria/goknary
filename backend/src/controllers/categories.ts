import { Request, Response } from 'express';
import { NotFoundError } from '../lib/errors';
import {
  buildCategoryTree,
  getCategoryAncestors,
  getDescendantCategoryIds,
  loadAllCategories,
} from '../lib/category-tree';

/**
 * Top-level categories with nested `children` at every depth. Same shape as before (roots with a
 * `children` array); deeper levels simply carry their own `children` now.
 */
export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await loadAllCategories();
    res.json(buildCategoryTree(categories));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

/**
 * One category with its parent, ancestors (top level → parent, for breadcrumbs), nested children and
 * siblings. `?include=descendants` adds every category id below it.
 */
export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const categories = await loadAllCategories();
    const category = categories.find((c) => c.slug === slug);
    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const ancestors = getCategoryAncestors(categories, category.id);
    const parent = ancestors[ancestors.length - 1] ?? null;
    const siblings = parent ? buildCategoryTree(categories, parent.id).filter((c) => c.id !== category.id) : [];

    res.json({
      ...category,
      parent,
      ancestors,
      children: buildCategoryTree(categories, category.id),
      siblings,
      ...(req.query.include === 'descendants'
        ? { descendantIds: getDescendantCategoryIds(categories, [category.id]).filter((id) => id !== category.id) }
        : {}),
    });
  } catch (error: any) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Failed to fetch category' });
  }
};
