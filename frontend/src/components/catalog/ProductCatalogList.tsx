import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { formatPrice } from '../../lib/utils';
import { IMAGE_PLACEHOLDER, getImageUrl } from '../../utils/image';
import { getCategoryLabel } from '../../utils/categoryTree';
import { ProductStatusBadge } from '../vendor/ProductReviewStatus';
import { ProductInventoryBadge, ProductRejectionReason, ProductVariantCount } from './ProductCatalogBadges';
import {
  CatalogProduct,
  getCatalogImageAlt,
  getLocalizedProductName,
  hasCatalogDiscount,
} from '../../lib/productCatalog';

export interface CatalogColumns {
  vendor?: boolean;
  featured?: boolean;
}

interface Props {
  products: CatalogProduct[];
  columns: CatalogColumns;
  /** Initial load: skeleton rows. */
  initialLoading: boolean;
  /** Later loads keep the rows and dim them. */
  refreshing: boolean;
  error: unknown;
  errorMessage: string;
  onRetry: () => void;
  empty: React.ReactNode;
  caption: string;
  productHref: (product: CatalogProduct) => string;
  renderActions: (product: CatalogProduct) => React.ReactNode;
  renderFeatured?: (product: CatalogProduct) => React.ReactNode;
  onOpenVariants?: (product: CatalogProduct) => void;
  footer?: React.ReactNode;
}

const Thumbnail: React.FC<{ product: CatalogProduct; isArabic: boolean; size: string }> = ({ product, isArabic, size }) => (
  <img
    src={product.image ? getImageUrl(product.image) : IMAGE_PLACEHOLDER}
    alt={getCatalogImageAlt(product, isArabic)}
    loading="lazy"
    decoding="async"
    width={56}
    height={56}
    onError={(event) => {
      const img = event.currentTarget;
      if (img.src !== IMAGE_PLACEHOLDER) img.src = IMAGE_PLACEHOLDER;
    }}
    className={`${size} rounded-xl object-cover bg-gray-100 border border-gray-100 flex-shrink-0`}
  />
);

const Price: React.FC<{ product: CatalogProduct }> = ({ product }) => {
  const { t } = useTranslation();
  const discounted = hasCatalogDiscount(product);
  return (
    <div className="tabular-nums">
      <div className="text-sm font-bold text-gray-900">{formatPrice(discounted ? product.discountPrice : product.price)}</div>
      {discounted && (
        <div className="text-xs text-gray-500 line-through">
          <span className="sr-only">{t('catalog.price.original')} </span>
          {formatPrice(product.price)}
        </div>
      )}
      {product.variantCount > 0 && <div className="text-[11px] text-gray-500">{t('catalog.price.defaultVariant')}</div>}
    </div>
  );
};

/** Desktop table (xl and up, the dashboards keep a sidebar) and stacked cards below, over the same rows and actions. */
const ProductCatalogList: React.FC<Props> = ({
  products,
  columns,
  initialLoading,
  refreshing,
  error,
  errorMessage,
  onRetry,
  empty,
  caption,
  productHref,
  renderActions,
  renderFeatured,
  onOpenVariants,
  footer,
}) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const dateFormat = new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-US', { dateStyle: 'medium' });
  const formatDate = (value?: string | null) => (value ? dateFormat.format(new Date(value)) : '—');

  if (error && !products.length) {
    return (
      <div role="alert" className="bg-white rounded-2xl border border-red-100 p-10 text-center">
        <AlertCircle className="mx-auto text-red-500" size={32} aria-hidden="true" />
        <h2 className="mt-3 text-lg font-bold text-gray-900">{t('catalog.error.title')}</h2>
        <p className="mt-1 text-sm text-gray-600">{errorMessage}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
        >
          <RefreshCw size={16} aria-hidden="true" />
          {t('catalog.error.retry')}
        </button>
      </div>
    );
  }

  if (initialLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3" aria-busy="true" aria-label={t('catalog.loading')}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 animate-pulse">
            <div className="w-14 h-14 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/3 bg-gray-100 rounded" />
              <div className="h-3 w-1/5 bg-gray-100 rounded" />
            </div>
            <div className="hidden sm:block h-8 w-24 bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  if (!products.length && !refreshing) return <>{empty}</>;

  const name = (product: CatalogProduct) => getLocalizedProductName(product, isArabic);
  const vendorName = (product: CatalogProduct) =>
    (isArabic && product.vendor?.storeNameAr) || product.vendor?.storeName || '—';
  const categoryName = (product: CatalogProduct) => (product.category ? getCategoryLabel(product.category, isArabic) : '—');
  const brandName = (product: CatalogProduct) => (product.brand ? getCategoryLabel(product.brand, isArabic) : null);

  const statusDetails = (product: CatalogProduct) => (
    <>
      <ProductStatusBadge status={product.status} />
      {product.status === 'PENDING' && product.submittedAt && (
        <div className="mt-1 text-[11px] text-gray-500">{t('moderation.submittedOn', { date: formatDate(product.submittedAt) })}</div>
      )}
      {product.status === 'REJECTED' && <ProductRejectionReason id={product.id} reason={product.rejectionReason} />}
    </>
  );

  const identity = (product: CatalogProduct, thumbSize: string) => (
    <div className="flex items-start gap-3 min-w-0">
      <Link to={productHref(product)} className="flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded-xl">
        <Thumbnail product={product} isArabic={isArabic} size={thumbSize} />
      </Link>
      <div className="min-w-0">
        <Link
          to={productHref(product)}
          className="block text-sm font-semibold text-gray-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded line-clamp-2 break-words"
        >
          {name(product)}
        </Link>
        <div className="mt-0.5 text-[11px] text-gray-500 font-mono break-all">
          <span className="font-sans">{t('catalog.columns.sku')}:</span> {product.sku}
        </div>
        <div className="text-[11px] text-gray-600 break-words">
          <span className="sr-only">{t('catalog.columns.category')}: </span>
          {[categoryName(product), brandName(product)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  );

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-opacity ${refreshing ? 'opacity-60' : ''}`} aria-busy={refreshing}>
      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-red-50 text-sm text-red-800 border-b border-red-100">
          <span>{errorMessage}</span>
          <button type="button" onClick={onRetry} className="min-h-[36px] px-3 rounded-lg font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600">
            {t('catalog.error.retry')}
          </button>
        </div>
      ) : null}

      {/* Desktop table */}
      <div className="hidden xl:block overflow-x-auto">
        <table className="w-full text-start border-collapse min-w-[1040px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
              <th scope="col" className="px-3 py-3 text-start min-w-[220px]">{t('catalog.columns.product')}</th>
              {columns.vendor && <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.vendor')}</th>}
              <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.price')}</th>
              <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.inventory')}</th>
              <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.variants')}</th>
              <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.status')}</th>
              {columns.featured && <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.featured')}</th>}
              <th scope="col" className="px-3 py-3 text-start">{t('catalog.columns.updated')}</th>
              <th scope="col" className="px-3 py-3 text-end min-w-[250px]">{t('catalog.columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((product) => (
              <tr key={product.id} className="align-top hover:bg-gray-50/60">
                <td className="px-3 py-3 min-w-[220px] max-w-[340px]">{identity(product, 'w-14 h-14')}</td>
                {columns.vendor && (
                  <td className="px-3 py-3 text-sm text-gray-800">
                    <div className="max-w-[150px] break-words">{vendorName(product)}</div>
                    {product.vendor && product.vendor.status !== 'APPROVED' && (
                      <div className="text-[11px] font-semibold text-amber-700">{t('catalog.vendorStatus', { status: t(`catalog.vendorStatuses.${product.vendor.status}`, product.vendor.status) })}</div>
                    )}
                  </td>
                )}
                <td className="px-3 py-3"><Price product={product} /></td>
                <td className="px-3 py-3"><ProductInventoryBadge product={product} /></td>
                <td className="px-3 py-3">
                  <ProductVariantCount product={product} onOpen={onOpenVariants ? () => onOpenVariants(product) : undefined} />
                </td>
                <td className="px-3 py-3">{statusDetails(product)}</td>
                {columns.featured && <td className="px-3 py-3">{renderFeatured?.(product)}</td>}
                <td className="px-3 py-3 text-xs text-gray-600 whitespace-nowrap">{formatDate(product.updatedAt)}</td>
                <td className="px-3 py-3 min-w-[250px]">{renderActions(product)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet cards */}
      <ul className="xl:hidden divide-y divide-gray-100" aria-label={caption}>
        {products.map((product) => (
          <li key={product.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              {identity(product, 'w-16 h-16')}
              {columns.featured && <div className="flex-shrink-0">{renderFeatured?.(product)}</div>}
            </div>
            <div>{statusDetails(product)}</div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-[11px] font-semibold text-gray-500">{t('catalog.columns.price')}</dt>
                <dd><Price product={product} /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-gray-500">{t('catalog.columns.inventory')}</dt>
                <dd><ProductInventoryBadge product={product} /></dd>
              </div>
              <div>
                <dt className="text-[11px] font-semibold text-gray-500">{t('catalog.columns.variants')}</dt>
                <dd><ProductVariantCount product={product} onOpen={onOpenVariants ? () => onOpenVariants(product) : undefined} /></dd>
              </div>
              {columns.vendor && (
                <div>
                  <dt className="text-[11px] font-semibold text-gray-500">{t('catalog.columns.vendor')}</dt>
                  <dd className="text-gray-800 break-words">{vendorName(product)}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] font-semibold text-gray-500">{t('catalog.columns.updated')}</dt>
                <dd className="text-gray-800">{formatDate(product.updatedAt)}</dd>
              </div>
            </dl>
            {renderActions(product)}
          </li>
        ))}
      </ul>
      {footer && <div className="border-t border-gray-100">{footer}</div>}
    </div>
  );
};

export default ProductCatalogList;
