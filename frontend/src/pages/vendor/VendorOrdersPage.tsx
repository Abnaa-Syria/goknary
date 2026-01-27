import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  items: Array<{
    product: {
      name: string;
      images: string[];
    };
    quantity: number;
  }>;
}

const VendorOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get('/vendor/orders', { params });
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return <div className="text-center py-8">Loading orders...</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Orders</h2>

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Orders</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No orders found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const firstItem = order.items[0];
            const mainImage = firstItem?.product?.images?.[0] || '/imgs/default-product.jpg';

            return (
              <Link
                key={order.id}
                to={`/vendor/orders/${order.id}`}
                className="card p-6 hover:shadow-card-hover transition-shadow block"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-shrink-0 w-full md:w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={mainImage}
                      alt={firstItem?.product?.name || 'Product'}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm text-gray-500">Order #{order.id.slice(0, 8)}</p>
                        <p className="font-medium">{order.user.name || order.user.email}</p>
                        <p className="text-sm text-gray-500">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'} •{' '}
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <p className="font-bold text-lg">{formatPrice(order.total)}</p>
                      <span className="text-primary-500 text-sm">View Details →</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendorOrdersPage;

