import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Package,
  ShoppingBag,
  DollarSign,
  RotateCcw,
  Eye,
  Percent,
} from 'lucide-react';
import { ProductHubKpis as KpisType } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';

interface ProductHubKpisProps {
  kpis: KpisType;
}

export const ProductHubKpis: React.FC<ProductHubKpisProps> = ({ kpis }) => {
  const { t } = useTranslation();

  const cards = [
    {
      id: 'stock',
      label: t('productHub.kpis.totalStock', 'Total Stock'),
      value: kpis.totalStock.toLocaleString(),
      subtext: kpis.inFlightUnits > 0
        ? t('productHub.kpis.inFlight', '{{count}} in flight', { count: kpis.inFlightUnits })
        : t('productHub.kpis.availableNow', 'Available in inventory'),
      icon: Package,
      iconColor: 'text-blue-600 bg-blue-50 border-blue-100',
    },
    {
      id: 'unitsSold',
      label: t('productHub.kpis.unitsSold', 'Units Sold'),
      value: kpis.deliveredUnitsSold.toLocaleString(),
      subtext: t('productHub.kpis.deliveredOrders', '{{count}} delivered orders', { count: kpis.qualifyingOrdersCount }),
      icon: ShoppingBag,
      iconColor: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    },
    {
      id: 'realizedRevenue',
      label: t('productHub.kpis.realizedRevenue', 'Realized Revenue'),
      value: formatPrice(kpis.realizedRevenue),
      subtext: t('productHub.kpis.netProductSales', 'Net product sales'),
      icon: DollarSign,
      iconColor: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    },
    {
      id: 'returns',
      label: t('productHub.kpis.returns', 'Returned Units'),
      value: kpis.completedReturnedUnits.toLocaleString(),
      subtext: t('productHub.kpis.returnRateSub', '{{rate}}% return rate', { rate: kpis.returnRate }),
      icon: RotateCcw,
      iconColor: 'text-amber-600 bg-amber-50 border-amber-100',
    },
    {
      id: 'registeredViews',
      label: t('productHub.kpis.registeredViews', 'Registered Views'),
      value: kpis.registeredViews.toLocaleString(),
      subtext: t('productHub.kpis.uniqueViewers', '{{count}} unique customers', { count: kpis.registeredUniqueViewers }),
      icon: Eye,
      iconColor: 'text-purple-600 bg-purple-50 border-purple-100',
    },
    {
      id: 'registeredConversion',
      label: t('productHub.kpis.registeredConversion', 'Registered Conversion'),
      value: `${kpis.registeredConversionRate}%`,
      subtext: t('productHub.kpis.purchasersCount', '{{count}} purchasing customers', { count: kpis.registeredPurchasingCustomers }),
      icon: Percent,
      iconColor: 'text-cyan-600 bg-cyan-50 border-cyan-100',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col justify-between hover:border-gray-300 transition-all"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500 truncate" title={card.label}>
                {card.label}
              </span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0 ${card.iconColor}`}>
                <Icon size={14} />
              </div>
            </div>

            <div>
              <div className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                {card.value}
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={card.subtext}>
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};
