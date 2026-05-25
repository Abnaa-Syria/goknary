import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  MessageSquare,
  Building,
  Phone,
  Layers,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { EmptyState } from './DashboardComponents';

interface PayoutRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: string;
  vendor: {
    storeName: string;
    user: {
      name: string | null;
      email: string;
    };
  };
}

const AdminPayoutsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Action states
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);
  const [modalType, setModalType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const response = await api.get('/payouts/admin');
      setPayouts(response.data.payouts || []);
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
      toast.error(t('messages.errorOccurred', 'Failed to sync payout requests database'));
    } finally {
      setLoading(false);
    }
  };

  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayout || !modalType) return;

    setSubmitting(true);
    try {
      const status = modalType === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await api.patch(`/payouts/admin/${selectedPayout.id}`, {
        status,
        notes
      });

      toast.success(status === 'APPROVED' ? t('admin.successPayoutApproved', 'Payout request successfully approved!') : t('admin.successPayoutRejected', 'Payout request successfully rejected!'));
      setModalType(null);
      setSelectedPayout(null);
      setNotes('');
      fetchPayouts();
    } catch (error: any) {
      console.error('Failed to process payout:', error);
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to update payout request'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: PayoutRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={12} />
            {t('admin.payoutPending', 'Pending')}
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            <CheckCircle size={12} />
            {t('admin.payoutApproved', 'Approved')}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <XCircle size={12} />
            {t('admin.payoutRejected', 'Rejected')}
          </span>
        );
    }
  };

  const parseDetails = (method: string, detailsStr: string) => {
    try {
      const parsed = JSON.parse(detailsStr);
      if (method === 'BANK_TRANSFER') {
        return (
          <div className="text-xs text-gray-600">
            <p className="font-bold flex items-center gap-1 text-gray-800">
              <Building size={12} /> {parsed.bankName}
            </p>
            <p className="font-mono">A/C: {parsed.accountNumber}</p>
            <p>Name: {parsed.accountName}</p>
          </div>
        );
      } else if (method === 'VODAFONE_CASH') {
        return (
          <div className="text-xs text-gray-600">
            <p className="font-bold flex items-center gap-1 text-gray-800">
              <Phone size={12} /> Vodafone Cash
            </p>
            <p className="font-mono">{parsed.phone}</p>
          </div>
        );
      } else if (method === 'INSTAPAY') {
        return (
          <div className="text-xs text-gray-600">
            <p className="font-bold flex items-center gap-1 text-gray-800">
              <Layers size={12} /> Instapay
            </p>
            <p className="font-mono">{parsed.instapayAddress}</p>
          </div>
        );
      }
    } catch {
      return <span className="text-xs text-gray-500 font-mono truncate max-w-[200px] block">{detailsStr}</span>;
    }
  };

  const filteredPayouts = payouts.filter((p) => {
    const matchesSearch =
      p.vendor.storeName.toLowerCase().includes(search.toLowerCase()) ||
      p.vendor.user.email.toLowerCase().includes(search.toLowerCase()) ||
      p.paymentMethod.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;

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
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('admin.payoutsTitle', 'Payout Approvals')}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t('admin.payoutsSubtitle', 'Review, approve, or reject vendor earnings payout withdrawal requests.')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('admin.searchPayoutsPlaceholder', 'Search store name, email or method...')}
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
            <option value="all">{t('admin.allPayoutStatuses', 'All Statuses')}</option>
            <option value="PENDING">{t('admin.pendingOnly', 'Pending Only')}</option>
            <option value="APPROVED">{t('admin.approvedOnly', 'Approved Only')}</option>
            <option value="REJECTED">{t('admin.rejectedOnly', 'Rejected Only')}</option>
          </select>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredPayouts.length === 0 ? (
          <EmptyState
            title={t('admin.noPayoutRequests', 'No Payout Requests Found')}
            message={t('admin.noPayoutRequestsDesc', 'No payout requests match your filter query. Check back later when merchants request payouts.')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-gray-50/50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-50">
                <tr>
                  <th className="px-6 py-4 text-start">{t('admin.tableStore', 'Vendor Store')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableAmount', 'Amount')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableChannel', 'Payment Channel')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableDetails', 'Payout Details')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableDate', 'Requested Date')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableStatus', 'Status')}</th>
                  <th className="px-6 py-4 text-start">{t('admin.tableActions', 'Actions / Notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{payout.vendor.storeName}</div>
                      <div className="text-xs text-gray-400">{payout.vendor.user.email}</div>
                    </td>
                    <td className="px-6 py-4 font-black text-gray-900 text-base">
                      {formatPrice(payout.amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded uppercase">
                        {payout.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{parseDetails(payout.paymentMethod, payout.paymentDetails)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                      {new Date(payout.createdAt).toLocaleDateString(i18n.language, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                    <td className="px-6 py-4">
                      {payout.status === 'PENDING' ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setSelectedPayout(payout);
                              setModalType('APPROVE');
                            }}
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                            title={t('admin.approveSettlement', 'Approve Settlement')}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayout(payout);
                              setModalType('REJECT');
                            }}
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            title={t('admin.rejectRefund', 'Reject & Refund')}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic font-medium truncate max-w-[150px] block" title={payout.notes}>
                          {payout.notes || t('admin.noAdminNotes', 'No administrative notes')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Dialog Modal */}
      <AnimatePresence>
        {modalType && selectedPayout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => {
                setModalType(null);
                setSelectedPayout(null);
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
                {modalType === 'APPROVE' ? (
                  <>
                    <CheckCircle className="text-green-600" />
                    {t('admin.approvePayoutTitle', 'Approve Payout Request')}
                  </>
                ) : (
                  <>
                    <XCircle className="text-red-600" />
                    {t('admin.rejectPayoutTitle', 'Reject Payout Request')}
                  </>
                )}
              </h3>
              <p className="text-gray-500 text-xs mb-4 text-start">
                {modalType === 'APPROVE'
                  ? t('admin.approvePayoutDesc', 'Confirming this will mark the payout as completed. The vendor balance was already reserved.')
                  : t('admin.rejectPayoutDesc', 'Rejecting this will return the payout amount back to the vendor\'s available balance.')}
              </p>

              <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-sm space-y-1.5 text-start">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">{t('admin.summaryMerchant', 'Merchant:')}</span>
                  <span className="text-gray-800 font-bold">{selectedPayout.vendor.storeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">{t('admin.summaryAmount', 'Amount:')}</span>
                  <span className="text-gray-900 font-black">{formatPrice(selectedPayout.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">{t('admin.summaryMethod', 'Method:')}</span>
                  <span className="text-gray-800 font-bold uppercase">{selectedPayout.paymentMethod.replace('_', ' ')}</span>
                </div>
              </div>

              <form onSubmit={handleProcessPayout} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    {t('admin.refLabel', 'Administrative Notes / Ref')}
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      modalType === 'APPROVE'
                        ? t('admin.approvePayoutPlaceholder', 'Enter transaction ID, reference number or payment confirmation notes...')
                        : t('admin.rejectPayoutPlaceholder', 'Explain the reason of rejection (e.g. invalid mobile wallet number or wrong bank details)...')
                    }
                    required
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setModalType(null);
                      setSelectedPayout(null);
                      setNotes('');
                    }}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    {t('admin.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 py-3 text-white font-semibold rounded-xl transition-colors shadow-lg text-sm disabled:opacity-50 ${
                      modalType === 'APPROVE'
                        ? 'bg-green-600 hover:bg-green-700 shadow-green-100'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                    }`}
                  >
                    {submitting
                      ? t('admin.processing', 'Processing...')
                      : modalType === 'APPROVE'
                      ? t('admin.confirmApproval', 'Confirm Approval')
                      : t('admin.rejectAndRefund', 'Reject & Refund')}
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

export default AdminPayoutsPage;
