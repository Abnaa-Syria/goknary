import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Eye,
  Edit,
  CheckCircle,
  XCircle,
  EyeOff,
  Star,
  RefreshCw,
  Send,
  Store,
  Layers,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import { ProductHubProductOverview } from '../../types/productHub';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';

interface ProductHubHeaderProps {
  product: ProductHubProductOverview;
  role: 'admin' | 'vendor';
  onReload: () => void;
  onOpenRejectModal?: () => void;
}

export const ProductHubHeader: React.FC<ProductHubHeaderProps> = ({
  product,
  role,
  onReload,
  onOpenRejectModal,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isRTL = i18n.language === 'ar';
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const displayName = (isRTL && product.nameAr) || product.name || '—';
  const displayCategory = (isRTL && product.category.nameAr) || product.category.name || '—';
  const displayBrand = product.brand ? ((isRTL && product.brand.nameAr) || product.brand.name) : null;
  const displayVendor = (isRTL && product.vendor.storeNameAr) || product.vendor.storeName || '—';

  const catalogPath = role === 'admin' ? '/admin/products' : '/vendor/products';
  const editPath = role === 'admin' ? `/admin/products/${product.id}/edit` : `/vendor/products/${product.id}/edit`;
  const previewPath = role === 'admin' ? `/admin/products/${product.id}/preview` : `/vendor/products/${product.id}/preview`;
  const publicStoreUrl = `/products/${product.slug || product.id}`;

  const executeAction = async (actionKey: string, apiCall: () => Promise<unknown>, successMsg: string) => {
    try {
      setBusyAction(actionKey);
      await apiCall();
      toast.success(successMsg);
      onReload();
    } catch (err: any) {
      const msg = err.response?.data?.error || t('common.errorOccurred', 'An error occurred');
      toast.error(msg);
    } finally {
      setBusyAction(null);
    }
  };

  const handleAdminApprove = () => {
    executeAction(
      'approve',
      () => api.post(`/admin/products/${product.id}/approve`),
      t('admin.pendingProducts.approveSuccess', 'Product approved successfully')
    );
  };

  const handleAdminHide = () => {
    executeAction(
      'hide',
      () => api.patch(`/admin/products/${product.id}/status`, { status: 'INACTIVE' }),
      t('catalog.toast.hidden', 'Product hidden')
    );
  };

  const handleAdminRepublish = () => {
    executeAction(
      'republish',
      () => api.patch(`/admin/products/${product.id}/status`, { status: 'APPROVED' }),
      t('catalog.toast.republished', 'Product republished')
    );
  };

  const handleAdminToggleFeatured = () => {
    executeAction(
      'feature',
      () => api.patch(`/admin/products/${product.id}/featured`, { featured: !product.featured }),
      product.featured ? t('catalog.toast.unfeatured', 'Removed from featured') : t('catalog.toast.featured', 'Marked as featured')
    );
  };

  const handleVendorSubmit = () => {
    executeAction(
      'submit',
      () => api.post(`/vendor/products/${product.id}/submit`),
      t('vendor.productSubmittedSuccess', 'Product submitted for review')
    );
  };

  const handleVendorHide = () => {
    executeAction(
      'hide',
      () => api.patch(`/vendor/products/${product.id}/status`, { status: 'INACTIVE' }),
      t('catalog.toast.hidden', 'Product hidden')
    );
  };

  const renderStatusBadge = () => {
    const statusConfig: Record<string, { bg: string; label: string }> = {
      ACTIVE: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: t('catalog.status.active', 'Active') },
      APPROVED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: t('catalog.status.approved', 'Approved') },
      PENDING: { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: t('catalog.status.pending', 'Pending Review') },
      DRAFT: { bg: 'bg-slate-50 text-slate-700 border-slate-200', label: t('catalog.status.draft', 'Draft') },
      INACTIVE: { bg: 'bg-zinc-100 text-zinc-700 border-zinc-300', label: t('catalog.status.inactive', 'Inactive') },
      REJECTED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: t('catalog.status.rejected', 'Rejected') },
    };
    const current = statusConfig[product.status] || { bg: 'bg-gray-50 text-gray-700 border-gray-200', label: product.status };

    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${current.bg}`}>
        {current.label}
      </span>
    );
  };

  const renderVisibilityBadge = () => {
    if (product.isLive) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {t('productHub.visibility.live', 'Live on Storefront')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
        {t('productHub.visibility.hidden', 'Hidden from Storefront')}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:p-6 mb-6">
      {/* Top back navigation */}
      <div className="flex items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-100">
        <Link
          to={catalogPath}
          className="inline-flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors"
        >
          {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          <span>{t('productHub.backToCatalog', 'Back to Products Catalog')}</span>
        </Link>

        <div className="flex items-center gap-2">
          {renderStatusBadge()}
          {renderVisibilityBadge()}
        </div>
      </div>

      {/* Main product identity bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start gap-4 sm:gap-5 min-w-0">
          {/* Main image */}
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border border-gray-200 bg-gray-50 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {product.mainImage ? (
              <img
                src={product.mainImage}
                alt={product.imageMetadata?.alt || displayName}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Layers className="text-gray-300 w-10 h-10" />
            )}
          </div>

          {/* Details */}
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate mb-1">
              {displayName}
            </h1>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-gray-500">
              <span className="font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold">
                SKU: {product.sku}
              </span>

              <span className="inline-flex items-center gap-1">
                <Tag size={13} className="text-gray-400" />
                <span>{displayCategory}</span>
              </span>

              {displayBrand && (
                <span className="inline-flex items-center gap-1">
                  <span>·</span>
                  <span className="text-gray-600 font-medium">{displayBrand}</span>
                </span>
              )}

              {role === 'admin' && (
                <Link
                  to={`/admin/vendors/${product.vendor.id}`}
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  <Store size={13} />
                  <span>{displayVendor}</span>
                </Link>
              )}
            </div>

            {/* Sub-meta tags */}
            <div className="flex flex-wrap items-center gap-2 mt-2.5">
              {product.hasVariants ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-200">
                  {t('productHub.variantsCount', '{{count}} Variants', { count: product.variantCount })}
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700">
                  {t('productHub.singleProduct', 'Single Product')}
                </span>
              )}

              {product.featured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                  <Star size={11} fill="currentColor" />
                  {t('catalog.featured.yes', 'Featured')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {/* View in Store (if live) */}
          {product.isLive && (
            <a
              href={publicStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <ExternalLink size={14} />
              <span>{t('productHub.actions.viewInStore', 'View in Store')}</span>
            </a>
          )}

          {/* Preview */}
          <Link
            to={previewPath}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Eye size={14} />
            <span>{t('catalog.actions.preview', 'Preview')}</span>
          </Link>

          {/* Edit (Studio) */}
          <Link
            to={editPath}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Edit size={14} />
            <span>{t('catalog.actions.edit', 'Edit in Studio')}</span>
          </Link>

          {/* Role-Specific Governance Actions */}
          {role === 'admin' && (
            <>
              {product.status === 'PENDING' && (
                <>
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleAdminApprove}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    <CheckCircle size={14} />
                    <span>{t('catalog.actions.approve', 'Approve')}</span>
                  </button>

                  {onOpenRejectModal && (
                    <button
                      type="button"
                      disabled={!!busyAction}
                      onClick={onOpenRejectModal}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      <span>{t('catalog.actions.reject', 'Reject')}</span>
                    </button>
                  )}
                </>
              )}

              {(product.status === 'ACTIVE' || product.status === 'APPROVED') && (
                <>
                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleAdminHide}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                  >
                    <EyeOff size={14} />
                    <span>{t('catalog.actions.hide', 'Hide Product')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!!busyAction}
                    onClick={handleAdminToggleFeatured}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors disabled:opacity-50 ${
                      product.featured
                        ? 'border-amber-300 bg-amber-100 text-amber-800'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Star size={14} fill={product.featured ? 'currentColor' : 'none'} />
                    <span>
                      {product.featured
                        ? t('catalog.actions.unfeature', 'Unfeature')
                        : t('catalog.actions.feature', 'Feature')}
                    </span>
                  </button>
                </>
              )}

              {product.status === 'INACTIVE' && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleAdminRepublish}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <RefreshCw size={14} />
                  <span>{t('catalog.actions.republish', 'Republish')}</span>
                </button>
              )}
            </>
          )}

          {role === 'vendor' && (
            <>
              {product.status === 'DRAFT' && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleVendorSubmit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>{t('catalog.actions.submit', 'Submit for Review')}</span>
                </button>
              )}

              {(product.status === 'ACTIVE' || product.status === 'APPROVED') && (
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleVendorHide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  <EyeOff size={14} />
                  <span>{t('catalog.actions.hide', 'Hide Product')}</span>
                </button>
              )}

              {product.status === 'REJECTED' && (
                <button
                  type="button"
                  onClick={() => navigate(editPath)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm"
                >
                  <ShieldAlert size={14} />
                  <span>{t('catalog.actions.editAndResubmit', 'Edit & Resubmit')}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
