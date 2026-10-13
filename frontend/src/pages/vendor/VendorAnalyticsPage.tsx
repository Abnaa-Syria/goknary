import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DollarSign, Wallet, ShoppingBag, Package, Eye, TrendingUp, RefreshCw, Receipt,
  AlertTriangle, Lightbulb, Search, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { mapEnum, orderStatusMap } from '../../utils/localization';
import { getImageUrl } from '../../utils/image';
import { StatCard } from '../admin/DashboardComponents';
import { formatRate, RateTrend, toStatTrend, ValueTrend } from '../../lib/vendorAnalytics';

interface ProductRef {
  name: string | null;
  nameAr?: string | null;
  slug?: string | null;
  image?: string | null;
}

interface InventoryItem {
  productId: string;
  name: string;
  nameAr: string | null;
  stock: number;
  lowStockThreshold: number;
  soldOutOptions: number;
}

interface Insight {
  type: string;
  severity: 'high' | 'medium' | 'low' | 'info';
  productId?: string;
  title: string;
  message: string;
  params: Record<string, string | number>;
  suggestedAction: string;
}

interface Analytics {
  summary: {
    totalOrders: number;
    deliveredOrders?: number;
    totalSales: number;
    pendingOrders?: number;
    pendingSales?: number;
    pendingEarnings?: number;
    deliveredEarnings?: number;
    period: string;
    grossSales?: number;
    refundedAmount?: number;
    netSales?: number;
    vendorEarnings?: number;
    averageOrderValue?: number | null;
    cancelledOrders?: number;
    cancellationRate?: number | null;
    unitsSold?: number;
    returnedQuantity?: number;
    returnRate?: number | null;
    openReturnRequests?: number;
    views?: number;
    uniqueViewers?: number;
    cartActions?: number;
    unitsAddedToCart?: number;
    cartCustomers?: number;
    wishlistAdds?: number;
    wishlistCustomers?: number;
    purchasingCustomers?: number;
    conversionRate?: number | null;
    addToCartRate?: number | null;
    wishlistRate?: number | null;
  };
  trends?: Record<string, ValueTrend | RateTrend>;
  funnel?: {
    viewers: number;
    cartCustomers: number;
    purchasingCustomers: number;
    viewToCartRate: number | null;
    cartToPurchaseRate: number | null;
    viewToPurchaseRate: number | null;
  };
  ordersByStatus: Array<{ status: string; count: number }>;
  salesByDay: Array<{ date: string; orders: number; sales: number }>;
  topProducts: Array<{ product: ProductRef | null; quantitySold: number; grossSales?: number }>;
  topProductsByRevenue?: Array<{ productId: string; product: ProductRef; grossSales: number; unitsSold: number }>;
  mostViewed?: Array<{ productId: string; product: ProductRef; views: number; uniqueViewers: number }>;
  inventory?: {
    lowStockCount: number;
    outOfStockCount: number;
    lowStock: InventoryItem[];
    outOfStock: InventoryItem[];
    partiallySoldOut: InventoryItem[];
  };
  searchDemand?: Array<{ query: string; searches: number; averageResults: number; lowResults: boolean }>;
  insights?: Insight[];
}

interface ProductRow {
  productId: string;
  name: string;
  nameAr: string | null;
  image: string | null;
  status: string;
  stock: number;
  views: number;
  uniqueViewers: number;
  cartCustomers: number;
  wishlistCustomers: number;
  purchasingCustomers: number;
  unitsSold: number;
  grossSales: number;
  conversionRate: number | null;
  addToCartRate: number | null;
  returnedQuantity: number;
  returnRate: number | null;
}

const PRODUCT_SORTS = ['views', 'sales', 'units', 'conversion', 'returns', 'stock'] as const;
const PAGE_SIZE = 10;

const SEVERITY_STYLE: Record<Insight['severity'], string> = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low: 'border-blue-200 bg-blue-50',
  info: 'border-gray-200 bg-gray-50',
};

const VendorAnalyticsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [sort, setSort] = useState<(typeof PRODUCT_SORTS)[number]>('views');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const localName = (item: { name?: string | null; nameAr?: string | null } | null | undefined) =>
    (isRTL && item?.nameAr) || item?.name || t('vendor.unknownProduct', 'Unknown Product');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .get(`/vendor/analytics?period=${period}`)
      .then((response) => active && setAnalytics(response.data))
      .catch((error) => console.error('Failed to fetch analytics:', error))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [period]);

  const fetchRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const response = await api.get('/vendor/analytics/products', { params: { period, sort, page, limit: PAGE_SIZE } });
      setRows(response.data.products || []);
      setTotalPages(Math.max(1, response.data.pagination?.totalPages || 1));
    } catch (error) {
      console.error('Failed to fetch product analytics:', error);
    } finally {
      setRowsLoading(false);
    }
  }, [period, sort, page]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  if (loading && !analytics) {
    return <div className="text-center py-8">{t('common.loading', 'Loading analytics...')}</div>;
  }
  if (!analytics) {
    return <div className="text-center py-8 text-gray-500">{t('vendor.noDataAvailable', 'No Data Available')}</div>;
  }

  const s = analytics.summary;
  const trends = analytics.trends || {};
  const funnel = analytics.funnel;
  const inventory = analytics.inventory;
  const insights = analytics.insights || [];
  const chartData = analytics.salesByDay.map((d) => ({
    name: new Date(d.date).toLocaleDateString(isRTL ? 'ar-EG' : 'en', { month: 'short', day: 'numeric' }),
    sales: d.sales,
    orders: d.orders,
  }));
  const hasSales = analytics.salesByDay.some((d) => d.sales > 0);

  const secondary: Array<[string, string]> = [
    [t('vendor.analyticsPage.refundedAmount', 'Refunded'), formatPrice(s.refundedAmount || 0)],
    [
      t('vendor.averageOrderValue', 'Average Order Value'),
      s.averageOrderValue == null ? t('vendor.analyticsPage.notAvailable', 'N/A') : formatPrice(s.averageOrderValue),
    ],
    [t('vendor.analyticsPage.cancellationRate', 'Cancellation rate'), formatRate(s.cancellationRate, t)],
    [t('vendor.analyticsPage.openReturns', 'Open return requests'), String(s.openReturnRequests || 0)],
    [t('vendor.pendingEarnings', 'Pending Earnings'), formatPrice(s.pendingEarnings || 0)],
    [t('vendor.pendingSales', 'Pending Sales'), formatPrice(s.pendingSales || 0)],
    [t('vendor.analyticsPage.addToCartRate', 'Add-to-cart rate'), formatRate(s.addToCartRate, t)],
    [t('vendor.analyticsPage.wishlistRate', 'Wishlist rate'), formatRate(s.wishlistRate, t)],
    [
      t('vendor.analyticsPage.cartActivity', 'Cart adds (actions / units)'),
      `${s.cartActions || 0} / ${s.unitsAddedToCart || 0}`,
    ],
    [
      t('vendor.analyticsPage.wishlistActivity', 'Wishlist adds (adds / customers)'),
      `${s.wishlistAdds || 0} / ${s.wishlistCustomers || 0}`,
    ],
  ];

  const funnelStages = funnel
    ? [
        { label: t('vendor.analyticsPage.funnelViewed', 'Viewed a product'), value: funnel.viewers, rate: null as number | null },
        { label: t('vendor.analyticsPage.funnelCart', 'Added to cart'), value: funnel.cartCustomers, rate: funnel.viewToCartRate },
        { label: t('vendor.analyticsPage.funnelPurchased', 'Purchased'), value: funnel.purchasingCustomers, rate: funnel.cartToPurchaseRate },
      ]
    : [];
  const funnelMax = Math.max(1, ...funnelStages.map((stage) => stage.value));

  const renderInsight = (insight: Insight, index: number) => {
    const base = `vendor.analyticsPage.insights.${insight.type}`;
    return (
      <div key={`${insight.type}-${insight.productId ?? index}`} className={`rounded-xl border p-4 ${SEVERITY_STYLE[insight.severity]}`}>
        <p className="text-sm font-bold text-gray-900">{t(`${base}.title`, insight.title)}</p>
        <p className="text-sm text-gray-700 mt-1">{t(`${base}.message`, { ...insight.params, defaultValue: insight.message })}</p>
        <p className="text-xs text-gray-500 mt-2">→ {t(`${base}.action`, insight.suggestedAction)}</p>
      </div>
    );
  };

  const renderTopList = (
    title: string,
    items: Array<{ key: string; product: ProductRef | null; value: string }>
  ) => (
    <div className="card p-6">
      <h3 className="text-lg font-bold mb-4">{title}</h3>
      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div key={item.key} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-purple-50 text-purple-700 text-xs font-bold flex items-center justify-center">{index + 1}</span>
              <span className="flex-1 text-gray-700 truncate">{localName(item.product)}</span>
              <span className="font-bold whitespace-nowrap">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const inventoryRows: Array<{ item: InventoryItem; kind: 'out' | 'low' | 'partial' }> = [
    ...(inventory?.outOfStock || []).map((item) => ({ item, kind: 'out' as const })),
    ...(inventory?.lowStock || []).map((item) => ({ item, kind: 'low' as const })),
    ...(inventory?.partiallySoldOut || []).map((item) => ({ item, kind: 'partial' as const })),
  ];

  return (
    <div className="space-y-8">
      {/* A. Period selector */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold">{t('vendor.analytics', 'Analytics')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t('vendor.analyticsPage.comparedWithPreviousPeriod', 'Compared with the previous period of the same length.')}
          </p>
        </div>
        <select
          value={period}
          onChange={(e) => {
            setPeriod(e.target.value);
            setPage(1);
          }}
          className="input-field w-auto"
        >
          <option value="7">{t('vendor.last7Days', 'Last 7 Days')}</option>
          <option value="30">{t('vendor.last30Days', 'Last 30 Days')}</option>
          <option value="90">{t('vendor.last90Days', 'Last 90 Days')}</option>
          <option value="365">{t('vendor.analyticsPage.lastYear', 'Last year')}</option>
        </select>
      </div>

      {/* B. Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard title={t('vendor.analyticsPage.grossSales', 'Gross Sales')} value={formatPrice(s.grossSales ?? s.totalSales)} icon={DollarSign} trend={toStatTrend(trends.grossSales, t)} color="success" />
        <StatCard title={t('vendor.analyticsPage.netSales', 'Net Sales')} value={formatPrice(s.netSales ?? s.totalSales)} icon={Receipt} trend={toStatTrend(trends.netSales, t)} color="success" />
        <StatCard title={t('vendor.analyticsPage.vendorEarnings', 'Vendor Earnings')} value={formatPrice(s.vendorEarnings ?? s.deliveredEarnings ?? 0)} icon={Wallet} trend={toStatTrend(trends.vendorEarnings, t)} color="success" />
        <StatCard title={t('vendor.totalOrders', 'Total Orders')} value={s.totalOrders} icon={ShoppingBag} trend={toStatTrend(trends.totalOrders, t)} color="primary" />
        <StatCard title={t('vendor.analyticsPage.unitsSold', 'Units Sold')} value={s.unitsSold || 0} icon={Package} trend={toStatTrend(trends.unitsSold, t)} color="info" />
        <StatCard
          title={t('vendor.analyticsPage.viewsAndViewers', 'Views / Unique customers')}
          value={`${s.views || 0} / ${s.uniqueViewers || 0}`}
          icon={Eye}
          trend={toStatTrend(trends.views, t)}
          color="info"
        />
        <StatCard title={t('vendor.analyticsPage.conversionRate', 'Conversion Rate')} value={formatRate(s.conversionRate, t)} icon={TrendingUp} trend={toStatTrend(trends.conversionRate, t)} color="primary" />
        <StatCard title={t('vendor.analyticsPage.returnRate', 'Return Rate')} value={formatRate(s.returnRate, t)} icon={RefreshCw} trend={toStatTrend(trends.returnRate, t, false)} color="warning" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {secondary.map(([label, value]) => (
          <div key={label} className="card p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-lg font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 text-xs text-gray-500 space-y-1">
        <p>{t('vendor.analyticsPage.defGrossSales', 'Gross Sales: delivered, payment-confirmed orders of this period, product value after coupons, excluding shipping, before refunds.')}</p>
        <p>{t('vendor.analyticsPage.defNetSales', 'Net Sales: Gross Sales minus completed refunds of those orders. Vendor Earnings: Gross Sales after platform commission.')}</p>
        <p>{t('vendor.analyticsPage.defConversion', 'Conversion: unique customers who bought ÷ unique logged-in customers who viewed. Return rate: refunded units ÷ delivered units.')}</p>
      </div>

      {/* C. Funnel */}
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-1">{t('vendor.analyticsPage.funnelTitle', 'Customer funnel')}</h3>
        <p className="text-xs text-gray-500 mb-4">{t('vendor.analyticsPage.funnelHint', 'Unique logged-in customers at each step in this period.')}</p>
        {funnel && funnel.viewers + funnel.cartCustomers + funnel.purchasingCustomers > 0 ? (
          <div className="space-y-3">
            {funnelStages.map((stage) => (
              <div key={stage.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{stage.label}</span>
                  <span className="font-bold">
                    {stage.value}
                    {stage.rate !== null && <span className="text-gray-500 font-normal ms-2">({formatRate(stage.rate, t)})</span>}
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(100, (stage.value / funnelMax) * 100)}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-500">
              {t('vendor.analyticsPage.viewToPurchase', 'View → purchase')}: {formatRate(funnel.viewToPurchaseRate, t)}
            </p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</p>
        )}
      </div>

      {/* D. Sales trend */}
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4">{t('vendor.analyticsPage.salesTrend', 'Daily gross sales')}</h3>
        {hasSales ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} minTickGap={16} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip formatter={(val: any, key: any) => (key === 'sales' ? formatPrice(Number(val)) : val)} />
                <Area type="monotone" dataKey="sales" stroke="#a855f7" strokeWidth={2} fill="#a855f7" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</p>
        )}
      </div>

      {/* H. Insights */}
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-500" /> {t('vendor.analyticsPage.insightsTitle', 'Insights & recommendations')}
        </h3>
        {insights.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noInsights', 'Nothing needs your attention right now.')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{insights.map(renderInsight)}</div>
        )}
      </div>

      {/* E. Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderTopList(
          t('vendor.analyticsPage.bestSellers', 'Best sellers (units)'),
          analytics.topProducts.map((item, i) => ({ key: `u${i}`, product: item.product, value: `${item.quantitySold} ${t('vendor.sold', 'sold')}` }))
        )}
        {renderTopList(
          t('vendor.analyticsPage.topRevenue', 'Top revenue products'),
          (analytics.topProductsByRevenue || []).map((item) => ({ key: item.productId, product: item.product, value: formatPrice(item.grossSales) }))
        )}
        {renderTopList(
          t('vendor.analyticsPage.mostViewed', 'Most viewed'),
          (analytics.mostViewed || []).map((item) => ({
            key: item.productId,
            product: item.product,
            value: t('vendor.analyticsPage.viewsCount', '{{views}} views · {{viewers}} customers', { views: item.views, viewers: item.uniqueViewers }),
          }))
        )}
      </div>

      {/* F. Product performance table */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-bold">{t('vendor.analyticsPage.productPerformance', 'Product performance')}</h3>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as (typeof PRODUCT_SORTS)[number]);
              setPage(1);
            }}
            className="input-field w-auto"
          >
            {PRODUCT_SORTS.map((key) => (
              <option key={key} value={key}>{t(`vendor.analyticsPage.sort.${key}`, key)}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs border-b">
                <th className="text-start py-2 pe-3">{t('vendor.analyticsPage.colProduct', 'Product')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colViews', 'Views / customers')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colCart', 'Cart')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colWishlist', 'Wishlist')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colBuyers', 'Buyers')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colUnits', 'Units sold')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colSales', 'Gross sales')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colConversion', 'Conversion')}</th>
                <th className="text-end px-2">{t('vendor.analyticsPage.colReturns', 'Returns')}</th>
                <th className="text-end ps-2">{t('vendor.analyticsPage.colStock', 'Stock')}</th>
              </tr>
            </thead>
            <tbody className={rowsLoading ? 'opacity-50' : ''}>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center text-gray-500 py-6">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.productId} className="border-b last:border-0">
                    <td className="py-2 pe-3">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        {row.image && <img src={getImageUrl(row.image)} alt="" className="w-8 h-8 rounded object-cover" />}
                        <span className="truncate">{localName(row)}</span>
                      </div>
                    </td>
                    <td className="text-end px-2">{row.views} / {row.uniqueViewers}</td>
                    <td className="text-end px-2">{row.cartCustomers}</td>
                    <td className="text-end px-2">{row.wishlistCustomers}</td>
                    <td className="text-end px-2">{row.purchasingCustomers}</td>
                    <td className="text-end px-2">{row.unitsSold}</td>
                    <td className="text-end px-2 whitespace-nowrap">{formatPrice(row.grossSales)}</td>
                    <td className="text-end px-2">{formatRate(row.conversionRate, t)}</td>
                    <td className="text-end px-2">{row.returnedQuantity} ({formatRate(row.returnRate, t)})</td>
                    <td className={`text-end ps-2 ${row.stock <= 0 ? 'text-red-600 font-bold' : ''}`}>{row.stock}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2 mt-4 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg border disabled:opacity-40"
            aria-label={t('common.previous', 'Previous')}
          >
            {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
          <span>{page} / {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg border disabled:opacity-40"
            aria-label={t('common.next', 'Next')}
          >
            {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* G. Inventory alerts */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            {t('vendor.analyticsPage.inventoryAlerts', 'Inventory alerts')}
            <span className="text-xs font-normal text-gray-500">
              ({inventory?.outOfStockCount || 0} {t('vendor.analyticsPage.outOfStock', 'out of stock')}, {inventory?.lowStockCount || 0} {t('vendor.analyticsPage.lowStock', 'low')})
            </span>
          </h3>
          {inventoryRows.length === 0 ? (
            <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.stockHealthy', 'All published products are above their low-stock level.')}</p>
          ) : (
            <div className="space-y-2">
              {inventoryRows.map(({ item, kind }) => (
                <div key={`${kind}-${item.productId}`} className="flex justify-between items-center text-sm">
                  <span className="truncate text-gray-700">{localName(item)}</span>
                  <span className={`font-bold whitespace-nowrap ${kind === 'out' ? 'text-red-600' : 'text-amber-600'}`}>
                    {kind === 'out' && t('vendor.analyticsPage.outOfStockLabel', 'Out of stock')}
                    {kind === 'low' && t('vendor.analyticsPage.lowStockLabel', '{{stock}} left (alert at {{threshold}})', { stock: item.stock, threshold: item.lowStockThreshold })}
                    {kind === 'partial' && t('vendor.analyticsPage.soldOutOptions', '{{count}} options sold out', { count: item.soldOutOptions })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search demand */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
            <Search size={18} className="text-purple-500" /> {t('vendor.analyticsPage.searchDemand', 'What customers search for')}
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            {t('vendor.analyticsPage.searchDemandHint', 'Platform-wide searches related to your catalog (aggregated, searched at least 3 times).')}
          </p>
          {(analytics.searchDemand || []).length === 0 ? (
            <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</p>
          ) : (
            <div className="space-y-2">
              {(analytics.searchDemand || []).map((item) => (
                <div key={item.query} className="flex justify-between items-center text-sm">
                  <span className="truncate text-gray-700">
                    “{item.query}”
                    {item.lowResults && (
                      <span className="ms-2 text-[10px] font-bold bg-blue-50 text-blue-700 rounded-full px-2 py-0.5">
                        {t('vendor.analyticsPage.opportunity', 'Opportunity')}
                      </span>
                    )}
                  </span>
                  <span className="text-gray-500 whitespace-nowrap">
                    {t('vendor.analyticsPage.searchesCount', '{{count}} searches · {{results}} results avg', { count: item.searches, results: item.averageResults })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Orders by status */}
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4">{t('vendor.orderStats', 'Order Stats')}</h3>
        {analytics.ordersByStatus.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('vendor.analyticsPage.noDataYet', 'No data yet')}</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {analytics.ordersByStatus.map((item) => (
              <div key={item.status} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-gray-600">{mapEnum(orderStatusMap, item.status)}</span>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorAnalyticsPage;
