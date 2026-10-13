export interface CategoryLike {
  id: string;
  name: string;
  nameAr?: string | null;
  parentId?: string | null;
  orderIndex?: number;
  children?: CategoryLike[];
}

export const getCategoryLabel = (category: { name: string; nameAr?: string | null }, isRTL: boolean) =>
  isRTL && category.nameAr ? category.nameAr : category.name;

/** Nested tree from a flat list (admin API). A missing parent makes the category top level. */
export const buildCategoryTree = <T extends CategoryLike>(flat: T[]): Array<T & { children: T[] }> => {
  const ids = new Set(flat.map((c) => c.id));
  const nodes = new Map<string, T & { children: T[] }>(flat.map((c) => [c.id, { ...c, children: [] as T[] }]));
  const roots: Array<T & { children: T[] }> = [];
  nodes.forEach((node) => {
    if (node.parentId && ids.has(node.parentId) && node.parentId !== node.id) nodes.get(node.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sort = (list: CategoryLike[]) => {
    list.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name));
    list.forEach((child) => child.children && sort(child.children));
  };
  sort(roots);
  return roots;
};

/**
 * Depth-first list of a tree for indented selects. `excludeId` drops that category and everything
 * below it (used when choosing a parent, so a category cannot be moved under itself).
 */
export const flattenCategoryTree = <T extends CategoryLike>(tree: T[], excludeId?: string) => {
  const result: Array<{ category: T; depth: number }> = [];
  const visited = new Set<string>();
  const walk = (nodes: CategoryLike[], depth: number) => {
    nodes.forEach((node) => {
      if (node.id === excludeId || visited.has(node.id)) return;
      visited.add(node.id);
      result.push({ category: node as T, depth });
      if (node.children?.length) walk(node.children, depth + 1);
    });
  };
  walk(tree, 0);
  return result;
};

/** Root → selected category, e.g. [Electronics, Audio, Headphones]; empty when the id is not in the tree. */
export const findCategoryPath = <T extends CategoryLike>(tree: T[], id: string): T[] => {
  const walk = (nodes: CategoryLike[], trail: CategoryLike[]): CategoryLike[] | null => {
    for (const node of nodes) {
      const next = [...trail, node];
      if (node.id === id) return next;
      const found = node.children?.length ? walk(node.children, next) : null;
      if (found) return found;
    }
    return null;
  };
  return (id ? walk(tree, []) ?? [] : []) as T[];
};

export const findCategoryInTree = <T extends CategoryLike>(tree: T[], id: string): T | undefined => {
  for (const { category } of flattenCategoryTree(tree)) {
    if (category.id === id) return category;
  }
  return undefined;
};
