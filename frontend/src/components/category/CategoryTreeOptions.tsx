import React from 'react';
import { useTranslation } from 'react-i18next';
import { CategoryLike, flattenCategoryTree, getCategoryLabel } from '../../utils/categoryTree';

interface Props {
  tree: CategoryLike[];
  /** Hide this category and its subcategories (parent picker). */
  excludeId?: string;
}

/** `<option>`s for a category tree, indented by depth, e.g. Furniture / └ Bedroom / └ Beds. */
const CategoryTreeOptions: React.FC<Props> = ({ tree, excludeId }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  return (
    <>
      {flattenCategoryTree(tree, excludeId).map(({ category, depth }) => (
        <option key={category.id} value={category.id}>
          {depth > 0 ? `${'\u00A0\u00A0\u00A0'.repeat(depth)}└ ` : ''}
          {getCategoryLabel(category, isRTL)}
        </option>
      ))}
    </>
  );
};

export default CategoryTreeOptions;
