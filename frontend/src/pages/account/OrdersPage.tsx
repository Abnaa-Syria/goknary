import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

interface Order {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  vendor: {
    storeName: string;
    storeNameAr?: string;
    slug: string;
  };
  items: Array<{
    product: {
      name: string;
      nameAr?: string;
      slug: string;
      images: string[];
    };
    quantity: number;
    price: number;
  }>;
}

const OrdersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/orders');
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

  const getStatusText = (status: string) => {
    switch (status) {
      case 'PENDING':
        return t('orders.pending');
      case 'CONFIRMED':
        return t('orders.confirmed');
      case 'PROCESSING':
        return t('orders.processing');
      case 'SHIPPED':
        return t('orders.shipped');
      case 'DELIVERED':
        return t('orders.delivered');
      case 'CANCELLED':
        return t('orders.cancelled');
      case 'REFUNDED':
        return t('orders.refunded');
      default:
        return status;
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('account.myOrders')}</h2>

      {orders.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">{t('account.noOrders')}</p>
          <Link to="/" className="btn-primary inline-block">
            {t('account.startShopping')}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const firstItem = order.items[0];
            const mainImage = firstItem?.product?.images?.[0] || '/imgs/default-product.jpg';
            const productName = i18n.language === 'ar' && firstItem?.product?.nameAr
              ? firstItem.product.nameAr
              : firstItem?.product?.name || t('product.product');
            const vendorName = i18n.language === 'ar' && order.vendor.storeNameAr
              ? order.vendor.storeNameAr
              : order.vendor.storeName;

            return (
              <Link
                key={order.id}
                to={`/account/orders/${order.id}`}
                className="card p-6 hover:shadow-card-hover transition-shadow block"
              >
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-shrink-0 w-full md:w-32 h-32 rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={mainImage}
                      alt={productName}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm text-gray-500">{t('checkout.orderNumber')} #{order.id.slice(0, 8)}</p>
                        <p className="font-medium text-lg">{vendorName}</p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-600 mb-2">
                      {order.items.length} {order.items.length === 1 ? t('account.item') : t('account.items')} •{' '}
                      {new Date(order.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>

                    <div className="flex justify-between items-center">
                      <p className="font-bold text-lg">{formatPrice(order.total)}</p>
                      <span className="text-primary-500 text-sm">{t('account.viewDetails')} →</span>
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

export default OrdersPage;

