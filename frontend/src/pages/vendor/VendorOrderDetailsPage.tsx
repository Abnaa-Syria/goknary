import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

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
        notes: `Status changed to ${newStatus}`,
      });
      
      // Refresh order data
      await fetchOrder(id);
    } catch (err: any) {
      console.error('Failed to update order status:', err);
      alert(err.response?.data?.error || 'Failed to update order status');
    } finally {
      setUpdatingStatus(false);
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
        return 'bg-green-100 text-green-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
        return []; // No further status changes
      case 'CANCELLED':
        return []; // Cannot change cancelled orders
      default:
        return ['CONFIRMED', 'CANCELLED'];
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
    <div>
      <button
        onClick={() => navigate('/vendor/orders')}
        className="text-sm text-primary-500 hover:underline mb-4 inline-flex items-center"
      >
        ← Back to Orders
      </button>

      <div className="card p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl font-bold">
              Order #{order.id.slice(0, 8)}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
              {order.status}
            </span>
            
            {/* Status Update Buttons */}
            {getNextStatusOptions(order.status).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {getNextStatusOptions(order.status).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusUpdate(status)}
                    disabled={updatingStatus}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      status === 'CANCELLED'
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-primary-500 hover:bg-primary-600 text-white'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {updatingStatus ? 'Updating...' : `Mark as ${status}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Customer</h3>
            <p>{order.user.name || order.user.email}</p>
            <p className="text-gray-600">{order.user.email}</p>
            {order.user.phone && (
              <p className="text-gray-600">Tel: {order.user.phone}</p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Shipping Address</h3>
            <p>{order.address.fullName}</p>
            <p>{order.address.addressLine1}</p>
            {order.address.addressLine2 && <p>{order.address.addressLine2}</p>}
            <p>
              {order.address.city}
              {order.address.state && `, ${order.address.state}`}{' '}
              {order.address.postalCode}
            </p>
            <p>{order.address.country}</p>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-1">Summary</h3>
            <p className="flex justify-between">
              <span className="text-gray-600">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-600">Shipping</span>
              <span>
                {order.shippingCost === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  formatPrice(order.shippingCost)
                )}
              </span>
            </p>
            <p className="flex justify-between font-semibold text-gray-900 mt-1">
              <span>Total</span>
              <span>{formatPrice(order.total)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">Items</h3>
        <div className="space-y-4">
          {order.items.map((item) => {
            const images =
              typeof item.product.images === 'string'
                ? JSON.parse(item.product.images as string)
                : item.product.images || [];
            const mainImage = images?.[0] || '/imgs/default-product.jpg';
            const linePrice = (item.discountPrice || item.price) * item.quantity;

            return (
              <div
                key={item.id}
                className="flex items-start gap-3 sm:gap-4 border-b border-gray-100 pb-3 last:border-b-0"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={mainImage}
                    alt={item.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-grow min-w-0 text-sm">
                  <p className="font-medium text-gray-900 truncate">
                    {item.product.name}
                  </p>
                  {item.product.category?.name && (
                    <p className="text-xs text-gray-500">
                      Category: {item.product.category.name}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Qty: {item.quantity}
                  </p>
                </div>
                <div className="text-right text-sm flex-shrink-0">
                  <p className="font-semibold">{formatPrice(linePrice)}</p>
                  {item.discountPrice && (
                    <p className="text-xs text-gray-400 line-through">
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


