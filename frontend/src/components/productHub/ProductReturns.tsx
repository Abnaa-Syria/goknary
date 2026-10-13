import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RotateCcw, AlertCircle, ArrowUpRight, CheckCircle2, Clock, ShieldX } from 'lucide-react';
import { ProductHubRecentReturn, ProductHubKpis } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';

interface ProductReturnsProps {
  returns: ProductHubRecentReturn[];
  kpis: ProductHubKpis;
  role: 'admin' | 'vendor';
}

export const ProductReturns: React.FC<ProductReturnsProps> = ({ returns, kpis, role }) => {
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

  const renderReturnStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; icon: any }> = {
      REFUNDED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: status, icon: CheckCircle2 },
      APPROVED: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: status, icon: CheckCircle2 },
      PENDING: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: status, icon: Clock },
      PROCESSING: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: status, icon: Clock },
      REJECTED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: status, icon: ShieldX },
    };
    const current = statusMap[status] || { bg: 'bg-gray-100 text-gray-700 border-gray-200', text: status, icon: AlertCircle };
    const Icon = current.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${current.bg}`}>
        <Icon size={11} />
        <span>{current.text}</span>
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw size={18} className="text-amber-600" />
            <span>{t('productHub.returns.title', 'Returns & Refund Requests')}</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {returns.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productHub.returns.subtitle', 'Completed returned inventory, open claims, and return rate calculation')}
          </p>
        </div>

        <Link
          to={role === 'admin' ? '/admin/refunds' : '/vendor/refunds'}
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
        >
          <span>{t('productHub.returns.viewAllReturns', 'Refunds Desk')}</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-[11px] text-gray-500">{t('productHub.returns.totalRequests', 'Total Claims')}</span>
          <div className="text-base font-bold text-gray-900 mt-0.5">{kpis.totalReturnRequests}</div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-[11px] text-gray-500">{t('productHub.returns.openRequests', 'Open Claims')}</span>
          <div className={`text-base font-bold mt-0.5 ${kpis.openReturnRequests > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {kpis.openReturnRequests}
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-[11px] text-gray-500">{t('productHub.returns.refundedUnits', 'Completed Returns')}</span>
          <div className="text-base font-bold text-gray-900 mt-0.5">
            {kpis.completedReturnedUnits} <span className="text-xs font-normal text-gray-400">units</span>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
          <span className="text-[11px] text-gray-500">{t('productHub.returns.refundAmount', 'Completed Refunds')}</span>
          <div className="text-base font-bold text-emerald-700 mt-0.5">
            {formatPrice(kpis.completedRefundAmount)}
          </div>
        </div>
      </div>

      {returns.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-75" />
          <p>{t('productHub.returns.noReturns', 'No refund or return requests recorded for this product.')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-start">{t('productHub.returns.claimCol', 'Return Ref')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.returns.dateCol', 'Date')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.returns.orderCol', 'Order')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.returns.qtyCol', 'Qty')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.returns.amountCol', 'Amount')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.returns.reasonCol', 'Reason')}</th>
                <th className="py-3 px-3 text-end">{t('productHub.returns.statusCol', 'Status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {returns.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-gray-900 whitespace-nowrap">
                    #{item.id.slice(-8).toUpperCase()}
                  </td>

                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                    {formatDate(item.createdAt)}
                  </td>

                  <td className="py-3 px-3 whitespace-nowrap">
                    <Link
                      to={role === 'admin' ? `/admin/orders/${item.orderId}` : `/vendor/orders/${item.orderId}`}
                      className="text-blue-600 hover:text-blue-800 hover:underline font-mono"
                    >
                      {item.orderNumber}
                    </Link>
                  </td>

                  <td className="py-3 px-3 font-semibold text-gray-900 tabular-nums">
                    {item.quantity}
                  </td>

                  <td className="py-3 px-3 font-semibold text-gray-900 whitespace-nowrap">
                    {formatPrice(item.amount)}
                  </td>

                  <td className="py-3 px-3 text-gray-600 max-w-[200px] truncate" title={item.reason || '—'}>
                    {item.reason || '—'}
                  </td>

                  <td className="py-3 px-3 text-end whitespace-nowrap">
                    {renderReturnStatusBadge(item.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
