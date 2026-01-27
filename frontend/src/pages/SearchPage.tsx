import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProducts } from '../store/slices/productSlice';
import ProductCard from '../components/product/ProductCard';

const SearchPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const dispatch = useAppDispatch();
  const { products, loading, pagination } = useAppSelector((state) => state.products);

  useEffect(() => {
    if (query) {
      dispatch(
        fetchProducts({
          search: query,
          page: searchParams.get('page') || '1',
          sort: searchParams.get('sort') || 'relevance',
        })
      );
    }
  }, [query, searchParams, dispatch]);

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-4 sm:mb-6">
        <span className="block sm:inline">{t('common.search')}: {query}</span>
        {!loading && products.length > 0 && (
          <span className="block sm:inline text-base sm:text-lg font-normal text-gray-600 sm:ms-2 mt-1 sm:mt-0">
            ({pagination.total} {t('common.products')})
          </span>
        )}
      </h1>

      {loading ? (
        <div className="text-center py-12">{t('common.loading')}</div>
      ) : products.length > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(Math.max(1, pagination.page - 1)));
                  window.location.search = newParams.toString();
                }}
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {t('common.previous')}
              </button>
              <span className="px-4 py-2">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => {
                  const newParams = new URLSearchParams(searchParams);
                  newParams.set('page', String(Math.min(pagination.totalPages, pagination.page + 1)));
                  window.location.search = newParams.toString();
                }}
                disabled={pagination.page === pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                {t('common.next')}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          {t('common.noResults')}
        </div>
      )}
    </div>
  );
};

export default SearchPage;
