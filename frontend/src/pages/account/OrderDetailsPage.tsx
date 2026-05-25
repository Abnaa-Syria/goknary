import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, RotateCcw, AlertTriangle, CheckCircle2, Clock, Truck, RefreshCw, Send, Check } from 'lucide-react';
import { getImageUrl } from '../../utils/image';

interface OrderDetails {
  id: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  address: any;
  shippingMethod: string;
  paymentMethod?: string;
  paymentStatus?: string;
  vendor: {
    storeName: string;
    slug: string;
  };
  items: Array<{
    id: string; // OrderItem ID
    product: {
      id: string;
      name: string;
      slug: string;
      images: string; // backend json string
    };
    quantity: number;
    price: number;
    discountPrice?: number;
    refundRequest?: {
      id: string;
      status: 'PENDING' | 'VENDOR_APPROVED' | 'VENDOR_REJECTED' | 'ADMIN_APPROVED' | 'ADMIN_REJECTED';
      reason: string;
      amount: number;
      vendorNotes?: string;
      adminNotes?: string;
    };
  }>;
  statusHistory: Array<{
    status: string;
    notes?: string;
    createdAt: string;
  }>;
}

const OrderDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Item Refund Modal States
  const [selectedItem, setSelectedItem] = useState<OrderDetails['items'][0] | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'COD':
        return 'Cash on Delivery';
      case 'KASHIER':
        return 'Kashier';
      default:
        return method || 'Cash on Delivery';
    }
  };

  const getPaymentStatusLabel = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'PAID':
        return 'Paid';
      case 'FAILED':
        return 'Failed';
      default:
        return status || 'Pending';
    }
  };

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const response = await api.get(`/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order? This action cannot be undone and stock will be returned to the store.')) return;
    try {
      await api.patch(`/orders/${id}/cancel`);
      toast.success('Order cancelled successfully');
      fetchOrderDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to cancel order');
    }
  };

  const handleSubmitItemRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (refundReason.trim().length < 3) {
      toast.error('Please write a detailed reason (at least 3 characters)');
      return;
    }

    setSubmittingRefund(true);
    try {
      await api.post('/refunds', {
        orderItemId: selectedItem.id,
        reason: refundReason
      });

      toast.success('Return request submitted successfully!');
      setSelectedItem(null);
      setRefundReason('');
      fetchOrderDetails();
    } catch (error: any) {
      console.error('Failed to submit refund:', error);
      toast.error(error.response?.data?.error || 'Failed to request refund');
    } finally {
      setSubmittingRefund(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800';
      case 'SHIPPED':
        return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED':
        return 'bg-green-100 text-green-800 border border-green-200';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border border-red-200';
      case 'REFUNDED':
        return 'bg-orange-100 text-orange-800 border border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getRefundStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
      VENDOR_APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
      VENDOR_REJECTED: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      ADMIN_APPROVED: 'bg-green-50 text-green-700 border-green-200',
      ADMIN_REJECTED: 'bg-red-50 text-red-700 border-red-200',
    };
    return (
      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${badges[status] || 'bg-gray-100 text-gray-800'}`}>
        Refund: {status.replace('_', ' ')}
      </span>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading order details...</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">Order not found</p>
        <Link to="/account/orders" className="btn-primary inline-block">
          Back to Orders
        </Link>
      </div>
    );
  }

  return (
    <div className="text-start">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Order Details</h2>
          <p className="text-gray-500">Order #{order.id.slice(0, 8)}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {order.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">Order Items</h3>
            <div className="space-y-4">
              {order.items.map((item) => {
                const displayPrice = item.discountPrice || item.price;
                let images = [];
                try {
                  images = typeof item.product.images === 'string'
                    ? JSON.parse(item.product.images)
                    : item.product.images;
                  if (!Array.isArray(images)) images = [];
                } catch {
                  images = [];
                }
                const mainImage = images[0] || '/imgs/default-product.jpg';

                return (
                  <div key={item.id} className="flex gap-4 pb-4 border-b last:border-0 items-start">
                    <Link
                      to={`/product/${item.product.slug}`}
                      className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border border-gray-50"
                    >
                      <img
                        src={getImageUrl(mainImage)}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </Link>
                    <div className="flex-grow">
                      <div className="flex justify-between items-start gap-4">
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="font-medium hover:text-primary-500 text-sm line-clamp-1"
                        >
                          {item.product.name}
                        </Link>
                        {item.refundRequest ? (
                          getRefundStatusBadge(item.refundRequest.status)
                        ) : (
                          order.status === 'DELIVERED' && (
                            <button
                              onClick={() => setSelectedItem(item)}
                              className="text-[10px] font-bold text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-0.5"
                            >
                              <RotateCcw size={10} />
                              Return Item
                            </button>
                          )
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Quantity: {item.quantity}</p>
                      <p className="font-semibold text-sm mt-1 text-gray-700">
                        {formatPrice(displayPrice)} × {item.quantity} ={' '}
                        {formatPrice(displayPrice * item.quantity)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status History */}
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">Order Status History</h3>
            <div className="space-y-3">
              {order.statusHistory.map((history, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-2"></div>
                  <div className="flex-grow">
                    <p className="font-medium text-sm">{history.status}</p>
                    {history.notes && <p className="text-xs text-gray-500">{history.notes}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(history.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-4 space-y-6">
            {/* Vendor Info */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-gray-400 uppercase tracking-wider">Sold By</h3>
              <Link
                to={`/store/${order.vendor.slug}`}
                className="text-primary-500 hover:underline font-semibold"
              >
                {order.vendor.storeName}
              </Link>
            </div>

            {/* Shipping Address */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-gray-400 uppercase tracking-wider">Shipping Address</h3>
              <div className="text-sm text-gray-600">
                <p className="font-bold text-gray-800">{order.address.fullName}</p>
                <p>{order.address.phone}</p>
                <p>{order.address.addressLine1}</p>
                {order.address.addressLine2 && <p>{order.address.addressLine2}</p>}
                <p>
                  {order.address.city}
                  {order.address.state && `, ${order.address.state}`} {order.address.postalCode}
                </p>
                <p>{order.address.country}</p>
              </div>
            </div>

            {/* Payment Details */}
            <div>
              <h3 className="font-bold text-sm mb-2 text-gray-400 uppercase tracking-wider">Payment Info</h3>
              <div className="text-sm text-gray-600 space-y-1">
                <p>
                  <span className="font-medium text-gray-900">Method: </span>
                  {getPaymentMethodLabel(order.paymentMethod)}
                </p>
                <p>
                  <span className="font-medium text-gray-900">Status: </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    order.paymentStatus === 'PAID' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {getPaymentStatusLabel(order.paymentStatus)}
                  </span>
                </p>
              </div>
            </div>

            {/* Order Summary */}
            <div>
              <h3 className="font-bold text-sm mb-4 text-gray-400 uppercase tracking-wider">Order Summary</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Shipping</span>
                  <span>{formatPrice(order.shippingCost)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Contextual Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-gray-100">
              {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status) && (
                <button
                  onClick={handleCancelOrder}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-all border border-red-100 text-sm"
                >
                  <XCircle size={16} />
                  Cancel Order
                </button>
              )}
            </div>

            <div className="text-xs text-gray-450 text-center pt-2">
              <p>Placed on {new Date(order.createdAt).toLocaleDateString()}</p>
            </div>

            <Link
              to="/account/orders"
              className="block text-center px-4 py-3 rounded-xl border border-gray-200 font-bold text-gray-650 hover:bg-gray-50 transition-all text-sm"
            >
              Back to My Orders
            </Link>
          </div>
        </div>
      </div>

      {/* Item Refund Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setSelectedItem(null)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10 text-start"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <RotateCcw className="text-purple-600 animate-spin-reverse" />
                Return Item Refund Request
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                You are requesting a return for: <span className="font-bold text-gray-800">{selectedItem.product.name}</span>
              </p>

              <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Refund Estimate:</span>
                  <span className="text-purple-600 font-black text-sm">
                    {formatPrice((selectedItem.discountPrice || selectedItem.price) * selectedItem.quantity)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Quantity:</span>
                  <span className="text-gray-800 font-bold">{selectedItem.quantity} unit(s)</span>
                </div>
              </div>

              <form onSubmit={handleSubmitItemRefund} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Reason for Return
                  </label>
                  <textarea
                    rows={4}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                    placeholder="Describe why you want to return this product (e.g. wrong size, damaged package, defective item)..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedItem(null);
                      setRefundReason('');
                    }}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRefund}
                    className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100 text-sm disabled:opacity-50 flex items-center justify-center gap-1"
                  >
                    <Send size={12} />
                    {submittingRefund ? 'Submitting...' : 'Submit Request'}
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

export default OrderDetailsPage;
