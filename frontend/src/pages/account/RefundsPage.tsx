import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  RefreshCw, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ShoppingBag,
  ExternalLink,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
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
  orderItem: {
    quantity: number;
    price: number;
    product: {
      name: string;
      slug: string;
      images: string;
    };
  };
}

const RefundsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRefunds();
  }, []);

  const fetchRefunds = async () => {
    try {
      const response = await api.get('/refunds');
      setRefunds(response.data.refunds || []);
    } catch (error) {
      console.error('Failed to fetch refunds:', error);
      toast.error('Failed to sync refund requests data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: RefundRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            {t('refund.status.pending', 'Pending Review')}
          </span>
        );
      case 'VENDOR_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={12} />
            {t('refund.status.vendorApproved', 'Vendor Approved (Awaiting Admin)')}
          </span>
        );
      case 'VENDOR_REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200">
            <Info size={12} />
            {t('refund.status.vendorRejected', 'Rejected by Merchant')}
          </span>
        );
      case 'ADMIN_APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={12} />
            {t('refund.status.adminApproved', 'Refunded to Wallet')}
          </span>
        );
      case 'ADMIN_REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={12} />
            {t('refund.status.adminRejected', 'Declined by Admin')}
          </span>
        );
    }
  };

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
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
          {t('refund.title', 'My Refund Requests')}
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          {t('refund.subtitle', 'Track item-level returns and wallet refunds.')}
        </p>
      </div>

      {refunds.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <RefreshCw size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{t('refund.noRequests', 'You have no returns submitted.')}</p>
          <Link to="/account/orders" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm font-semibold">
            <ShoppingBag size={16} />
            {t('refund.browseOrders', 'Browse Orders')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => {
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
                className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row gap-5 items-start md:items-center justify-between"
              >
                {/* Product Detail */}
                <div className="flex gap-4 items-center">
                  <img
                    src={getImageUrl(mainImg)}
                    alt={refund.orderItem.product.name}
                    className="w-16 h-16 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                  />
                  <div>
                    <h4 className="font-bold text-gray-900 line-clamp-1 text-sm">{refund.orderItem.product.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">
                      Qty: {refund.orderItem.quantity} × {formatPrice(refund.orderItem.price)}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">Order ID: #{refund.orderId}</p>
                  </div>
                </div>

                {/* Refund Reason & Status */}
                <div className="space-y-2 max-w-xs md:max-w-md w-full">
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100/50">
                    <span className="font-bold block text-[10px] uppercase text-gray-400 tracking-wider mb-1">Reason for Return</span>
                    {refund.reason}
                  </div>
                  {(refund.vendorNotes || refund.adminNotes) && (
                    <div className="text-xs italic text-gray-500 space-y-1">
                      {refund.vendorNotes && <p><span className="font-semibold text-gray-600">Merchant Notes:</span> {refund.vendorNotes}</p>}
                      {refund.adminNotes && <p><span className="font-semibold text-gray-600">Admin Notes:</span> {refund.adminNotes}</p>}
                    </div>
                  )}
                </div>

                {/* Financial Summary & Actions */}
                <div className="flex md:flex-col items-between md:items-end justify-between w-full md:w-auto gap-4 pt-4 md:pt-0 border-t md:border-t-0 border-gray-50">
                  <div className="text-start md:text-end">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Refund Amount</p>
                    <span className="text-lg font-black text-secondary-900 block mt-0.5">
                      {formatPrice(refund.amount)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {getStatusBadge(refund.status)}
                    <Link 
                      to={`/account/orders/${refund.orderId}`}
                      className="text-[10px] font-bold text-gray-400 hover:text-secondary-900 flex items-center gap-0.5 hover:underline"
                    >
                      View Order <ExternalLink size={10} />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RefundsPage;
