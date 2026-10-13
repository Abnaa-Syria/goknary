import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchProducts } from '../../store/slices/productSlice';
import ProductCard from '../product/ProductCard';
import StorePolicies from './StorePolicies';
import { getImageUrl } from '../../utils/image';
import { hasAnyPolicy, VendorPolicyFields } from '../../lib/vendorPolicies';

export interface StorefrontVendor extends VendorPolicyFields {
  id: string;
  storeName: string;
  storeNameAr?: string | null;
  slug: string;
  description?: string | null;
  descriptionAr?: string | null;
  logo?: string | null;
  banner?: string | null;
  rating: number;
  totalReviews: number;
}

interface StorefrontProps {
  vendor: StorefrontVendor;
  /** Vendor dashboard preview: same presentation, but navigation and cart actions are blocked. */
  preview?: boolean;
}

/** Customer-facing store presentation shared by the public store page and the vendor preview. */
const Storefront: React.FC<StorefrontProps> = ({ vendor, preview = false }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith('ar');
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { products, loading, pagination } = useAppSelector((state) => state.products);
  const showPolicies = hasAnyPolicy(vendor, isArabic);
  const [tab, setTab] = useState<'products' | 'policies'>('products');

  const storeName = (isArabic && vendor.storeNameAr) || vendor.storeName;
  const description = (isArabic && vendor.descriptionAr) || vendor.description;

  useEffect(() => {
    dispatch(
      fetchProducts({
        vendorId: vendor.id,
        page: searchParams.get('page') || '1',
      })
    );
  }, [vendor.id, searchParams, dispatch]);

  const blockInPreview = (e: React.MouseEvent) => {
    if (!preview) return;
    const target = e.target as HTMLElement;
    if (target.closest('a, button') && !target.closest('[data-preview-allow]')) {
      e.preventDefault();
      e.stopPropagation();
      toast(t('policies.previewDisabledAction', 'Disabled in preview mode'), { id: 'store-preview' });
    }
  };

  return (
    <div>
      {/* Store Header */}
      {vendor.banner && (
        <div className="w-full h-64 mb-8 relative overflow-hidden">
          <img
            src={getImageUrl(vendor.banner)}
            alt={storeName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Store Info */}
        <div className="flex items-start gap-6 mb-8">
          {vendor.logo && (
            <img
              src={getImageUrl(vendor.logo)}
              alt={storeName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold mb-2">{storeName}</h1>
            {description && (
              <p className="text-gray-600 max-w-2xl whitespace-pre-line">{description}</p>
            )}
          </div>
        </div>

        {showPolicies && (
          <div className="flex gap-2 border-b border-gray-200 mb-6">
            {(['products', 'policies'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`px-4 py-2 -mb-px border-b-2 font-semibold text-sm transition-colors ${
                  tab === key ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
                }`}
              >
                {key === 'products' ? t('common.products', 'Products') : t('policies.storePolicies', 'Store Policies')}
              </button>
            ))}
          </div>
        )}

        {showPolicies && tab === 'policies' ? (
          <StorePolicies vendor={vendor} />
        ) : (
          <div onClickCapture={blockInPreview}>
            <h2 className="text-2xl font-bold mb-6">{t('common.products', 'Products')}</h2>
            {loading ? (
              <div className="text-center py-12">Loading products...</div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2" data-preview-allow>
                    <button
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('page', String(Math.max(1, pagination.page - 1)));
                        window.location.search = newParams.toString();
                      }}
                      disabled={pagination.page === 1}
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    <span className="px-4 py-2">
                      Page {pagination.page} of {pagination.totalPages}
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
                      Next
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                No products available from this store.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Storefront;
