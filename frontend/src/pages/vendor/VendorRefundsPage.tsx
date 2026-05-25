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
  Eye,
  Info,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { EmptyState } from '../admin/DashboardComponents';

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
}

const VendorRefundsPage: React.FC = () => {
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
      toast.error('Failed to sync refund requests list');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRefund || !actionType) return;

    setSubmitting(true);
    try {
      const status = actionType === 'APPROVE' ? 'VENDOR_APPROVED' : 'VENDOR_REJECTED';
      await api.patch(`/refunds/${selectedRefund.id}/vendor`, {
        status,
        notes
      });

      toast.success(`Refund request is now marked as ${status.replace('_', ' ').toLowerCase()}!`);
      setActionType(null);
      setSelectedRefund(null);
      setNotes('');
      fetchRefunds();
    } catch (error: any) {
      console.error('Failed to update vendor refund status:', error);
      toast.error(error.response?.data?.error || 'Failed to update refund request');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: RefundRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            Pending Review
          </span>
        );
      case 'VENDOR_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={12} />
            Approved, Awaiting Admin
          </span>
        );
      case 'VENDOR_REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
            <Info size={12} />
            Rejected by You
          </span>
        );
      case 'ADMIN_APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={12} />
            Refunded to Wallet
          </span>
        );
      case 'ADMIN_REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={12} />
            Declined by Admin
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
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customer Returns</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Review and approve return requests for items sold from your catalog.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search products, orders or customers..."
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
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending Action</option>
            <option value="VENDOR_APPROVED">Approved by Me</option>
            <option value="VENDOR_REJECTED">Rejected by Me</option>
            <option value="ADMIN_APPROVED">Settled (Approved by Admin)</option>
            <option value="ADMIN_REJECTED">Declined by Admin</option>
          </select>
        </div>
      </div>

      {/* Refunds list */}
      <div className="space-y-4">
        {filteredRefunds.length === 0 ? (
          <EmptyState
            title="No Refund Requests"
            message="No return requests match the selected status filters."
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

            return (
              <div
                key={refund.id}
                className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between"
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
                      Qty: {refund.orderItem.quantity} × {formatPrice(refund.orderItem.price)}
                    </p>
                    <p className="text-[10px] text-purple-600 font-mono mt-0.5">Order ID: #{refund.orderId}</p>
                  </div>
                </div>

                {/* Customer and Reason */}
                <div className="flex-1 space-y-3 w-full lg:max-w-xl">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">Customer Details</span>
                      <span className="font-semibold text-gray-800">{refund.customer.name || 'Anonymous Mapped User'}</span>
                      <span className="block text-gray-400">{refund.customer.email}</span>
                    </div>
                    <div>
                      <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider">Requested Date</span>
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
                    <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider mb-1">Reason for Return</span>
                    {refund.reason}
                  </div>
                  {(refund.vendorNotes || refund.adminNotes) && (
                    <div className="text-xs space-y-1">
                      {refund.vendorNotes && <p className="text-gray-500"><span className="font-semibold text-gray-600">Your Action Notes:</span> {refund.vendorNotes}</p>}
                      {refund.adminNotes && <p className="text-red-500"><span className="font-semibold">Admin Settlement Notes:</span> {refund.adminNotes}</p>}
                    </div>
                  )}
                </div>

                {/* Financial and Actions */}
                <div className="flex lg:flex-col items-between lg:items-end justify-between w-full lg:w-auto gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-gray-50 flex-shrink-0">
                  <div className="text-start lg:text-end">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Refund Deductable</p>
                    <span className="text-lg font-black text-gray-900 block mt-0.5">
                      {formatPrice(refund.amount)}
                    </span>
                    <div className="mt-1">{getStatusBadge(refund.status)}</div>
                  </div>

                  {refund.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setActionType('APPROVE');
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <Check size={14} />
                        Approve Conditions
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRefund(refund);
                          setActionType('REJECT');
                        }}
                        className="flex items-center gap-1 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
                      >
                        <X size={14} />
                        Decline
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
                    <CheckCircle className="text-purple-600" />
                    Approve Return Request
                  </>
                ) : (
                  <>
                    <XCircle className="text-red-600" />
                    Reject Return Request
                  </>
                )}
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                {actionType === 'APPROVE'
                  ? 'Approve that the returned product condition is acceptable. This moves the ticket to platform administrator for financial refund release.'
                  : 'Rejecting this item return. Please explain why the condition was not acceptable.'}
              </p>

              <form onSubmit={handleProcessRefund} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Merchant Action Notes
                  </label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      actionType === 'APPROVE'
                        ? 'e.g. Product returned in good condition. Sealed packaging intact. Ready for refund release...'
                        : 'e.g. Product damaged by buyer. Original seal broken. Rejection confirmed...'
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
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`flex-1 py-3 text-white font-semibold rounded-xl transition-colors shadow-lg text-sm disabled:opacity-50 ${
                      actionType === 'APPROVE'
                        ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-100'
                        : 'bg-red-600 hover:bg-red-700 shadow-red-100'
                    }`}
                  >
                    {submitting
                      ? 'Processing...'
                      : actionType === 'APPROVE'
                      ? 'Approve Condition'
                      : 'Confirm Reject'}
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
