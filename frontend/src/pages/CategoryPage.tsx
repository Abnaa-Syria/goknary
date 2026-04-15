import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCategoryBySlug } from '../store/slices/categorySlice';
import { fetchProducts, setFilters } from '../store/slices/productSlice';
import ProductCard from '../components/product/ProductCard';
import { ProductCardSkeleton } from '../components/common/Skeleton';
import { SEO } from '../components/common/SEO';
import Breadcrumbs from '../components/common/Breadcrumbs';
import { FiFilter, FiX } from 'react-icons/fi';

// Custom chevron icons
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ChevronUpIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const CategoryPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { currentCategory } = useAppSelector((state) => state.categories);
  const { products, loading, pagination, filters } = useAppSelector((state) => state.products);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState<string[]>(['price', 'rating']);
  const [priceRange, setPriceRange] = useState({
    min: searchParams.get('priceMin') || searchParams.get('minPrice') || '',
    max: searchParams.get('priceMax') || searchParams.get('maxPrice') || '',
  });

  // Helper to get localized category name
  const getCategoryName = (category: any | null | undefined) => {
    if (!category) return isRTL ? t('category.defaultName', 'الفئة') : t('category.defaultName', 'Category');
    return isRTL && category.nameAr ? category.nameAr : category.name;
  };

  useEffect(() => {
    if (slug) {
      dispatch(fetchCategoryBySlug(slug));
    }
  }, [slug, dispatch]);

  useEffect(() => {
    // Normalization layer for Backend Alignment
    const apiParams: any = {
      category: currentCategory?.id, // mapped from categoryId
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '24',
    };

    // Correct Sort Mapping
    let sortVal = searchParams.get('sort') || 'relevance';
    if (sortVal === 'price_desc') sortVal = 'price_high';
    if (sortVal === 'price_asc') sortVal = 'price_low';
    apiParams.sort = sortVal;

    // Correct Price Mapping
    const pMin = searchParams.get('priceMin') || searchParams.get('minPrice');
    if (pMin) apiParams.priceMin = pMin;
    
    const pMax = searchParams.get('priceMax') || searchParams.get('maxPrice');
    if (pMax) apiParams.priceMax = pMax;

    // Correct Rating Mapping
    const rating = searchParams.get('rating') || searchParams.get('minRating');
    if (rating) apiParams.rating = rating;

    // Correct Brand Mapping
    const brand = searchParams.get('brand') || searchParams.get('brandId');
    if (brand) apiParams.brand = brand;

    dispatch(setFilters(apiParams));
    dispatch(fetchProducts(apiParams));
  }, [currentCategory, searchParams, dispatch]);

  const toggleFilterSection = (section: string) => {
    setExpandedFilters((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
    );
  };

  const handleSortChange = (sort: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', sort);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const handlePriceFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    if (priceRange.min) {
      newParams.set('priceMin', priceRange.min);
      newParams.delete('minPrice');
    } else {
      newParams.delete('priceMin');
      newParams.delete('minPrice');
    }
    if (priceRange.max) {
      newParams.set('priceMax', priceRange.max);
      newParams.delete('maxPrice');
    } else {
      newParams.delete('priceMax');
      newParams.delete('maxPrice');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setPriceRange({ min: '', max: '' });
    setSearchParams({});
  };

  // Get active filters for display
  const activeFilters: string[] = [];
  if (searchParams.get('priceMin') || searchParams.get('priceMax') || searchParams.get('minPrice') || searchParams.get('maxPrice')) {
    activeFilters.push(isRTL ? 'السعر' : 'Price');
  }
  if (searchParams.get('rating') || searchParams.get('minRating')) {
    const ratingLabel = searchParams.get('rating') || searchParams.get('minRating');
    activeFilters.push(
      isRTL
        ? `تقييم ${ratingLabel}+`
        : `Rating ${ratingLabel}+`
    );
  }
  if (searchParams.get('brandId')) {
    activeFilters.push(isRTL ? 'العلامة التجارية' : 'Brand');
  }

  const breadcrumbItems = [
    // Add parent category if exists
    ...(currentCategory?.parent
      ? [{
          label: getCategoryName(currentCategory.parent),
          to: `/category/${currentCategory.parent.slug}`,
        }]
      : []),
    {
      label: getCategoryName(currentCategory),
      to: currentCategory ? `/category/${currentCategory.slug}` : undefined,
    },
  ];

  return (
    <>
      <SEO
        title={getCategoryName(currentCategory)}
        description={
          currentCategory?.description ||
          (isRTL
            ? `تسوّق ${getCategoryName(currentCategory)} على GoKnary`
            : `Browse ${getCategoryName(currentCategory)} on GoKnary`)
        }
      />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* Page Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            {getCategoryName(currentCategory)}
          </h1>
          {currentCategory?.description && (
            <p className="text-gray-600">{currentCategory.description}</p>
          )}
          {pagination && (
            <p className="text-sm text-gray-500 mt-2">
              {isRTL
                ? `${pagination.total} منتج`
                : `${pagination.total} products found`}
            </p>
          )}
        </div>

        {/* Subcategories Navigation */}
        {((currentCategory?.children && currentCategory.children.length > 0) || 
          (currentCategory?.siblings && currentCategory.siblings.length > 0)) && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <h3 className="font-semibold text-gray-900">
                {currentCategory?.children && currentCategory.children.length > 0 
                  ? (isRTL ? 'تصفح الفئات الفرعية' : 'Browse Subcategories')
                  : (isRTL ? 'فئات ذات صلة' : 'Related Categories')}
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {/* Show children if this is a parent category */}
              {currentCategory?.children && currentCategory.children.length > 0 && 
                currentCategory.children.map((child) => (
                  <Link
                    key={child.id}
                    to={`/category/${child.slug}`}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 shadow-sm"
                  >
                    {getCategoryName(child)}
                  </Link>
                ))
              }
              {/* Show siblings if this is a subcategory */}
              {currentCategory?.siblings && currentCategory.siblings.length > 0 && (
                <>
                  {currentCategory.parent && (
                    <Link
                      to={`/category/${currentCategory.parent.slug}`}
                      className="px-4 py-2 bg-primary-100 border border-primary-200 rounded-lg text-sm font-medium text-primary-700 hover:bg-primary-200 transition-all duration-200"
                    >
                      {isRTL
                        ? `← كل ${getCategoryName(currentCategory.parent)}`
                        : `← All ${getCategoryName(currentCategory.parent)}`}
                    </Link>
                  )}
                  {currentCategory.siblings.map((sibling) => (
                    <Link
                      key={sibling.id}
                      to={`/category/${sibling.slug}`}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 shadow-sm"
                      >
                        {getCategoryName(sibling)}
                    </Link>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* Active Filters Chips */}
        {activeFilters.length > 0 && (
          <div className="flex items-center flex-wrap gap-2 mb-4 pb-4 border-b border-gray-200">
          <span className="text-sm text-gray-600 font-medium">
            {isRTL ? 'الفلاتر المفعّلة:' : 'Active filters:'}
          </span>
            {activeFilters.map((filter, idx) => (
              <span
                key={idx}
                className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
              >
                {filter}
              </span>
            ))}
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium underline"
            >
            {isRTL ? 'مسح الكل' : 'Clear all'}
            </button>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 lg:gap-8">
          {/* Filters Sidebar */}
          <aside
            className={`${
              showFilters ? 'block fixed inset-0 z-50 bg-white overflow-y-auto lg:relative lg:inset-auto lg:z-auto' : 'hidden'
            } lg:block w-full lg:w-72 flex-shrink-0`}
          >
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 space-y-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-gray-900">
                  {isRTL ? 'الفلاتر' : 'Filters'}
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={isRTL ? 'إغلاق الفلاتر' : 'Close filters'}
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Price Filter */}
              <div className="border-b border-gray-200 pb-6">
                <button
                  onClick={() => toggleFilterSection('price')}
                  className="flex items-center justify-between w-full mb-4 font-semibold text-gray-900"
                >
                  <span>{isRTL ? 'السعر' : 'Price'}</span>
                  {expandedFilters.includes('price') ? (
                    <ChevronUpIcon />
                  ) : (
                    <ChevronDownIcon />
                  )}
                </button>
                {expandedFilters.includes('price') && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          {isRTL ? 'الحد الأدنى' : 'Min'}
                        </label>
                        <input
                          type="number"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">
                          {isRTL ? 'الحد الأقصى' : 'Max'}
                        </label>
                        <input
                          type="number"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                          placeholder="10000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={handlePriceFilter}
                      className="w-full px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                    >
                      {isRTL ? 'تطبيق' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              {/* Rating Filter */}
              <div className="border-b border-gray-200 pb-6">
                <button
                  onClick={() => toggleFilterSection('rating')}
                  className="flex items-center justify-between w-full mb-4 font-semibold text-gray-900"
                >
                  <span>{isRTL ? 'التقييم' : 'Rating'}</span>
                  {expandedFilters.includes('rating') ? (
                    <ChevronUpIcon />
                  ) : (
                    <ChevronDownIcon />
                  )}
                </button>
                {expandedFilters.includes('rating') && (
                  <div className="space-y-2">
                    {[4, 3, 2, 1].map((rating) => {
                      const isActive = searchParams.get('minRating') === rating.toString();
                      return (
                        <button
                          key={rating}
                          onClick={() => {
                            const newParams = new URLSearchParams(searchParams);
                            const currentRating = newParams.get('rating') || newParams.get('minRating');
                            const isActive = currentRating === rating.toString();
                            
                            if (isActive) {
                              newParams.delete('rating');
                              newParams.delete('minRating');
                            } else {
                              newParams.set('rating', rating.toString());
                              newParams.delete('minRating');
                            }
                            newParams.set('page', '1');
                            setSearchParams(newParams);
                          }}
                          className={`w-full ${isRTL ? 'text-right' : 'text-left'} px-3 py-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {isRTL ? `${rating}+ نجوم` : `${rating}+ stars`}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Clear Filters */}
              {activeFilters.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="w-full px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  {isRTL ? 'مسح كل الفلاتر' : 'Clear All Filters'}
                </button>
              )}
            </div>
          </aside>

          {/* Products Section */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              {/* Filter Toggle - Mobile */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FiFilter className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {isRTL ? 'الفلاتر' : 'Filters'}
                </span>
                {activeFilters.length > 0 && (
                  <span className="bg-primary-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {/* Sort */}
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <label className="text-sm text-gray-600 font-medium whitespace-nowrap">
                  {isRTL ? 'الترتيب حسب:' : 'Sort by:'}
                </label>
                <select
                  value={searchParams.get('sort') || 'relevance'}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm bg-white"
                >
                  <option value="relevance">
                    {isRTL ? 'الصلة' : 'Relevance'}
                  </option>
                  <option value="price_low">
                    {isRTL ? 'السعر: من الأقل للأعلى' : 'Price: Low to High'}
                  </option>
                  <option value="price_high">
                    {isRTL ? 'السعر: من الأعلى للأقل' : 'Price: High to Low'}
                  </option>
                  <option value="rating">
                    {isRTL ? 'أعلى تقييمًا' : 'Highest Rated'}
                  </option>
                  <option value="newest">
                    {isRTL ? 'الأحدث' : 'Newest'}
                  </option>
                </select>
              </div>
            </div>

            {/* Products Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center space-x-2">
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(Math.max(1, pagination.page - 1)));
                        setSearchParams(newParams);
                      }}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      {isRTL ? 'السابق' : 'Previous'}
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                      {isRTL
                        ? `الصفحة ${pagination.page} من ${pagination.totalPages}`
                        : `Page ${pagination.page} of ${pagination.totalPages}`}
                    </span>
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(Math.min(pagination.totalPages, pagination.page + 1)));
                        setSearchParams(newParams);
                      }}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    >
                      {isRTL ? 'التالي' : 'Next'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-600 mb-4">
                  {isRTL ? 'لا توجد منتجات' : 'No products found'}
                </p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  {isRTL ? 'مسح الفلاتر' : 'Clear Filters'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default CategoryPage;
