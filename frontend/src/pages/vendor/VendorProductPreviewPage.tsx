import React from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, Eye, Pencil, RefreshCw } from 'lucide-react';
import ProductPreview from '../../components/product/ProductPreview';
import ProductPreviewSkeleton from '../../components/product/ProductPreviewSkeleton';
import ProductPreviewStatusBanner from '../../components/product/ProductPreviewStatusBanner';
import { ProductStatusBadge } from '../../components/vendor/ProductReviewStatus';
import NoIndex from '../../components/common/NoIndex';
import { useProductPreview } from '../../hooks/useProductPreview';
import { getApiErrorMessage } from '../../lib/productCatalog';

const buttonBase =
  'inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900';
const primaryButton = `${buttonBase} bg-gray-900 text-white hover:bg-gray-800`;
const secondaryButton = `${buttonBase} border border-gray-200 bg-white text-gray-800 hover:bg-gray-50`;

/** The vendor's own product as customers would see it, for any status. Ownership is enforced by the API. */
const VendorProductPreviewPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const { product, state, error, reload } = useProductPreview(`/vendor/products/${encodeURIComponent(id)}/preview`);

  // The catalog passes its filters and page along, so "Back to products" returns to the same view.
  const catalogSearch = (location.state as { catalogSearch?: unknown } | null)?.catalogSearch;
  const backTo = `/vendor/products${typeof catalogSearch === 'string' && catalogSearch.startsWith('?') ? catalogSearch : ''}`;
  const editTo = `/vendor/products/${encodeURIComponent(id)}/edit`;
  const live = product?.status === 'ACTIVE' || product?.status === 'APPROVED';

  const backLink = (
    <Link to={backTo} className={secondaryButton}>
      <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
      {t('productPreview.backToProducts')}
    </Link>
  );

  return (
    <div className="space-y-4 text-start">
      <NoIndex />
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Eye size={14} aria-hidden="true" />
            {t('productPreview.modeLabel')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-words">
              {product ? (isArabic && product.nameAr) || product.name : t('productPreview.pageTitle')}
            </h1>
            {product && <ProductStatusBadge status={product.status} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:flex-shrink-0">
          {backLink}
          {state !== 'notFound' && (
            <Link to={editTo} className={secondaryButton}>
              <Pencil size={16} aria-hidden="true" />
              {t('productPreview.editProduct')}
            </Link>
          )}
          {live && product && (
            <a href={`/product/${encodeURIComponent(product.slug)}`} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
              <ExternalLink size={16} aria-hidden="true" />
              {t('productPreview.viewInStore')}
            </a>
          )}
        </div>
      </header>

      {state === 'loading' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6">
          <ProductPreviewSkeleton />
        </div>
      )}

      {state === 'notFound' && (
        <div role="alert" className="bg-white rounded-3xl border border-gray-100 p-8 text-center">
          <h2 className="text-lg font-bold text-gray-900">{t('productPreview.notFoundTitle')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('productPreview.notFoundBody')}</p>
          <div className="mt-5 flex justify-center">{backLink}</div>
        </div>
      )}

      {state === 'error' && (
        <div role="alert" className="bg-white rounded-3xl border border-red-100 p-8 text-center">
          <h2 className="text-lg font-bold text-gray-900">{t('productPreview.errorTitle')}</h2>
          <p className="mt-1 text-sm text-gray-600">{getApiErrorMessage(error, isArabic, t('productPreview.errorBody'))}</p>
          <div className="mt-5 flex justify-center">
            <button type="button" onClick={reload} className={primaryButton}>
              <RefreshCw size={16} aria-hidden="true" />
              {t('productPreview.retry')}
            </button>
          </div>
        </div>
      )}

      {state === 'ready' && product && (
        <>
          <ProductPreviewStatusBanner
            status={product.status}
            rejectionReason={product.rejectionReason}
            actions={product.status === 'REJECTED' || product.status === 'DRAFT' ? (
              <Link to={editTo} className={primaryButton}>
                <Pencil size={16} aria-hidden="true" />
                {product.status === 'DRAFT' ? t('productPreview.backToEditing') : t('productPreview.editProduct')}
              </Link>
            ) : undefined}
          />
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6">
            <ProductPreview product={product} />
          </div>
        </>
      )}
    </div>
  );
};

export default VendorProductPreviewPage;
