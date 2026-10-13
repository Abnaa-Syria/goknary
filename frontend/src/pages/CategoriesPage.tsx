import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { Category, fetchCategories } from '../store/slices/categorySlice';
import { SEO } from '../components/common/SEO';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { CategoryCardSkeleton } from '../components/common/Skeleton';
import { IMAGE_PLACEHOLDER, getImageUrl } from '../utils/image';
import { getCategoryLabel } from '../utils/categoryTree';

const SubcategoryList: React.FC<{ nodes: Category[]; isRTL: boolean; depth?: number }> = ({ nodes, isRTL, depth = 0 }) => (
  <ul className={depth > 0 ? 'ms-3 ps-3 border-s border-gray-100' : 'space-y-1'}>
    {nodes.map((node) => (
      <li key={node.id}>
        <Link
          to={`/category/${node.slug}`}
          className={`block py-1 hover:text-primary-600 transition-colors ${depth === 0 ? 'text-sm text-gray-700' : 'text-xs text-gray-500'}`}
        >
          {getCategoryLabel(node, isRTL)}
        </Link>
        {node.children && node.children.length > 0 && (
          <SubcategoryList nodes={node.children} isRTL={isRTL} depth={depth + 1} />
        )}
      </li>
    ))}
  </ul>
);

const CategoriesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const { categories, loading } = useAppSelector((state) => state.categories);

  useEffect(() => {
    if (categories.length === 0) dispatch(fetchCategories());
  }, [dispatch, categories.length]);

  const title = t('nav.allCategories', isRTL ? 'كل الفئات' : 'All Categories');

  return (
    <>
      <SEO title={title} description={isRTL ? 'تصفح كل فئات GoKnary' : 'Browse every category on GoKnary'} />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <Breadcrumbs items={[{ label: title }]} />
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-6">{title}</h1>

        {loading && categories.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <CategoryCardSkeleton key={i} />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <p className="text-center py-12 text-gray-500">{isRTL ? 'لا توجد فئات' : 'No categories yet'}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {categories.map((category) => {
              const name = getCategoryLabel(category, isRTL);
              return (
                <div key={category.id} className="card p-4 sm:p-5">
                  <Link to={`/category/${category.slug}`} className="flex items-center gap-3 group mb-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      <img
                        src={getImageUrl(category.image || IMAGE_PLACEHOLDER)}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
                        }}
                      />
                    </div>
                    <h2 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{name}</h2>
                  </Link>
                  {category.children && category.children.length > 0 && (
                    <SubcategoryList nodes={category.children} isRTL={isRTL} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default CategoriesPage;
