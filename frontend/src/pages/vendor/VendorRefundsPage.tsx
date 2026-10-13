import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Eye, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { parseVariantSnapshot } from '../../lib/variants';
import OrderItemVariant from '../../components/common/OrderItemVariant';
import { EmptyState } from '../admin/DashboardComponents';
import { REFUND_STATUSES, Refund, productImage } from '../../lib/refunds';
import { RefundEvidence, RefundStatusBadge, RefundTimeline, useRefundLabels } from '../../components/refunds/RefundParts';

const VendorRefundsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const labels = useRefundLabels();

  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [recommendFor, setRecommendFor] = useState<Refund | null>(null);
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [notes, setNotes] = useState('');

  const fetchRefunds = useCallback(async () => {
    try {
      const response = await api.get('/refunds');
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
      toast.error(t('vendor.failedSyncRefunds', 'Failed to sync refund requests list'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRefunds();
  }, [fetchRefunds]);

  const replaceRefund = (updated: Refund) => setRefunds((list) => list.map((r) => (r.id === updated.id ? updated : r)));

  const startReview = async (refund: Refund) => {
    setBusyId(refund.id);
    try {
      const response = await api.post(`/refunds/${refund.id}/review`);
      replaceRefund(response.data.refund);
      toast.success(t('returns.reviewStarted', 'Review started'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('vendor.failedUpdateRefund', 'Failed to update refund request'));
      fetchRefunds();
    } finally {
      setBusyId(null);
    }
  };

  const submitRecommendation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendFor) return;
    if (notes.trim().length < 3) {
      toast.error(t('returns.notesRequired', 'Please add a short note (at least 3 characters)'));
      return;
    }
    setBusyId(recommendFor.id);
    try {
      const response = await api.post(`/refunds/${recommendFor.id}/recommend`, { decision, notes: notes.trim() });
      replaceRefund(response.data.refund);
      toast.success(t('returns.recommendationSent', 'Recommendation sent to GoKnary'));
      setRecommendFor(null);
      setNotes('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('vendor.failedUpdateRefund', 'Failed to update refund request'));
      fetchRefunds();
    } finally {
      setBusyId(null);
    }
  };

  const query = search.toLowerCase();
  const filteredRefunds = refunds.filter((r) => {
    const matchesSearch =
      !query ||
      (r.orderItem?.product.name ?? '').toLowerCase().includes(query) ||
      (r.customer.name ?? '').toLowerCase().includes(query) ||
      r.orderId.toLowerCase().includes(query);
    return matchesSearch && (statusFilter === 'all' || r.currentStatus === statusFilter);
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('vendor.refundsTitle', 'Customer Returns')}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t('returns.vendorSubtitle', 'Review return requests for your products and send your recommendation. GoKnary makes the final decision and issues the refund.')}
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('vendor.searchRefundsPlaceholder', 'Search products, orders or customers...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Filter size={16} className="text-gray-400" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm font-semibold focus:outline-none pe-8 w-full">
            <option value="all">{t('vendor.allStatuses', 'All Statuses')}</option>
            {REFUND_STATUSES.map((s) => (
              <option key={s} value={s}>{labels.status(s)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRefunds.length === 0 ? (
          <EmptyState
            title={t('vendor.noRefundsFound', 'No Refund Requests')}
            message={t('vendor.noRefundsMatchingFilters', 'No return requests match the selected status filters.')}
          />
        ) : (
          filteredRefunds.map((refund) => {
            const product = refund.orderItem?.product;
            const productName = product ? (i18n.language === 'ar' && product.nameAr ? product.nameAr : product.name) : '';
            const isOpen = expanded === refund.id;
            return (
              <div key={refund.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                  <div className="flex gap-4 items-center max-w-sm">
                    <img src={getImageUrl(productImage(product?.images))} alt={productName} className="w-16 h-16 rounded-2xl object-cover border border-gray-50 flex-shrink-0" />
                    <div>
                      <h4 className="font-bold text-gray-900 line-clamp-2 text-sm">{productName}</h4>
                      {refund.orderItem && (
                        <>
                          <OrderItemVariant snapshot={parseVariantSnapshot(refund.orderItem.variantInfo)} className="text-xs text-gray-500" />
                          <p className="text-xs text-gray-400 mt-1">
                            {t('returns.quantityOf', '{{returned}} of {{purchased}} returned in this request', { returned: refund.quantity, purchased: refund.orderItem.quantity })}
                          </p>
                        </>
                      )}
                      <p className="text-[10px] text-purple-600 font-mono mt-0.5">#{refund.orderId.slice(0, 8)}</p>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs lg:max-w-xl">
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('vendor.customerDetails', 'Customer Details')}</span>
                      <span className="font-semibold text-gray-800">{refund.customer.name || t('vendor.anonymousUser', 'Customer')}</span>
                      <span className="block text-gray-400">
                        {new Date(refund.createdAt).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('returns.reason', 'Reason')}</span>
                      <span className="text-gray-700">{labels.reason(refund.reason)}</span>
                      {refund.description && <p className="text-gray-500 mt-0.5 line-clamp-3">{refund.description}</p>}
                    </div>
                  </div>

                  <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 flex-shrink-0">
                    <div className="text-start lg:text-end">
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('returns.refundAmount', 'Refund amount')}</p>
                      <span className="text-lg font-black text-gray-900">{formatPrice(refund.amount)}</span>
                    </div>
                    <RefundStatusBadge status={refund.currentStatus} />
                    {refund.vendorDecision && (
                      <span className="text-[11px] font-semibold text-gray-500">
                        {refund.vendorDecision === 'APPROVE'
                          ? t('returns.youRecommendedApprove', 'You recommended approval')
                          : t('returns.youRecommendedReject', 'You recommended rejection')}
                      </span>
                    )}
                  </div>
                </div>

                <RefundEvidence images={refund.images} />
                {refund.vendorNotes && (
                  <p className="text-xs text-gray-500"><span className="font-semibold text-gray-600">{t('vendor.yourActionNotes', 'Your notes')}:</span> {refund.vendorNotes}</p>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 pt-3">
                  <button type="button" onClick={() => setExpanded(isOpen ? null : refund.id)} className="text-xs font-bold text-purple-700 flex items-center gap-1">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {t('returns.timeline', 'Timeline')}
                  </button>
                  <div className="flex gap-2">
                    {refund.actions.includes('START_REVIEW') && (
                      <button
                        type="button"
                        disabled={busyId === refund.id}
                        onClick={() => startReview(refund)}
                        className="flex items-center gap-1 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold disabled:opacity-50"
                      >
                        <Eye size={14} /> {t('returns.actions.START_REVIEW', 'Start review')}
                      </button>
                    )}
                    {refund.actions.includes('RECOMMEND') && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setRecommendFor(refund); setDecision('APPROVE'); }}
                          className="flex items-center gap-1 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold"
                        >
                          <ThumbsUp size={14} /> {t('returns.recommendApprove', 'Recommend approval')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRecommendFor(refund); setDecision('REJECT'); }}
                          className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold"
                        >
                          <ThumbsDown size={14} /> {t('returns.recommendReject', 'Recommend rejection')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {isOpen && <RefundTimeline history={refund.history} />}
              </div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {recommendFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRecommendFor(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-10 text-start"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {decision === 'APPROVE' ? t('returns.recommendApprove', 'Recommend approval') : t('returns.recommendReject', 'Recommend rejection')}
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                {t('returns.recommendHelp', 'Your recommendation is shared with GoKnary, who makes the final decision. You can send it once.')}
              </p>
              <form onSubmit={submitRecommendation} className="space-y-4">
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  maxLength={2000}
                  placeholder={t('returns.recommendPlaceholder', 'Explain your recommendation...')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm"
                />
                <div className="flex gap-3">
                  <button type="button" onClick={() => setRecommendFor(null)} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 text-sm">
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={busyId === recommendFor.id}
                    className={`flex-1 py-3 text-white font-semibold rounded-xl text-sm disabled:opacity-50 ${decision === 'APPROVE' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-red-600 hover:bg-red-700'}`}
                  >
                    {busyId === recommendFor.id ? t('common.processing', 'Processing...') : t('returns.send', 'Send')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorRefundsPage;
