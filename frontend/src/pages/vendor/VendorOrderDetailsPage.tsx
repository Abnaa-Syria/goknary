import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { Clock, CheckCircle2, Package, Truck, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id: string;
  quantity: number;
  price: number;
  discountPrice?: number | null;
  product: {
    name: string;
    images?: string[] | string;
    category?: {
      name: string;
    } | null;
  };
}

interface OrderDetails {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  user: {
    name: string | null;
    email: string;
    phone?: string | null;
  };
  address: {
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  items: OrderItem[];
  statusHistory: Array<{
    id: string;
    status: string;
    notes: string | null;
    createdAt: string;
  }>;
}

const VendorOrderDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    if (id) {
      fetchOrder(id);
    }
  }, [id]);

  const fetchOrder = async (orderId: string) => {
    try {
      const response = await api.get(`/vendor/orders/${orderId}`);
      setOrder(response.data);
    } catch (err: any) {
      console.error('Failed to fetch vendor order:', err);
      setError(err.response?.data?.error || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!id || !order) return;
    
    if (!window.confirm(`Are you sure you want to change order status to ${newStatus}?`)) {
      return;
    }

    setUpdatingStatus(true);
    try {
      await api.patch(`/vendor/orders/${id}/status`, {
        status: newStatus,
        notes: `Status updated to ${newStatus} by vendor`,
      });
      
      toast.success(`Order marked as ${newStatus}`);
      await fetchOrder(id);
    } catch (err: any) {
      console.error('Failed to update order status:', err);
      toast.error(err.response?.data?.error || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 border border-blue-200';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800 border border-purple-200';
      case 'SHIPPED':
        return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock size={16} />;
      case 'CONFIRMED': return <CheckCircle2 size={16} />;
      case 'PROCESSING': return <Package size={16} />;
      case 'SHIPPED': return <Truck size={16} />;
      case 'DELIVERED': return <CheckCircle2 size={16} />;
      case 'CANCELLED': return <XCircle size={16} />;
      case 'REFUNDED': return <RotateCcw size={16} />;
      default: return <AlertTriangle size={16} />;
    }
  };

  const getNextStatusOptions = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'PENDING':
        return ['CONFIRMED', 'CANCELLED'];
      case 'CONFIRMED':
        return ['PROCESSING', 'CANCELLED'];
      case 'PROCESSING':
        return ['SHIPPED', 'CANCELLED'];
      case 'SHIPPED':
        return ['DELIVERED'];
      case 'DELIVERED':
        return ['REFUNDED'];
      default:
        return [];
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading order...</div>;
  }

  if (error || !order) {
    return (
      <div className="card p-6">
        <p className="text-red-500 mb-4">{error || 'Order not found'}</p>
        <button
          onClick={() => navigate('/vendor/orders')}
          className="btn-outline text-sm"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/vendor/orders')}
        className="text-sm text-primary-500 hover:underline mb-2 inline-flex items-center gap-1 font-bold"
      >
        ← Back to Orders
      </button>

      {/* Main Stats Card */}
      <div className="card p-6 border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h2>
            <p className="text-sm font-bold text-gray-400 mt-1 uppercase tracking-widest">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4">
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
              {getStatusIcon(order.status)}
              {order.status}
            </span>
            
            {getNextStatusOptions(order.status).length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  disabled={updatingStatus}
                  onChange={(e) => e.target.value && handleStatusUpdate(e.target.value)}
                  className="bg-white border border-gray-200 text-gray-900 text-xs font-bold rounded-xl px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none disabled:opacity-50 appearance-none pr-8 relative bg-no-repeat bg-[right_0.5rem_center]"
                  defaultValue=""
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='Length 19 9l-7 7-7-7' /%3E%3C/svg%3E")`, backgroundSize: '1rem' }}
                >
                  <option value="" disabled>Update Status</option>
                  {getNextStatusOptions(order.status).map((status) => (
                    <option key={status} value={status}>Mark as {status}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-6 border-y border-gray-50">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Customer Information</h3>
            <p className="font-bold text-gray-900">{order.user.name || order.user.email}</p>
            <p className="text-sm text-gray-500 mt-1">{order.user.email}</p>
            {order.user.phone && <p className="text-sm text-gray-500">Tel: {order.user.phone}</p>}
          </div>
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Shipping Logistics</h3>
            <p className="font-bold text-gray-900">{order.address.fullName}</p>
            <p className="text-sm text-gray-600 mt-1">{order.address.addressLine1}</p>
            {order.address.addressLine2 && <p className="text-sm text-gray-600">{order.address.addressLine2}</p>}
            <p className="text-sm text-gray-600">
              {order.address.city}, {order.address.state} {order.address.postalCode}
            </p>
            <p className="text-sm text-gray-600">{order.address.country}</p>
          </div>
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">Financial Summary</h3>
            <div className="space-y-2">
              <p className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-bold text-gray-900">{formatPrice(order.subtotal)}</span>
              </p>
              <p className="flex justify-between text-sm">
                <span className="text-gray-500">Shipping</span>
                <span className="font-bold text-green-600">{order.shippingCost === 0 ? 'Free' : formatPrice(order.shippingCost)}</span>
              </p>
              <div className="pt-2 mt-2 border-t border-gray-50 flex justify-between">
                <span className="font-black text-gray-900 uppercase text-xs">Total Revenue</span>
                <span className="font-black text-primary-600">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Timeline */}
        <div className="mt-8">
          <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-2">
            <Clock size={14} className="text-primary-600" />
            Live Lifecycle Timeline
          </h3>
          <div className="space-y-6 max-w-2xl">
            {[...order.statusHistory].reverse().map((history, idx) => (
              <div key={history.id} className="relative ps-8 pb-4 last:pb-0">
                {idx !== order.statusHistory.length - 1 && (
                  <div className="absolute start-[11px] top-6 bottom-0 w-0.5 bg-gray-100" />
                )}
                
                <div className={`absolute start-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white ring-4 ring-white ${
                  idx === 0 ? 'border-primary-600' : 'border-gray-200'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary-600' : 'bg-gray-200'}`} />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                  <div className="bg-gray-50/50 p-3 rounded-xl border border-gray-100 flex-1">
                    <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 rounded ${
                      idx === 0 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {history.status}
                    </span>
                    <p className="text-sm text-gray-700 mt-2 font-medium leading-relaxed">{history.notes}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gray-400 font-mono whitespace-nowrap">
                    {new Date(history.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="card p-6 border-gray-100 shadow-sm">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 px-2 border-s-4 border-primary-600">Inventory Items</h3>
        <div className="grid grid-cols-1 gap-4">
          {order.items.map((item) => {
            const images = typeof item.product.images === 'string'
              ? JSON.parse(item.product.images as string)
              : item.product.images || [];
            const mainImage = images?.[0] || '/imgs/default-product.jpg';
            const unitPrice = item.discountPrice || item.price;

            return (
              <div key={item.id} className="group flex items-center gap-6 p-4 rounded-2xl border border-gray-100 hover:border-primary-100 hover:bg-primary-50/5 transition-all">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100 group-hover:scale-105 transition-transform">
                  <img src={mainImage} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-grow min-w-0">
                  <p className="font-black text-gray-900 truncate tracking-tight">{item.product.name}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] font-black uppercase bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Qty: {item.quantity}</span>
                    <span className="text-[10px] font-black uppercase bg-primary-100 text-primary-600 px-2 py-0.5 rounded">{formatPrice(unitPrice)} / unit</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-gray-900">{formatPrice(unitPrice * item.quantity)}</p>
                  {item.discountPrice && (
                    <p className="text-xs text-gray-400 line-through font-bold">
                      {formatPrice(item.price * item.quantity)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VendorOrderDetailsPage;
