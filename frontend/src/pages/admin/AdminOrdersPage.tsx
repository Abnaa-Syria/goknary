import React, { useEffect, useState } from 'react';
import { Link, Routes, Route } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import AdminOrderDetailPage from './AdminOrderDetailPage';
import { FiArrowLeft, FiArrowRight, FiShoppingCart } from 'react-icons/fi';

interface Order {
  id: string;
  status: string;
  total: number;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  vendor: {
    storeName: string;
  };
}

const AdminOrdersPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<OrdersList />} />
      <Route path=":id" element={<AdminOrderDetailPage />} />
    </Routes>
  );
};

const OrdersList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ 
    page: 1, 
    totalPages: 1,
    totalCount: 0 
  });

  useEffect(() => {
    fetchOrders();
  }, [pagination.page]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/orders', {
        params: { page: pagination.page, limit: 10 }
      });
      setOrders(response.data.orders);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.pagination.totalPages,
        totalCount: response.data.pagination.totalCount
      }));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'CONFIRMED': return 'bg-blue-100 text-blue-800';
      case 'PROCESSING': return 'bg-purple-100 text-purple-800';
      case 'SHIPPED': return 'bg-indigo-100 text-indigo-800';
      case 'DELIVERED': return 'bg-green-100 text-green-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && pagination.page === 1) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Master Order Ecosystem</h1>
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{pagination.totalCount} Transactions Audited</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-24 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiShoppingCart className="text-gray-300" style={{ width: 32, height: 32 }} />
          </div>
          <h3 className="text-xl font-black text-gray-900 uppercase">Transaction Void</h3>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">No orders have been recorded in the ecosystem</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Order Identity</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Customer/Vendor</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Lifecycle State</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Revenue</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to={`/admin/orders/${order.id}`}
                      className="text-primary-500 font-mono text-xs font-black hover:underline"
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-gray-900">{order.user.name || 'N/A'}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">Sold by {order.vendor.storeName}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-black text-sm">{formatPrice(order.total)}</td>
                  <td className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Visualizing Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                >
                  <FiArrowLeft className="inline mr-1" /> Prev
                </button>
                <button 
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                >
                  Next <FiArrowRight className="inline ml-1" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminOrdersPage;
