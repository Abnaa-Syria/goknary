import { Category } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Unlimited-depth categories on the existing `parentId` self relation. The whole table is read in one
 * query and the hierarchy is resolved in memory, so no lookup ever runs per node or per level.
 * Every walk tracks visited ids, so a cycle that already exists in the data cannot loop forever.
 */
export type CategoryNode = Category & { children: CategoryNode[] };

export const loadAllCategories = () => prisma.category.findMany();

const bySiblingOrder = (a: Category, b: Category) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name);

const groupByParent = (categories: Category[]) => {
  const ids = new Set(categories.map((c) => c.id));
  const children = new Map<string | null, Category[]>();
  for (const category of categories) {
    // A parent that no longer exists is treated as top level instead of hiding the category.
    const key = category.parentId && ids.has(category.parentId) ? category.parentId : null;
    const list = children.get(key);
    if (list) list.push(category);
    else children.set(key, [category]);
  }
  children.forEach((list) => list.sort(bySiblingOrder));
  return children;
};

/** Roots (or the subtree under `rootId`) with nested, orderIndex-sorted `children`. */
export const buildCategoryTree = (categories: Category[], rootId: string | null = null): CategoryNode[] => {
  const children = groupByParent(categories);
  const visited = new Set<string>();
  const build = (parentId: string | null): CategoryNode[] =>
    (children.get(parentId) ?? [])
      .filter((category) => {
        if (visited.has(category.id)) return false;
        visited.add(category.id);
        return true;
      })
      .map((category) => ({ ...category, children: build(category.id) }));
  return build(rootId);
};

/** The given ids plus every category below them, at any depth. */
export const getDescendantCategoryIds = (categories: Category[], rootIds: string[]): string[] => {
  const children = groupByParent(categories);
  const result = new Set<string>();
  const queue = [...rootIds];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (result.has(id)) continue;
    result.add(id);
    for (const child of children.get(id) ?? []) queue.push(child.id);
  }
  return Array.from(result);
};

/** Ancestors from the top-level category down to the direct parent (excludes the category itself). */
export const getCategoryAncestors = (categories: Category[], categoryId: string): Category[] => {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const ancestors: Category[] = [];
  const visited = new Set<string>([categoryId]);
  let parentId = byId.get(categoryId)?.parentId ?? null;
  while (parentId && !visited.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    visited.add(parentId);
    ancestors.unshift(parent);
    parentId = parent.parentId;
  }
  return ancestors;
};

/** True when `parentId` is the category itself or one of its descendants. */
export const wouldCreateCategoryCycle = (categories: Category[], categoryId: string, parentId: string) =>
  getDescendantCategoryIds(categories, [categoryId]).includes(parentId);
