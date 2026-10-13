import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ArrowLeft, Check, X, Eye, RefreshCw } from 'lucide-react';
import api from 'lib/api';
import { useAppSelector } from 'store/hooks';
import { hasPermission } from 'utils/permissions';
import { ProductStatusBadge } from 'components/vendor/ProductReviewStatus';
import RejectProductModal from 'components/admin/RejectProductModal';
import ProductPreview from 'components/product/ProductPreview';
import ProductPreviewSkeleton from 'components/product/ProductPreviewSkeleton';
import { useProductPreview } from 'hooks/useProductPreview';
import { getApiErrorMessage } from 'lib/productCatalog';

const AdminProductPreviewPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const canUpdate = hasPermission(user, 'UPDATE_PRODUCTS');
  const isAr = i18n.language === 'ar';
  const dateLocale = isAr ? 'ar-EG' : 'en-US';

  const { product, state, error, reload } = useProductPreview(`/admin/products/${encodeURIComponent(id)}/preview`);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const approve = async () => {
    if (!product) return;
    setBusy(true);
    try {
      await api.post(`/admin/products/${product.id}/approve`);
      toast.success(t('admin.pendingProducts.approveSuccess', 'Product approved successfully'));
    } catch (err) {
      toast.error(getApiErrorMessage(err, isAr, t('admin.pendingProducts.statusError', 'Failed to update product status')));
    } finally {
      setBusy(false);
      reload();
    }
  };

  const reject = async (reason: string) => {
    if (!product) return;
    setBusy(true);
    try {
      await api.post(`/admin/products/${product.id}/reject`, { reason });
      toast.success(t('admin.pendingProducts.rejectSuccess', 'Product rejected'));
      setRejecting(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, isAr, t('admin.pendingProducts.statusError', 'Failed to update product status')));
    } finally {
      setBusy(false);
      reload();
    }
  };

  if (state === 'loading' && !product) {
    return (
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <ProductPreviewSkeleton />
      </div>
    );
  }

  if (state === 'notFound' || state === 'error' || !product) {
    return (
      <div role="alert" className="bg-white rounded-3xl border border-gray-100 p-8 text-center">
        <h2 className="text-lg font-bold text-gray-900">
          {state === 'notFound' ? t('productPreview.notFoundTitle') : t('moderation.previewFailed', 'Failed to load product preview')}
        </h2>
        {state === 'error' && <p className="mt-1 text-sm text-gray-600">{getApiErrorMessage(error, isAr, t('productPreview.errorBody'))}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 text-sm font-semibold">
            <ArrowLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
            {t('common.back', 'Back')}
          </button>
          {state === 'error' && (
            <button type="button" onClick={reload} className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-gray-900 text-white text-sm font-semibold">
              <RefreshCw size={16} aria-hidden="true" />
              {t('productPreview.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  const name = isAr && product.nameAr ? product.nameAr : product.name;

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('common.back', 'Back')} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
              <Eye size={12} /> {t('moderation.previewTitle', 'Customer preview (not public)')}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <ProductStatusBadge status={product.status} />
              <span className="text-xs text-gray-500">
                {product.submittedAt
                  ? t('moderation.submittedOn', 'Submitted {{date}}', { date: new Date(product.submittedAt).toLocaleString(dateLocale) })
                  : new Date(product.createdAt).toLocaleString(dateLocale)}
              </span>
            </div>
          </div>
        </div>
        {canUpdate && (
          <Link
            to={`/admin/products/${product.id}/edit`}
            className="flex items-center gap-1 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-sm font-bold"
          >
            {t('productStudio.editInStudio', 'Edit in Product Studio')}
          </Link>
        )}
        {canUpdate && product.status === 'PENDING' && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={approve}
              className="flex items-center gap-1 px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold disabled:opacity-50"
            >
              <Check size={16} /> {t('admin.pendingProducts.approve', 'Approve')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRejecting(true)}
              className="flex items-center gap-1 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold disabled:opacity-50"
            >
              <X size={16} /> {t('admin.pendingProducts.reject', 'Reject')}
            </button>
          </div>
        )}
      </div>

      {(product.rejectionReason || product.reviewedAt) && (
        <div className={`rounded-2xl border p-4 text-sm ${product.status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-100 text-gray-600'}`}>
          {product.reviewedAt && (
            <p className="text-xs">
              {t('moderation.reviewedBy', 'Reviewed {{date}} by {{name}}', {
                date: new Date(product.reviewedAt).toLocaleString(dateLocale),
                name: product.reviewerName || '—',
              })}
            </p>
          )}
          {product.status === 'REJECTED' && product.rejectionReason && (
            <p className="mt-1 whitespace-pre-line">
              <span className="font-semibold">{t('moderation.rejectionReason', 'Rejection reason')}:</span> {product.rejectionReason}
            </p>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-4 sm:p-6">
        <ProductPreview product={product} />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <dl className="grid grid-cols-2 gap-2 text-xs text-gray-500">
          <dt>SKU</dt>
          <dd className="font-mono">{product.sku}</dd>
          <dt>{t('moderation.slug', 'Link')}</dt>
          <dd className="font-mono break-all">/product/{product.slug}</dd>
          <dt>{t('moderation.vendorStatus', 'Vendor account')}</dt>
          <dd>{product.vendor.status}</dd>
          <dt>{t('vendor.productForm.featuredProduct', 'Featured Product')}</dt>
          <dd>{product.featured ? t('common.yes', 'Yes') : t('common.no', 'No')}</dd>
        </dl>
        <Link to={`/admin/vendors/${product.vendor.id}/products`} className="inline-block mt-4 text-xs font-bold text-primary-600 hover:underline">
          {t('admin.pendingProducts.viewVendorProducts', 'View vendor products')}
        </Link>
      </div>

      <RejectProductModal
        productName={rejecting ? name : null}
        submitting={busy}
        onCancel={() => setRejecting(false)}
        onConfirm={reject}
      />
    </div>
  );
};

export default AdminProductPreviewPage;
