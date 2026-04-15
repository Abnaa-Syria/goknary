import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Category } from '../../store/slices/categorySlice';
import { getImageUrl } from '../../utils/image';

interface MegaMenuProps {
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
}

const MegaMenu: React.FC<MegaMenuProps> = ({ categories, isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [hoveredCategory, setHoveredCategory] = useState<Category | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Helper function to get localized category name
  const getCategoryName = (category: Category) => {
    return isRTL && (category as any).nameAr ? (category as any).nameAr : category.name;
  };

  // Get top-level categories (no parentId)
  const topLevelCategories = categories.filter((cat) => !cat.parentId);

  // Get subcategories for hovered category - use children if available, otherwise filter
  const subcategories = hoveredCategory
    ? (hoveredCategory.children || categories.filter((cat) => cat.parentId === hoveredCategory.id))
    : [];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Close on click outside (but not when clicking the button)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on the categories button or its parent
      if (target.closest('[data-categories-button]')) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        onClose();
      }
    };
    if (isOpen) {
      // Use setTimeout to avoid immediate close on button click
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Mega Menu */}
      <div
        ref={menuRef}
        className="mega-menu-container absolute left-0 right-0 bg-white shadow-xl z-50 border-t-2 border-primary-500 mt-0"
        style={{ top: '100%', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}
        role="menu"
        aria-label="Categories menu"
        onMouseEnter={() => {}} // Keep open on hover
      >
        <div className="container mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
            {/* Left: Top-level categories */}
            <div className="lg:col-span-3 lg:border-r lg:border-gray-200 lg:pr-6">
              <h3 className="text-base font-bold text-gray-900 mb-5 uppercase tracking-wide">
                {isRTL ? 'جميع الفئات' : 'All Categories'}
              </h3>
              <ul className="space-y-0.5">
                {topLevelCategories.slice(0, 10).map((category) => (
                  <li key={category.id}>
                    <Link
                      to={`/category/${category.slug}`}
                      className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-lg transition-all ${
                        hoveredCategory?.id === category.id
                          ? 'bg-primary-500 text-white shadow-md'
                          : 'text-gray-700 hover:bg-primary-50 hover:text-primary-600'
                      }`}
                      onMouseEnter={() => setHoveredCategory(category)}
                      onClick={onClose}
                    >
                      <span>{getCategoryName(category)}</span>
                      {(category.children && category.children.length > 0) && (
                        <svg className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Middle: Subcategories */}
            <div className="lg:col-span-5 lg:border-r lg:border-gray-200 lg:pr-6">
              {hoveredCategory ? (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{getCategoryName(hoveredCategory)}</h3>
                  {subcategories && subcategories.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {subcategories.map((subcat) => (
                        <Link
                          key={subcat.id}
                          to={`/category/${subcat.slug}`}
                          className="px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 rounded-lg transition-colors font-medium"
                          onClick={onClose}
                        >
                          {getCategoryName(subcat)}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8">
                      <p className="text-gray-500 mb-4">
                        {isRTL ? 'لا توجد فئات فرعية متاحة' : 'No subcategories available'}
                      </p>
                      <Link
                        to={`/category/${hoveredCategory.slug}`}
                        className="inline-block px-6 py-3 bg-primary-500 text-white text-sm font-semibold rounded-lg hover:bg-primary-600 transition-colors shadow-md hover:shadow-lg"
                        onClick={onClose}
                      >
                        {isRTL ? `عرض جميع ${getCategoryName(hoveredCategory)}` : `View All ${getCategoryName(hoveredCategory)}`}
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-2">👆</p>
                    <p className="text-sm text-gray-500">
                      {isRTL ? 'مرر فوق الفئة لرؤية الفئات الفرعية' : 'Hover over a category to see subcategories'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Right: Featured category tiles */}
            <div className="lg:col-span-4">
              <h3 className="text-base font-bold text-gray-900 mb-4 uppercase tracking-wide hidden lg:block">
                {isRTL ? 'الفئات المميزة' : 'Featured Categories'}
              </h3>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                {topLevelCategories.slice(0, 4).map((category) => {
                  const categoryName = getCategoryName(category);
                  return (
                    <Link
                      key={category.id}
                      to={`/category/${category.slug}`}
                      className="group relative overflow-hidden rounded-xl aspect-square bg-gray-100 hover:shadow-xl transition-all border border-gray-200"
                      onClick={onClose}
                    >
                      {category.image ? (
                        <img
                          src={getImageUrl(category.image)}
                          alt={categoryName}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-700 text-center px-2">{categoryName}</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                        <span className="text-white text-xs font-bold">{categoryName}</span>
                      </div>
                      <div className="absolute bottom-2 left-2 right-2">
                        <span className="block text-xs font-semibold text-gray-900 bg-white/90 backdrop-blur-sm px-2 py-1 rounded">{categoryName}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MegaMenu;

