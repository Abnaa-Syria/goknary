import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { ProductHubProductOverview } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';

interface ProductHubOverviewProps {
  product: ProductHubProductOverview;
  role: 'admin' | 'vendor';
}

export const ProductHubOverview: React.FC<ProductHubOverviewProps> = ({ product, role }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const defaultVariantName = product.defaultVariant
    ? (isRTL && product.defaultVariant.nameAr) || product.defaultVariant.name || '—'
    : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {t('productHub.overview.title', 'Operational Health & Lifecycle')}
            </h2>
            <p className="text-xs text-gray-500">
              {t('productHub.overview.subtitle', 'Live storefront visibility, variant distribution, and audit timestamps')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {product.isLive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={13} />
              {t('productHub.overview.storefrontReady', 'Storefront Ready')}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertTriangle size={13} />
              {t('productHub.overview.storefrontHidden', 'Storefront Restricted')}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Inventory Health */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-3">
            <Layers size={14} className="text-purple-600" />
            <span>{t('productHub.overview.variantsHealth', 'Variants & Stock Status')}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.totalVariants', 'Total Variants')}:</span>
              <span className="font-semibold text-gray-900">{product.variantCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.activeVariants', 'Active Variants')}:</span>
              <span className="font-semibold text-emerald-600">{product.activeVariantCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.lowStockVariants', 'Low Stock Variants')}:</span>
              <span className={`font-semibold ${product.lowStockVariantCount > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                {product.lowStockVariantCount}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.outOfStockVariants', 'Out of Stock')}:</span>
              <span className={`font-semibold ${product.outOfStockVariantCount > 0 ? 'text-rose-600' : 'text-gray-700'}`}>
                {product.outOfStockVariantCount}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Pricing & Defaults */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-3">
            <Sparkles size={14} className="text-indigo-600" />
            <span>{t('productHub.overview.pricingDefaults', 'Pricing & Default Variant')}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.basePrice', 'Base Price')}:</span>
              <span className="font-semibold text-gray-900">{formatPrice(product.price)}</span>
            </div>
            {product.discountPrice ? (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t('productHub.overview.discountPrice', 'Discount Price')}:</span>
                <span className="font-semibold text-emerald-600">{formatPrice(product.discountPrice)}</span>
              </div>
            ) : null}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.lowStockThreshold', 'Low Stock Alert At')}:</span>
              <span className="font-semibold text-gray-700">{product.lowStockThreshold} {t('productHub.overview.units', 'units')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.defaultVariant', 'Default Selection')}:</span>
              <span className="font-semibold text-gray-900 truncate max-w-[130px]" title={defaultVariantName || '—'}>
                {defaultVariantName || (product.hasVariants ? '—' : t('productHub.overview.singleProduct', 'Single Product'))}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Commercial & Store Attributes */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-3">
            <Sliders size={14} className="text-blue-600" />
            <span>{t('productHub.overview.commercial', 'Store & Channel Attributes')}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.vendorStore', 'Store')}:</span>
              <span className="font-semibold text-gray-900 truncate max-w-[140px]">
                {(isRTL && product.vendor.storeNameAr) || product.vendor.storeName}
              </span>
            </div>
            {role === 'admin' && typeof product.vendor.commissionRate === 'number' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t('productHub.overview.commissionRate', 'Store Commission')}:</span>
                <span className="font-semibold text-blue-600">{product.vendor.commissionRate}%</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.category', 'Category')}:</span>
              <span className="font-semibold text-gray-900 truncate max-w-[140px]">
                {(isRTL && product.category.nameAr) || product.category.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.featuredStatus', 'Featured Placement')}:</span>
              <span className={`font-semibold ${product.featured ? 'text-amber-600' : 'text-gray-600'}`}>
                {product.featured ? t('catalog.featured.yes', 'Featured') : t('catalog.featured.no', 'Standard')}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Audit & Lifecycle Timestamps */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-600 mb-3">
            <Clock size={14} className="text-teal-600" />
            <span>{t('productHub.overview.lifecycle', 'Lifecycle & Timestamps')}</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.createdAt', 'Created')}:</span>
              <span className="font-medium text-gray-700">{formatDate(product.createdAt)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{t('productHub.overview.updatedAt', 'Last Updated')}:</span>
              <span className="font-medium text-gray-700">{formatDate(product.updatedAt)}</span>
            </div>
            {product.submittedAt && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t('productHub.overview.submittedAt', 'Submitted')}:</span>
                <span className="font-medium text-gray-700">{formatDate(product.submittedAt)}</span>
              </div>
            )}
            {product.reviewedAt && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">{t('productHub.overview.reviewedAt', 'Reviewed')}:</span>
                <span className="font-medium text-gray-700">{formatDate(product.reviewedAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
