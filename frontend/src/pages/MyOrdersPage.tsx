import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../lib/utils';
import api from '../lib/api';
import format from 'date-fns/format';
import { arEG } from 'date-fns/locale';
import i18n from 'i18n';

interface OrderItem {
  id: string;
  product: {
    name: string;
    images: string[];
  };
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  createdAt: string;
  total: number;
  status: string;
  items: OrderItem[];
}

const MyOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/orders')
      .then(res => {
        setOrders(res.data.orders);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching orders:', err);
        setLoading(false);
      });
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED': return 'bg-green-100 text-green-700';
      case 'CANCELLED': return 'bg-red-100 text-red-700';
      case 'SHIPPED': return 'bg-blue-100 text-blue-700';
      case 'PROCESSING': return 'bg-amber-100 text-amber-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-500 font-medium">{t('account.loadingOrders', 'Loading your orders...')}</p>
      </div>
    );
  }

  const isRTL = i18n.language === 'ar';

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="text-start">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">{t('account.orderHistory')}</h1>
          <p className="text-gray-500 mt-1">{t('account.orderHistoryDesc', 'Track and manage your recent and past purchases.')}</p>
        </div>
        <Link to="/" className="text-primary-600 font-bold hover:underline flex items-center gap-1">
          {t('cart.continueShopping')}
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">📦</div>
          <h2 className="text-2xl font-bold text-gray-800">{t('account.noOrders')}</h2>
          <p className="text-gray-500 mt-2 mb-8">{t('account.noOrdersDesc', "You haven't placed any orders with us. Start exploring our products!")}</p>
          <Link to="/products" className="px-8 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200">
            {t('account.browseProducts', 'Browse Products')}
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-gray-50/50 px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-gray-100">
                <div className="flex gap-6 text-start">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('account.placedOn')}</p>
                    <p className="text-sm font-bold text-gray-700">
                      {format(new Date(order.createdAt), isRTL ? 'dd MMM yyyy' : 'MMM dd, yyyy', { locale: isRTL ? arEG : undefined })}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">{t('cart.total')}</p>
                    <p className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusColor(order.status)}`}>
                    {t(`orders.${order.status.toLowerCase()}`, order.status)}
                  </span>
                  <p className="text-[10px] font-mono text-gray-400">#{order.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="flex -space-x-3 rtl:space-x-reverse overflow-hidden">
                    {order.items.slice(0, 4).map((item, idx) => (
                      <img 
                        key={item.id} 
                        src={item.product.images[0] || '/imgs/default-product.jpg'} 
                        alt={item.product.name}
                        className="w-16 h-16 rounded-xl border-4 border-white object-cover shadow-sm bg-gray-100 flex-shrink-0"
                        title={`${item.product.name} (x${item.quantity})`}
                      />
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-16 h-16 rounded-xl border-4 border-white bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-sm shadow-sm ring-1 ring-gray-100 flex-shrink-0">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>
                  <div className="flex md:justify-end gap-3">
                    <Link 
                      to={`/account/orders/${order.id}`}
                      className="px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      {t('account.viewDetails')}
                    </Link>
                    <button className="px-5 py-2.5 bg-primary-50 text-primary-600 rounded-xl text-sm font-bold hover:bg-primary-100 transition-all">
                      {t('account.reorder', 'Reorder Items')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyOrdersPage;
