import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, ShoppingBag, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { parseVariantSnapshot } from '../../lib/variants';
import OrderItemVariant from '../../components/common/OrderItemVariant';
import { CUSTOMER_STATUS_HINTS, Refund, productImage } from '../../lib/refunds';
import { RefundEvidence, RefundStatusBadge, RefundTimeline, useRefundLabels } from '../../components/refunds/RefundParts';

const RefundsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const labels = useRefundLabels();
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const fetchRefunds = async () => {
      try {
        const response = await api.get('/refunds');
        setRefunds(response.data.refunds || []);
      } catch (error) {
        console.error('Failed to fetch refunds:', error);
        toast.error(t('returns.loadFailed', 'Failed to load your return requests'));
      } finally {
        setLoading(false);
      }
    };
    fetchRefunds();
  }, [t]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{t('returns.customerTitle', 'My Returns & Refunds')}</h2>
        <p className="text-gray-500 text-sm mt-1">
          {t('returns.customerSubtitle', 'Track every return request from review to refund.')}
        </p>
      </div>

      {refunds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <RefreshCw size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{t('returns.empty', 'You have no return requests.')}</p>
          <Link to="/account/orders" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm font-semibold">
            <ShoppingBag size={16} />
            {t('refund.browseOrders', 'Browse Orders')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => {
            const product = refund.orderItem?.product;
            const productName = product ? (i18n.language === 'ar' && product.nameAr ? product.nameAr : product.name) : null;
            const isOpen = expanded === refund.id;
            return (
              <div key={refund.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-4 md:items-center justify-between">
                  <div className="flex gap-4 items-center">
                    {product ? (
                      <img src={getImageUrl(productImage(product.images))} alt={productName ?? ''} className="w-16 h-16 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                        <RefreshCw size={20} className="text-gray-400" />
                      </div>
                    )}
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm line-clamp-1">
                        {productName ?? t('returns.paymentRefundTitle', 'Refund for cancelled order')}
                      </h4>
                      {refund.orderItem && (
                        <>
                          <OrderItemVariant snapshot={parseVariantSnapshot(refund.orderItem.variantInfo)} className="text-xs text-gray-500" />
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t('returns.quantityOf', '{{returned}} of {{purchased}} returned in this request', {
                              returned: refund.quantity,
                              purchased: refund.orderItem.quantity,
                            })}
                          </p>
                        </>
                      )}
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">#{refund.orderId.slice(0, 8)}</p>
                    </div>
                  </div>
                  <div className="flex md:flex-col items-center md:items-end justify-between gap-2">
                    <div className="text-start md:text-end">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('returns.refundAmount', 'Refund amount')}</p>
                      <span className="text-lg font-black text-secondary-900">{formatPrice(refund.amount)}</span>
                    </div>
                    <RefundStatusBadge status={refund.currentStatus} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider mb-1">{t('returns.reason', 'Reason')}</span>
                    {labels.reason(refund.reason)}
                    {refund.description && <p className="text-gray-500 mt-1 whitespace-pre-line">{refund.description}</p>}
                  </div>
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-1">
                    {refund.currentStatus === 'REFUNDED' && (
                      <p><span className="font-semibold text-gray-600">{t('returns.method', 'Refund method')}:</span> {labels.method(refund.refundMethod)}</p>
                    )}
                    {refund.refundedAt && (
                      <p><span className="font-semibold text-gray-600">{t('returns.refundedAt', 'Refunded on')}:</span> {new Date(refund.refundedAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                    )}
                    {refund.adminNotes && (
                      <p><span className="font-semibold text-gray-600">{t('returns.adminNotes', 'Notes from GoKnary')}:</span> {refund.adminNotes}</p>
                    )}
                    {CUSTOMER_STATUS_HINTS[refund.currentStatus] && (
                      <p className="text-gray-500">{t(`returns.customerHint.${refund.currentStatus}`, CUSTOMER_STATUS_HINTS[refund.currentStatus] as string)}</p>
                    )}
                  </div>
                </div>

                <RefundEvidence images={refund.images} />

                <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : refund.id)}
                    className="text-xs font-bold text-secondary-900 flex items-center gap-1"
                  >
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {t('returns.timeline', 'Timeline')}
                  </button>
                  <Link to={`/account/orders/${refund.orderId}`} className="text-[11px] font-bold text-gray-400 hover:text-secondary-900 flex items-center gap-0.5 hover:underline">
                    {t('returns.viewOrder', 'View order')} <ExternalLink size={10} />
                  </Link>
                </div>
                {isOpen && <RefundTimeline history={refund.history} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RefundsPage;
