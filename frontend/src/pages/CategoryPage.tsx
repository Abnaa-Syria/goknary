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
    min: searchParams.get('minPrice') || '',
    max: searchParams.get('maxPrice') || '',
  });

  useEffect(() => {
    if (slug) {
      dispatch(fetchCategoryBySlug(slug));
    }
  }, [slug, dispatch]);

  useEffect(() => {
    const params: any = {
      categoryId: currentCategory?.id,
      page: searchParams.get('page') || '1',
      sort: searchParams.get('sort') || 'relevance',
      minPrice: searchParams.get('minPrice'),
      maxPrice: searchParams.get('maxPrice'),
      minRating: searchParams.get('minRating'),
      brandId: searchParams.get('brandId'),
    };

    Object.keys(params).forEach((key) => {
      if (params[key] === null || params[key] === undefined) {
        delete params[key];
      }
    });

    dispatch(setFilters(params));
    dispatch(fetchProducts(params));
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
      newParams.set('minPrice', priceRange.min);
    } else {
      newParams.delete('minPrice');
    }
    if (priceRange.max) {
      newParams.set('maxPrice', priceRange.max);
    } else {
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
  if (searchParams.get('minPrice') || searchParams.get('maxPrice')) {
    activeFilters.push('Price');
  }
  if (searchParams.get('minRating')) {
    activeFilters.push(`Rating ${searchParams.get('minRating')}+`);
  }
  if (searchParams.get('brandId')) {
    activeFilters.push('Brand');
  }

  const breadcrumbItems = [
    // Add parent category if exists
    ...(currentCategory?.parent ? [{ label: currentCategory.parent.name, to: `/category/${currentCategory.parent.slug}` }] : []),
    { label: currentCategory?.name || 'Category', to: currentCategory ? `/category/${currentCategory.slug}` : undefined },
  ];

  return (
    <>
      <SEO
        title={currentCategory?.name || 'Category'}
        description={currentCategory?.description || `Browse ${currentCategory?.name || 'products'} on GoKnary`}
      />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {/* Breadcrumbs */}
        <Breadcrumbs items={breadcrumbItems} />

        {/* Page Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            {currentCategory?.name || 'Category'}
          </h1>
          {currentCategory?.description && (
            <p className="text-gray-600">{currentCategory.description}</p>
          )}
          {pagination && (
            <p className="text-sm text-gray-500 mt-2">
              {pagination.total} products found
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
                  ? 'Browse Subcategories' 
                  : 'Related Categories'}
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
                    {child.name}
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
                      ← All {currentCategory.parent.name}
                    </Link>
                  )}
                  {currentCategory.siblings.map((sibling) => (
                    <Link
                      key={sibling.id}
                      to={`/category/${sibling.slug}`}
                      className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-primary-500 hover:text-primary-600 hover:bg-primary-50 transition-all duration-200 shadow-sm"
                    >
                      {sibling.name}
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
            <span className="text-sm text-gray-600 font-medium">Active filters:</span>
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
              Clear all
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
                <h3 className="font-bold text-lg text-gray-900">Filters</h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="lg:hidden p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Close filters"
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
                  <span>Price</span>
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
                        <label className="block text-sm text-gray-600 mb-1">Min</label>
                        <input
                          type="number"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Max</label>
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
                      Apply
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
                  <span>Rating</span>
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
                            if (isActive) {
                              newParams.delete('minRating');
                            } else {
                              newParams.set('minRating', rating.toString());
                            }
                            newParams.set('page', '1');
                            setSearchParams(newParams);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-lg transition-colors text-sm ${
                            isActive
                              ? 'bg-primary-50 text-primary-700 font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {rating}+ stars
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
                  Clear All Filters
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
                <span className="text-sm font-medium">Filters</span>
                {activeFilters.length > 0 && (
                  <span className="bg-primary-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {/* Sort */}
              <div className="flex items-center space-x-3 w-full sm:w-auto">
                <label className="text-sm text-gray-600 font-medium whitespace-nowrap">Sort by:</label>
                <select
                  value={searchParams.get('sort') || 'relevance'}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm bg-white"
                >
                  <option value="relevance">Relevance</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Highest Rated</option>
                  <option value="newest">Newest</option>
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
                      Previous
                    </button>
                    <span className="px-4 py-2 text-sm text-gray-600">
                      Page {pagination.page} of {pagination.totalPages}
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
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-lg text-gray-600 mb-4">No products found</p>
                <button
                  onClick={clearFilters}
                  className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  Clear Filters
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
