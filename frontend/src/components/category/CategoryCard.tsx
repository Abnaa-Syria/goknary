import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Category } from '../../store/slices/categorySlice';

interface CategoryCardProps {
  category: Category;
}

const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const imageUrl = category.image || '/imgs/default-category.jpg';
  const categoryName = isRTL && (category as any).nameAr ? (category as any).nameAr : category.name;

  return (
    <Link
      to={`/category/${category.slug}`}
      className="card p-3 sm:p-4 text-center hover:shadow-card-hover transition-all duration-200 group"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 mx-auto mb-2 sm:mb-3 rounded-full overflow-hidden bg-gray-100">
        <img
          src={imageUrl}
          alt={categoryName}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
          onError={(e) => {
            (e.target as HTMLImageElement).src = '/imgs/default-category.jpg';
          }}
        />
      </div>
      <h3 className="font-medium text-xs sm:text-sm text-gray-900 line-clamp-2">{categoryName}</h3>
      {category.children && category.children.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {category.children.length} {isRTL ? 'فئة فرعية' : 'subcategories'}
        </p>
      )}
    </Link>
  );
};

export default CategoryCard;
