import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronDown, ChevronUp, Zap, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { parseVariantSnapshot } from '../../lib/variants';
import OrderItemVariant from '../../components/common/OrderItemVariant';
import { EmptyState } from './DashboardComponents';
import {
  MANUAL_REFUND_METHODS,
  ManualRefundMethod,
  REFERENCE_REQUIRED_METHODS,
  REFUND_STATUSES,
  Refund,
  RefundAction,
  GatewayAvailability,
  RefundStatus,
  productImage,
} from '../../lib/refunds';
import { RefundEvidence, RefundStatusBadge, RefundTimeline, useRefundLabels } from '../../components/refunds/RefundParts';

interface PaymentIssueOrder {
  id: string;
  total: number;
  createdAt: string;
  updatedAt: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paidAt: string | null;
  user: { id: string; name: string | null; email: string };
  vendor: { id: string; storeName: string };
  paymentReferenceAvailable: boolean;
  gateway: GatewayAvailability;
  refund: { id: string; currentStatus: RefundStatus; amount: number } | null;
}

type AdminAction = Exclude<RefundAction, 'START_REVIEW' | 'RECOMMEND'>;

const ACTION_ENDPOINTS: Record<AdminAction, string> = {
  APPROVE: 'approve',
  REJECT: 'reject',
  RECEIVE: 'receive',
  START_REFUND: 'start-refund',
  COMPLETE_MANUAL: 'complete-manual',
};

const ACTION_LABELS: Record<AdminAction, string> = {
  APPROVE: 'Approve',
  REJECT: 'Reject',
  RECEIVE: 'Mark item received',
  START_REFUND: 'Start refund',
  COMPLETE_MANUAL: 'Complete manual refund',
};

const ACTION_HELP: Record<AdminAction, string> = {
  APPROVE: 'The customer will be asked to send the item back. No money or stock moves yet.',
  REJECT: 'The request is closed and the quantity becomes returnable again. Notes are shown to the customer.',
  RECEIVE: 'Confirms the item arrived. The returned quantity is added back to stock (same variant) exactly once.',
  START_REFUND: 'Moves the request to refund processing. No money moves yet.',
  COMPLETE_MANUAL: 'Records a refund you already paid outside the gateway. Wallet refunds credit the customer wallet once.',
};

const ACTION_STYLES: Record<AdminAction, string> = {
  APPROVE: 'bg-green-50 text-green-700 hover:bg-green-100',
  REJECT: 'bg-red-50 text-red-600 hover:bg-red-100',
  RECEIVE: 'bg-purple-50 text-purple-700 hover:bg-purple-100',
  START_REFUND: 'bg-orange-50 text-orange-700 hover:bg-orange-100',
  COMPLETE_MANUAL: 'bg-secondary-900 text-white hover:bg-secondary-800',
};

const AdminRefundsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const labels = useRefundLabels();
  const dateLocale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';

  const [tab, setTab] = useState<'requests' | 'payment-issues'>('requests');
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [paymentIssues, setPaymentIssues] = useState<PaymentIssueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [kindFilter, setKindFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [pending, setPending] = useState<{ refund: Refund; action: AdminAction } | null>(null);
  const [notes, setNotes] = useState('');
  const [method, setMethod] = useState<ManualRefundMethod>('WALLET');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openingFor, setOpeningFor] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [refundsRes, issuesRes] = await Promise.all([api.get('/refunds'), api.get('/refunds/payment-issues')]);
      setRefunds(refundsRes.data.refunds || []);
      setPaymentIssues(issuesRes.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
      toast.error(t('messages.errorOccurred', 'Failed to load refunds'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const closeModal = () => {
    setPending(null);
    setNotes('');
    setReference('');
    setMethod('WALLET');
  };

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pending) return;
    const { refund, action } = pending;
    if (action === 'REJECT' && notes.trim().length < 3) {
      toast.error(t('returns.notesRequired', 'Please add a short note (at least 3 characters)'));
      return;
    }
    if (action === 'COMPLETE_MANUAL' && REFERENCE_REQUIRED_METHODS.includes(method) && !reference.trim()) {
      toast.error(t('returns.referenceRequired', 'A transfer reference is required for this method'));
      return;
    }
    const body: Record<string, string> = {};
    if (notes.trim()) body.notes = notes.trim();
    if (action === 'COMPLETE_MANUAL') {
      body.method = method;
      if (reference.trim()) body.reference = reference.trim();
    }
    setSubmitting(true);
    try {
      const response = await api.post(`/refunds/${refund.id}/${ACTION_ENDPOINTS[action]}`, body);
      setRefunds((list) => list.map((r) => (r.id === refund.id ? response.data.refund : r)));
      toast.success(response.data.message || t('returns.updated', 'Request updated'));
      closeModal();
      if (refund.kind === 'CANCELLED_PAYMENT') fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to update request'));
      fetchAll();
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentRefund = async (order: PaymentIssueOrder) => {
    setOpeningFor(order.id);
    try {
      await api.post(`/refunds/orders/${order.id}/cancelled-payment`, {});
      toast.success(t('returns.paymentRefundOpened', 'Refund opened. Complete it from the requests tab.'));
      await fetchAll();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to open refund'));
    } finally {
      setOpeningFor(null);
    }
  };

  const query = search.toLowerCase();
  const filteredRefunds = refunds.filter((r) => {
    const matchesSearch =
      !query ||
      (r.orderItem?.product.name ?? '').toLowerCase().includes(query) ||
      (r.customer.name ?? '').toLowerCase().includes(query) ||
      r.customer.email.toLowerCase().includes(query) ||
      (r.vendorStoreName ?? '').toLowerCase().includes(query) ||
      r.orderId.toLowerCase().includes(query);
    return matchesSearch && (statusFilter === 'all' || r.currentStatus === statusFilter) && (kindFilter === 'all' || r.kind === kindFilter);
  });
  const openIssues = paymentIssues.filter((o) => !o.refund || o.refund.currentStatus !== 'REFUNDED').length;

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
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('returns.adminTitle', 'Returns & Refunds')}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t('returns.adminSubtitle', 'Decide on returns, confirm received items and record refunds.')}
        </p>
      </div>

      <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setTab('requests')}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === 'requests' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
        >
          {t('returns.requestsTab', 'Requests')} ({refunds.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('payment-issues')}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 ${tab === 'payment-issues' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500'}`}
        >
          {openIssues > 0 && <AlertTriangle size={14} className="text-amber-500" />}
          {t('returns.paymentIssuesTab', 'Cancelled but paid')} ({paymentIssues.length})
        </button>
      </div>

      {tab === 'requests' ? (
        <>
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder={t('admin.searchRefundsPlaceholder', 'Search products, orders or customers...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-1 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                <Filter size={16} className="text-gray-400" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-transparent text-sm font-semibold focus:outline-none pe-6 w-full">
                  <option value="all">{t('admin.allStatuses', 'All Statuses')}</option>
                  {REFUND_STATUSES.map((s) => (
                    <option key={s} value={s}>{labels.status(s)}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
                <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="bg-transparent text-sm font-semibold focus:outline-none pe-6">
                  <option value="all">{t('returns.allKinds', 'All types')}</option>
                  <option value="RETURN">{t('returns.kind.RETURN', 'Item return')}</option>
                  <option value="CANCELLED_PAYMENT">{t('returns.kind.CANCELLED_PAYMENT', 'Cancelled order payment')}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredRefunds.length === 0 ? (
              <EmptyState
                title={t('admin.noRefundRequests', 'No Refund Requests')}
                message={t('admin.noRefundRequestsDesc', 'No refund requests match the selected status filters.')}
              />
            ) : (
              filteredRefunds.map((refund) => {
                const product = refund.orderItem?.product;
                const productName = product ? (i18n.language === 'ar' && product.nameAr ? product.nameAr : product.name) : t('returns.paymentRefundTitle', 'Refund for cancelled order');
                const isOpen = expanded === refund.id;
                const adminActions = refund.actions.filter((a): a is AdminAction => a in ACTION_ENDPOINTS);
                const gateway = (refund.order.paymentMethod || '').toUpperCase() === 'KASHIER' ? refund.gateway : undefined;
                return (
                  <div key={refund.id} className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4 text-start">
                    <div className="flex flex-col lg:flex-row gap-6 lg:items-center justify-between">
                      <div className="flex gap-4 items-center max-w-sm">
                        <img src={getImageUrl(productImage(product?.images))} alt="" className="w-16 h-16 rounded-2xl object-cover border border-gray-50 flex-shrink-0" />
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
                          <p className="text-[10px] text-purple-600 font-mono mt-0.5">
                            #{refund.orderId.slice(0, 8)} · {refund.vendorStoreName ?? ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs lg:max-w-xl">
                        <div>
                          <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('admin.customerDetails', 'Customer Details')}</span>
                          <span className="font-semibold text-gray-800">{refund.customer.name || t('admin.anonymousUser', 'Anonymous User')}</span>
                          <span className="block text-gray-400">{refund.customer.email}</span>
                        </div>
                        <div>
                          <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('returns.reason', 'Reason')}</span>
                          <span className="text-gray-700">{labels.reason(refund.reason)}</span>
                          {refund.vendorDecision && (
                            <span className={`block mt-1 font-semibold ${refund.vendorDecision === 'APPROVE' ? 'text-green-600' : 'text-red-600'}`}>
                              {refund.vendorDecision === 'APPROVE'
                                ? t('returns.vendorRecommendsApprove', 'Store recommends approval')
                                : t('returns.vendorRecommendsReject', 'Store recommends rejection')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex lg:flex-col items-center lg:items-end justify-between gap-2 flex-shrink-0">
                        <div className="text-start lg:text-end">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('returns.refundAmount', 'Refund amount')}</p>
                          <span className="text-lg font-black text-purple-600">{formatPrice(refund.amount)}</span>
                        </div>
                        <RefundStatusBadge status={refund.currentStatus} />
                        {refund.isLegacy && <span className="text-[10px] text-gray-400">{t('returns.legacy', 'Legacy request')}</span>}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-50 pt-3">
                      <button type="button" onClick={() => setExpanded(isOpen ? null : refund.id)} className="text-xs font-bold text-purple-700 flex items-center gap-1">
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {t('returns.details', 'Details & timeline')}
                      </button>
                      <div className="flex flex-wrap gap-2">
                        {adminActions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            onClick={() => setPending({ refund, action })}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${ACTION_STYLES[action]}`}
                          >
                            {t(`returns.actions.${action}`, ACTION_LABELS[action])}
                          </button>
                        ))}
                        {refund.currentStatus === 'REFUND_PROCESSING' && gateway?.message && (
                          <span className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 text-gray-500 flex items-center gap-1">
                            <Zap size={12} />
                            {gateway.message}
                          </span>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
                        <div className="space-y-3">
                          {refund.description && (
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider mb-1">{t('returns.description', 'Customer description')}</span>
                              <p className="whitespace-pre-line text-gray-700">{refund.description}</p>
                            </div>
                          )}
                          <RefundEvidence images={refund.images} />
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <dt className="text-gray-400">{t('returns.order', 'Order')}</dt>
                            <dd><Link to={`/admin/orders/${refund.orderId}`} className="font-mono text-purple-700 hover:underline">#{refund.orderId.slice(0, 8)}</Link></dd>
                            <dt className="text-gray-400">{t('returns.paymentMethod', 'Payment method')}</dt>
                            <dd>{refund.order.paymentMethod ?? '—'} · {refund.order.paymentStatus ?? '—'}</dd>
                            <dt className="text-gray-400">{t('returns.orderTotal', 'Order total')}</dt>
                            <dd>{refund.order.total !== undefined ? formatPrice(refund.order.total) : '—'}</dd>
                            {gateway && (
                              <>
                                <dt className="text-gray-400">{t('returns.paymentReference', 'Payment reference')}</dt>
                                <dd>{gateway.hasPaymentReference ? t('returns.available', 'Available') : t('returns.notAvailable', 'Not available')}</dd>
                                <dt className="text-gray-400">{t('returns.gateway', 'Automatic refund')}</dt>
                                <dd className="text-gray-600">{gateway.message}</dd>
                              </>
                            )}
                            <dt className="text-gray-400">{t('returns.method', 'Refund method')}</dt>
                            <dd>{labels.method(refund.refundMethod)}</dd>
                            {refund.manualReference && (
                              <>
                                <dt className="text-gray-400">{t('returns.manualReference', 'Transfer reference')}</dt>
                                <dd className="font-mono">{refund.manualReference}</dd>
                              </>
                            )}
                            {refund.receivedAt && (
                              <>
                                <dt className="text-gray-400">{t('returns.receivedAt', 'Item received')}</dt>
                                <dd>{new Date(refund.receivedAt).toLocaleString(dateLocale)}</dd>
                              </>
                            )}
                            {refund.refundedAt && (
                              <>
                                <dt className="text-gray-400">{t('returns.refundedAt', 'Refunded on')}</dt>
                                <dd>{new Date(refund.refundedAt).toLocaleString(dateLocale)}</dd>
                              </>
                            )}
                          </dl>
                          {refund.vendorNotes && <p><span className="font-semibold text-gray-600">{t('admin.merchantNotes', 'Merchant Notes:')}</span> {refund.vendorNotes}</p>}
                          {refund.adminNotes && <p><span className="font-semibold text-gray-600">{t('admin.adminNotes', 'Admin Notes:')}</span> {refund.adminNotes}</p>}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-2">{t('returns.timeline', 'Timeline')}</p>
                          <RefundTimeline history={refund.history} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800">
            {t('returns.paymentIssuesHelp', 'These orders are cancelled but marked as paid (for example, an online payment that arrived after cancellation). Open a refund to return the money manually. Stock and store balances are not affected.')}
          </div>
          {paymentIssues.length === 0 ? (
            <EmptyState title={t('returns.noPaymentIssues', 'No cancelled paid orders')} message={t('returns.noPaymentIssuesDesc', 'Every cancelled order is unpaid or already refunded.')} />
          ) : (
            paymentIssues.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl border border-gray-100 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-start">
                <div className="space-y-1">
                  <Link to={`/admin/orders/${order.id}`} className="font-mono font-bold text-purple-700 hover:underline">#{order.id.slice(0, 8)}</Link>
                  <p className="text-gray-700 font-semibold">{order.user.name || order.user.email} · {order.vendor.storeName}</p>
                  <p className="text-gray-400">
                    {order.paymentMethod ?? '—'}
                    {order.paidAt && ` · ${t('returns.paidAt', 'Paid')} ${new Date(order.paidAt).toLocaleString(dateLocale)}`}
                  </p>
                  <p className="text-gray-400">
                    {t('returns.paymentReference', 'Payment reference')}: {order.paymentReferenceAvailable ? t('returns.available', 'Available') : t('returns.notAvailable', 'Not available')}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-lg font-black text-gray-900">{formatPrice(order.total)}</span>
                  {order.refund ? (
                    <RefundStatusBadge status={order.refund.currentStatus} />
                  ) : (
                    <button
                      type="button"
                      disabled={openingFor === order.id}
                      onClick={() => openPaymentRefund(order)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-secondary-900 text-white hover:bg-secondary-800 disabled:opacity-50"
                    >
                      {t('returns.openRefund', 'Open refund')}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {pending && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-10 text-start"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-1">{t(`returns.actions.${pending.action}`, ACTION_LABELS[pending.action])}</h3>
              <p className="text-sm font-black text-purple-600 mb-2">{formatPrice(pending.refund.amount)}</p>
              <p className="text-gray-500 text-xs mb-4">{t(`returns.actionHelp.${pending.action}`, ACTION_HELP[pending.action])}</p>

              <form onSubmit={submitAction} className="space-y-4">
                {pending.action === 'COMPLETE_MANUAL' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">{t('returns.method', 'Refund method')}</label>
                      <select value={method} onChange={(e) => setMethod(e.target.value as ManualRefundMethod)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm">
                        {MANUAL_REFUND_METHODS.map((m) => (
                          <option key={m} value={m}>{labels.method(m)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        {t('returns.manualReference', 'Transfer reference')}
                        {REFERENCE_REQUIRED_METHODS.includes(method) ? ' *' : ''}
                      </label>
                      <input
                        type="text"
                        value={reference}
                        maxLength={191}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {t('admin.adminNotesLabel', 'Administrative Notes')}{pending.action === 'REJECT' ? ' *' : ''}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    maxLength={2000}
                    onChange={(e) => setNotes(e.target.value)}
                    required={pending.action === 'REJECT'}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm"
                  />
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={closeModal} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 text-sm">
                    {t('admin.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 py-3 font-semibold rounded-xl text-sm disabled:opacity-50 ${pending.action === 'REJECT' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
                  >
                    {submitting ? t('admin.processing', 'Processing...') : t('returns.confirm', 'Confirm')}
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

export default AdminRefundsPage;
