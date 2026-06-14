import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Info,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { EmptyState } from './DashboardComponents';
import { Link } from 'react-router-dom';

interface RefundRequest {
  id: string;
  orderId: string;
  reason: string;
  amount: number;
  status: 'PENDING' | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'ADMIN_APPROVED' | 'ADMIN_REJECTED';
  vendorNotes?: string;
  adminNotes?: string;
  createdAt: string;
  customer: {
    name: string | null;
    email: string;
  };
  orderItem: {
    quantity: number;
    price: number;
    product: {
      name: string;
      images: string;
    };
  };
  vendorId: string;
  // We can join store details if needed, but we can query them or render placeholder
}

const AdminRefundsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Actions
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    try {
      const response = await api.get('/refunds');
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
      toast.error(t('messages.errorOccurred', 'Failed to sync refunds database'));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund || !actionType) return;

    setSubmitting(true);
    try {
      const status = actionType === 'APPROVE' ? 'ADMIN_APPROVED' : 'ADMIN_REJECTED';
      await api.patch(`/refunds/${selectedRefund.id}/admin`, {
        status,
        notes
      });

      toast.success(status === 'ADMIN_APPROVED' ? t('admin.successRefunded', 'Refund request successfully refunded!') : t('admin.successDeclined', 'Refund request successfully declined!'));
      setActionType(null);
      setSelectedRefund(null);
      setNotes('');
      fetchRefunds();
    } catch (error: any) {
      console.error('Failed to process refund:', error);
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to update refund request'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: RefundRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={12} />
            {t('admin.statusPending', 'Pending Merchant Approval')}
          </span>
        );
      case 'VENDOR_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Clock size={12} />
            {t('admin.statusVendorApproved', 'Vendor Approved (Awaiting Settlement)')}
          </span>
        );
      case 'VENDOR_REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
            <Info size={12} />
            {t('admin.statusVendorRejected', 'Rejected by Merchant')}
          </span>
        );
      case 'ADMIN_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle size={12} />
            {t('admin.statusAdminApproved', 'Refunded to Customer Wallet')}
          </span>
        );
      case 'ADMIN_REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle size={12} />
            {t('admin.statusAdminRejected', 'Declined by Administrator')}
          </span>
        );
    }
  };

  const filteredRefunds = refunds.filter((r) => {
    const matchesSearch =
      r.orderItem.product.name.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.name?.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.email.toLowerCase().includes(search.toLowerCase()) ||
      r.orderId.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;

    return matchesSearch && matchesStatus;
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('admin.refundsTitle', 'Refund Settlements')}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t('admin.refundsSubtitle', 'Audit customer returns and release wallet refunds.')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('admin.searchRefundsPlaceholder', 'Search products, orders or customers...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm font-semibold focus:outline-none pe-8 w-full"
          >
            <option value="all">{t('admin.allStatuses', 'All Statuses')}</option>
            <option value="PENDING">{t('admin.pendingMerchantAction', 'Pending Merchant Action')}</option>
            <option value="VENDOR_APPROVED">{t('admin.vendorApprovedSettlement', 'Vendor Approved (Needs Settlement)')}</option>
            <option value="VENDOR_REJECTED">{t('admin.vendorRejected', 'Vendor Rejected')}</option>
            <option value="ADMIN_APPROVED">{t('admin.settledApprovedAdmin', 'Settled (Approved by Admin)')}</option>
            <option value="ADMIN_REJECTED">{t('admin.declinedAdmin', 'Declined by Admin')}</option>
          </select>
        </div>
      </div>

      {/* Refunds list */}
      <div className="space-y-4">
        {filteredRefunds.length === 0 ? (
          <EmptyState
            title={t('admin.noRefundRequests', 'No Refund Requests')}
            message={t('admin.noRefundRequestsDesc', 'No refund requests match the selected status filters.')}
          />
        ) : (
          filteredRefunds.map((refund) => {
            let images = [];
            try {
              images = typeof refund.orderItem.product.images === 'string'
                ? JSON.parse(refund.orderItem.product.images)
                : refund.orderItem.product.images;
              if (!Array.isArray(images)) images = [];
            } catch {
              images = [];
            }
            const mainImg = images[0] || '/imgs/default-product.jpg';

            const canAdminProcess = ['PENDING', 'VENDOR_APPROVED', 'VENDOR_REJECTED'].includes(refund.status);

            return (
              <div
                key={refund.id}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between text-start"
              >
                {/* Product Detail */}
                <div className="flex gap-4 items-center max-w-sm">
                  <img
                    src={getImageUrl(mainImg)}
                    alt={refund.orderItem.product.name}
                    className="w-16 h-16 rounded-2xl object-cover border border-gray-50 flex-shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-gray-900 line-clamp-2 text-sm">{refund.orderItem.product.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      {t('admin.qty', 'Qty:')} {refund.orderItem.quantity} × {formatPrice(refund.orderItem.price)}
                    </p>
                    <p className="text-[10px] text-purple-600 font-mono mt-0.5">{t('admin.orderId', 'Order ID:')} #{refund.orderId}</p>
                  </div>
                </div>

                {/* Customer and Reason */}
                <div className="flex-1 space-y-3 w-full lg:max-w-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('admin.customerDetails', 'Customer Details')}</span>
                      <span className="font-semibold text-gray-800">{refund.customer.name || t('admin.anonymousUser', 'Anonymous User')}</span>
                      <span className="block text-gray-400">{refund.customer.email}</span>
                    </div>
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">{t('admin.requestedDate', 'Requested Date')}</span>
                      <span className="text-gray-600 font-medium">
                        {new Date(refund.createdAt).toLocaleDateString(i18n.language, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-600 bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                    <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider mb-1">{t('admin.reasonReturn', 'Reason for Return')}</span>
                    {refund.reason}
                  </div>
                  {(refund.vendorNotes || refund.adminNotes) && (
                    <div className="text-xs space-y-1">
                      {refund.vendorNotes && <p className="text-gray-500"><span className="font-semibold text-gray-600">{t('admin.merchantNotes', 'Merchant Notes:')}</span> {refund.vendorNotes}</p>}
                      {refund.adminNotes && <p className="text-purple-600 font-semibold"><span className="text-gray-600 font-normal">{t('admin.adminNotes', 'Admin Notes:')}</span> {refund.adminNotes}</p>}
                    </div>
                  )}
                </div>

                {/* Financial and Actions */}
                <div className="flex lg:flex-col items-between lg:items-end justify-between w-full lg:w-auto gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-50 flex-shrink-0">
                  <div className="text-start lg:text-end">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('admin.refundAmount', 'Refund Amount')}</p>
                    <span className="text-lg font-black text-purple-600 block mt-0.5">
                      {formatPrice(refund.amount)}
                    </span>
                    <div className="mt-1">{getStatusBadge(refund.status)}</div>
                  </div>

                  {canAdminProcess && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setActionType('APPROVE');
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <Check size={14} />
                        {t('admin.releaseRefund', 'Release Refund')}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setActionType('REJECT');
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <X size={14} />
                        {t('admin.decline', 'Decline')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Action Dialog Modal */}
      <AnimatePresence>
        {actionType && selectedRefund && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setActionType(null);
                setSelectedRefund(null);
                setNotes('');
              }}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                {actionType === 'APPROVE' ? (
                  <>
                    <CheckCircle className="text-green-600" />
                    {t('admin.approveReleaseRefund', 'Approve & Release Refund')}
                  </>
                ) : (
                  <>
                    <XCircle className="text-red-600" />
                    {t('admin.declineRefundRequest', 'Decline Refund Request')}
                  </>
                )}
              </h3>
              <p className="text-gray-500 text-xs mb-4 text-start">
                {actionType === 'APPROVE'
                  ? t('admin.approveConfirmText', "Confirming this will release the funds to customer's wallet balance. This is processed inside an interactive database transaction to deduct net earnings from the merchant and increment product stock.")
                  : t('admin.declineConfirmText', 'Declining this refund request. Please enter reason notes to explain to customer.')}
              </p>

              <form onSubmit={handleProcessRefund} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {t('admin.adminNotesLabel', 'Administrative Notes')}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      actionType === 'APPROVE'
                        ? t('admin.approveNotesPlaceholder', 'e.g. Refund approved. Funds released to customer electronic wallet. Stock replenished...')
                        : t('admin.declineNotesPlaceholder', 'e.g. Refund request declined. Return window expired or merchant inspection failed...')
                    }
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setActionType(null);
                      setSelectedRefund(null);
                      setNotes('');
                    }}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    {t('admin.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 py-3 text-white font-semibold rounded-xl transition-colors shadow-lg text-sm disabled:opacity-50 ${actionType === 'APPROVE'
                        ? 'bg-green-600 hover:bg-green-700 shadow-green-100'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                      }`}
                  >
                    {submitting
                      ? t('admin.processing', 'Processing...')
                      : actionType === 'APPROVE'
                        ? t('admin.releaseFunds', 'Release Funds')
                        : t('admin.confirmDecline', 'Confirm Decline')}
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
