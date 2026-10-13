import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  TrendingUp,
  Eye,
  ShoppingCart,
  Heart,
  Target,
  Info,
  Award,
} from 'lucide-react';
import { ProductHubKpis, ProductHubSalesByVariant } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';

interface ProductPerformanceProps {
  kpis: ProductHubKpis;
  salesByVariant: ProductHubSalesByVariant[];
}

export const ProductPerformance: React.FC<ProductPerformanceProps> = ({ kpis, salesByVariant }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp size={18} className="text-indigo-600" />
            <span>{t('productHub.performance.title', 'Customer Engagement & Conversion')}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productHub.performance.subtitle', 'First-party customer journey metrics and variant sales distribution')}
          </p>
        </div>
      </div>

      {/* Mandatory Logged-in Customer Activity Disclaimer */}
      <div className="mb-5 flex items-start gap-3 p-3.5 bg-blue-50/80 border border-blue-200/80 rounded-xl text-blue-900 text-xs">
        <Info size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {t(
            'productHub.performance.disclaimer',
            isRTL
              ? 'بيانات المشاهدات والتفاعل المعروضة تعتمد على نشاط العملاء المسجلين فقط.'
              : 'Behavioral metrics represent logged-in customer activity only.'
          )}
        </p>
      </div>

      {/* Grid of behavioral metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1: Views */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">{t('productHub.performance.views', 'Views & Reach')}</span>
            <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center">
              <Eye size={13} />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{kpis.registeredViews.toLocaleString()}</div>
          <p className="text-[11px] text-gray-400 mt-1">
            {t('productHub.performance.uniqueViewersDetail', '{{count}} unique logged-in accounts', {
              count: kpis.registeredUniqueViewers,
            })}
          </p>
        </div>

        {/* Metric 2: Cart Actions */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">{t('productHub.performance.cartActions', 'Cart Intent')}</span>
            <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <ShoppingCart size={13} />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{kpis.registeredAddToCartActions.toLocaleString()}</div>
          <p className="text-[11px] text-gray-400 mt-1">
            {t('productHub.performance.cartUnitsDetail', '{{units}} units added across {{users}} customers', {
              units: kpis.registeredUnitsAddedToCart,
              users: kpis.registeredCartCustomers,
            })}
          </p>
        </div>

        {/* Metric 3: Wishlist Interest */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">{t('productHub.performance.wishlist', 'Wishlist Saves')}</span>
            <div className="w-6 h-6 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center">
              <Heart size={13} />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{kpis.registeredWishlistAdds.toLocaleString()}</div>
          <p className="text-[11px] text-gray-400 mt-1">
            {t('productHub.performance.wishlistDetail', 'Saved by {{count}} logged-in customers', {
              count: kpis.registeredWishlistCustomers,
            })}
          </p>
        </div>

        {/* Metric 4: Conversion Rate */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-500">{t('productHub.performance.conversion', 'Viewer-to-Buyer')}</span>
            <div className="w-6 h-6 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center">
              <Target size={13} />
            </div>
          </div>
          <div className="text-xl font-bold text-gray-900">{kpis.registeredConversionRate}%</div>
          <p className="text-[11px] text-gray-400 mt-1">
            {t('productHub.performance.conversionDetail', '{{purchasers}} purchasers / {{viewers}} unique viewers', {
              purchasers: kpis.registeredPurchasingCustomers,
              viewers: kpis.registeredUniqueViewers,
            })}
          </p>
        </div>
      </div>

      {/* Historical Sales By Variant Breakdown */}
      {salesByVariant.length > 0 && (
        <div className="border border-gray-200/75 rounded-xl p-4 bg-gray-50/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <Award size={14} className="text-amber-500" />
              <span>{t('productHub.performance.salesByVariantTitle', 'Historical Sales by Option / Variant Snapshot')}</span>
            </h3>

            {kpis.bestSellingVariant && (
              <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                {t('productHub.performance.bestSeller', 'Best Seller')}: {(isRTL && kpis.bestSellingVariant.nameAr) || kpis.bestSellingVariant.name}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 font-medium">
                  <th className="py-2 px-2 text-start">{t('productHub.performance.variantSnapshotCol', 'Variant Name / Snapshot')}</th>
                  <th className="py-2 px-2 text-start">{t('productHub.performance.skuCol', 'SKU')}</th>
                  <th className="py-2 px-2 text-start">{t('productHub.performance.unitsSoldCol', 'Units Sold')}</th>
                  <th className="py-2 px-2 text-start">{t('productHub.performance.ordersCol', 'Orders')}</th>
                  <th className="py-2 px-2 text-end">{t('productHub.performance.revenueCol', 'Realized Revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {salesByVariant.map((item) => {
                  const name = (isRTL && item.nameAr) || item.name || '—';
                  return (
                    <tr key={item.key} className="hover:bg-white/60">
                      <td className="py-2 px-2 font-semibold text-gray-800">{name}</td>
                      <td className="py-2 px-2 font-mono text-gray-500">{item.sku || '—'}</td>
                      <td className="py-2 px-2 font-semibold text-gray-900 tabular-nums">{item.unitsSold}</td>
                      <td className="py-2 px-2 text-gray-600 tabular-nums">{item.orderCount}</td>
                      <td className="py-2 px-2 text-end font-semibold text-gray-900 tabular-nums">
                        {formatPrice(item.realizedRevenue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
