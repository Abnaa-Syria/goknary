import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag, ArrowUpRight, Package, User } from 'lucide-react';
import { ProductHubRecentOrder } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';
import OrderItemVariant from '../common/OrderItemVariant';

interface ProductRecentOrdersProps {
  orders: ProductHubRecentOrder[];
  role: 'admin' | 'vendor';
}

export const ProductRecentOrders: React.FC<ProductRecentOrdersProps> = ({ orders, role }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const formatDate = (dateStr: string) => {
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

  const renderOrderStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      SHIPPED: 'bg-blue-50 text-blue-700 border-blue-200',
      PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      CONFIRMED: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
      REFUNDED: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  const renderPaymentStatusBadge = (status: string) => {
    const isPaid = status === 'PAID';
    return (
      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium border ${
        isPaid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}>
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={18} className="text-blue-600" />
            <span>{t('productHub.recentOrders.title', 'Recent Qualifying Orders')}</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {orders.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productHub.recentOrders.subtitle', 'Latest 5 orders containing this product with verified line amounts and historical snapshots')}
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p>{t('productHub.recentOrders.noOrders', 'No orders recorded yet for this product.')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.orderRefCol', 'Order')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.dateCol', 'Date')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.variantCol', 'Purchased Variant Snapshot')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.qtyCol', 'Qty')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.amountCol', 'Net Line Paid')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.statusCol', 'Status')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.recentOrders.customerCol', 'Customer')}</th>
                <th className="py-3 px-3 text-end">{t('productHub.recentOrders.actionCol', 'Action')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map((order) => {
                const orderLink = role === 'admin' ? `/admin/orders/${order.id}` : `/vendor/orders/${order.id}`;

                return (
                  <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
                      <Link
                        to={orderLink}
                        className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>

                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="py-3 px-3 max-w-[280px]">
                      {order.lines && order.lines.length > 1 ? (
                        <div className="space-y-1.5">
                          {order.lines.map((line) => (
                            <div
                              key={line.id}
                              className="flex items-start gap-1.5 text-xs text-gray-700 bg-gray-50/90 px-2 py-1 rounded-lg border border-gray-100"
                            >
                              <span className="font-semibold text-gray-900 tabular-nums">
                                {line.quantity}×
                              </span>
                              <div className="flex-1 min-w-0">
                                {line.variantSnapshot ? (
                                  <OrderItemVariant snapshot={line.variantSnapshot} />
                                ) : (
                                  <span className="text-gray-400">
                                    {t('productHub.recentOrders.baseProduct', 'Base Product')}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : order.lines && order.lines.length === 1 && order.lines[0].variantSnapshot ? (
                        <OrderItemVariant snapshot={order.lines[0].variantSnapshot} />
                      ) : order.variantSnapshot ? (
                        <OrderItemVariant snapshot={order.variantSnapshot} />
                      ) : (
                        <span className="text-gray-400">{t('productHub.recentOrders.baseProduct', 'Base Product')}</span>
                      )}
                    </td>

                    <td className="py-3 px-3 font-semibold text-gray-900 tabular-nums">
                      {order.quantity}
                    </td>

                    <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
                      <div>{formatPrice(order.realizedRevenue)}</div>
                      {(!order.lines || order.lines.length <= 1) && order.unitPrice > 0 && (
                        <div className="text-[10px] text-gray-400 font-normal">
                          @{formatPrice(order.unitPrice)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        {renderOrderStatusBadge(order.orderStatus)}
                        {renderPaymentStatusBadge(order.paymentStatus)}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {order.customer ? (
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-gray-400 flex-shrink-0" />
                          <div className="truncate max-w-[140px]">
                            <div className="font-medium text-gray-800">{order.customer.name}</div>
                            {role === 'admin' && order.customer.email && (
                              <div className="text-[10px] text-gray-400 truncate">{order.customer.email}</div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-end whitespace-nowrap">
                      <Link
                        to={orderLink}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <span>{t('productHub.recentOrders.viewOrder', 'View')}</span>
                        <ArrowUpRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
