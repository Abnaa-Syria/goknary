import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProducts, Product } from '../store/slices/productSlice';
import { fetchCategories } from '../store/slices/categorySlice';
import ProductCard from '../components/product/ProductCard';
import api from '../lib/api';
import { Search, X, Info, Tag } from 'lucide-react';

const SearchPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = searchParams.get('q') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const currentPage = searchParams.get('page') || '1';
  const currentSort = searchParams.get('sort') || 'relevance';

  const { products, loading, pagination } = useAppSelector((state) => state.products);
  const { categories } = useAppSelector((state) => state.categories);

  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Fetch categories if not already loaded
  useEffect(() => {
    if (categories.length === 0) {
      dispatch(fetchCategories());
    }
  }, [categories, dispatch]);

  // Fetch products based on URL params (query, categoryId, page, sort)
  useEffect(() => {
    // Only dispatch search query if it is empty (default browse) OR at least 2 characters long
    if (query === '' || query.trim().length >= 2) {
      dispatch(
        fetchProducts({
          q: query || undefined,
          categoryId: categoryId || undefined,
          page: currentPage,
          sort: currentSort,
        })
      );
    }
  }, [query, categoryId, currentPage, currentSort, dispatch]);

  // Fetch fallback suggestions when there are no products returned
  useEffect(() => {
    if (!loading && products.length === 0 && query) {
      setLoadingSuggestions(true);
      api.get('/products', { params: { limit: 6 } })
        .then((res) => {
          const parsed = (res.data.products || []).map((p: any) => ({
            ...p,
            images: typeof p.images === 'string' ? JSON.parse(p.images) : p.images,
          }));
          setSuggestions(parsed);
        })
        .catch((err) => console.error('Failed to load suggestions:', err))
        .finally(() => setLoadingSuggestions(false));
    } else {
      setSuggestions([]);
    }
  }, [products, loading, query]);

  const handleClearCategoryScope = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('categoryId');
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryName = selectedCategory
    ? (isRTL && (selectedCategory as any).nameAr ? (selectedCategory as any).nameAr : selectedCategory.name)
    : '';

  const showWarning = query.trim().length === 1;

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('page', String(newPage));
    setSearchParams(newParams);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', e.target.value);
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  // Premium skeleton card components
  const SkeletonGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg p-4 border border-gray-100 animate-pulse">
          <div className="bg-gray-200 aspect-square w-full rounded-md mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/4"></div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8 min-h-[70vh]">
      {/* Page Title & Status */}
      <div className="mb-6">
        {query ? (
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="text-primary-500 w-6 h-6" />
              {t('common.search', 'البحث')}: <span className="text-primary-600">"{query}"</span>
            </h1>
            {showWarning && (
              <div className="flex items-center gap-2 text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3 text-xs sm:text-sm font-medium animate-pulse">
                <Info className="w-4 h-4 flex-shrink-0" />
                <span>{t('search.minCharsWarning', 'يرجى كتابة حرفين على الأقل للبحث')}</span>
              </div>
            )}
          </div>
        ) : (
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">
            {t('common.products', 'المنتجات')}
          </h1>
        )}
      </div>

      {/* Category Scoping Indicator */}
      {categoryId && selectedCategory && (
        <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full border border-primary-200 text-xs sm:text-sm font-medium w-fit mb-5 shadow-sm animate-fade-in">
          <Tag className="w-4 h-4 flex-shrink-0" />
          <span>
            {t('search.categoryIndicator', 'البحث داخل:')} {categoryName}
          </span>
          <button
            onClick={handleClearCategoryScope}
            className="hover:bg-primary-100 p-0.5 rounded-full transition-colors text-primary-500 hover:text-primary-700"
            aria-label="Clear Category Scope"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Results Title and Sort Controls */}
      {!loading && products.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
          <h2 className="text-lg font-bold text-gray-900">
            {query ? (
              <>
                {t('common.search')}: <span className="text-primary-600">"{query}"</span>
              </>
            ) : (
              t('common.products', 'المنتجات')
            )}
            <span className="text-sm font-normal text-gray-500 ms-2">
              ({pagination.total} {t('common.products')})
            </span>
          </h2>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <label htmlFor="sort" className="text-sm font-medium text-gray-600 whitespace-nowrap">
              {t('product.sort', 'ترتيب حسب')}:
            </label>
            <select
              id="sort"
              value={currentSort}
              onChange={handleSortChange}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="relevance">{t('product.sortRelevance', 'الأكثر ملاءمة')}</option>
              <option value="price_low">{t('product.sortPriceLow', 'السعر: من الأقل للأعلى')}</option>
              <option value="price_high">{t('product.sortPriceHigh', 'السعر: من الأعلى للأقل')}</option>
              <option value="rating">{t('product.sortRating', 'التقييم')}</option>
              <option value="newest">{t('product.sortNewest', 'الأحدث')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <SkeletonGrid />
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6 sm:mt-8">
              <button
                onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                {t('common.previous')}
              </button>
              <span className="px-4 py-1.5 text-sm text-gray-600 font-medium">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(Math.min(pagination.totalPages, pagination.page + 1))}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      ) : (
        // Empty State / Fallback Suggestions
        <div>
          {query && !showWarning && (
            <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm mb-8">
              <div className="text-gray-400 mb-4 flex justify-center">
                <Search className="w-16 h-16 text-gray-300" />
              </div>
              <p className="text-lg sm:text-xl font-medium text-gray-700 mb-2">
                {t('search.noResultsFor', 'لا توجد نتائج للبحث عن')}{' '}
                <span className="text-primary-600 font-bold">"{query}"</span>
              </p>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {t('search.tryDifferentKeywords', 'حاول استخدام كلمات رئيسية أخرى أو تصفح الأقسام.')}
              </p>
            </div>
          )}

          {/* Suggested Products Section */}
          {suggestions.length > 0 && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2 text-gray-900">
                <span className="w-1.5 h-6 bg-primary-500 rounded-full"></span>
                {t('search.suggestionsTitle', 'منتجات مقترحة لك')}
              </h2>
              {loadingSuggestions ? (
                <SkeletonGrid />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                  {suggestions.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
