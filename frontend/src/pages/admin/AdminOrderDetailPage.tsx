import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { orderStatusMap, mapEnum } from '../../utils/localization';

interface OrderDetails {
  id: string;
  status: string;
  subtotal: number;
  shippingCost: number;
  total: number;
  createdAt: string;
  address: any;
  shippingMethod: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  vendor: {
    id: string;
    storeName: string;
    slug: string;
  };
  items: Array<{
    product: {
      id: string;
      name: string;
      slug: string;
      images: string[];
    };
    quantity: number;
    price: number;
    discountPrice?: number;
  }>;
  statusHistory: Array<{
    status: string;
    notes?: string;
    createdAt: string;
  }>;
}

const AdminOrderDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  useEffect(() => {
    if (id) {
      fetchOrderDetails();
    }
  }, [id]);

  const fetchOrderDetails = async () => {
    try {
      const response = await api.get(`/admin/orders/${id}`);
      setOrder(response.data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
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
    return <div className="text-center py-8">{t('admin.orderDetail.loading')}</div>;
  }

  if (!order) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">{t('admin.orderDetail.notFound')}</p>
        <Link to="/admin/orders" className="btn-primary inline-block">
          {t('admin.orderDetail.backToOrders')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/admin/orders" className="text-primary-500 hover:underline text-sm mb-2 inline-block">
            ← {t('admin.orderDetail.backToOrders')}
          </Link>
          <h2 className="text-2xl font-bold">{t('admin.orderDetail.title')}</h2>
          <p className="text-gray-500">{t('admin.orderDetail.orderNumber', { id: order.id.slice(0, 8) })}</p>
        </div>
        <span className={`px-4 py-2 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
          {mapEnum(orderStatusMap, order.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-4">{t('admin.orderDetail.orderItems')}</h3>
            <div className="space-y-4">
              {order.items.map((item, index) => {
                const displayPrice = item.discountPrice || item.price;
                const mainImage = item.product.images?.[0] || '/imgs/default-product.jpg';

                return (
                  <div key={index} className="flex gap-4 pb-4 border-b last:border-0">
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={mainImage}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-grow">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-gray-500">{t('admin.orderDetail.quantity', { count: item.quantity })}</p>
                      <p className="font-medium mt-1">
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
            <h3 className="text-lg font-bold mb-4">{t('admin.orderDetail.statusHistory')}</h3>
            {order.statusHistory && order.statusHistory.length > 0 ? (
              <div className="space-y-3">
                {order.statusHistory.map((history, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary-500 mt-2"></div>
                    <div className="flex-grow">
                      <p className="font-medium">{mapEnum(orderStatusMap, history.status)}</p>
                      {history.notes && <p className="text-sm text-gray-500">{history.notes}</p>}
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(history.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">{t('admin.orderDetail.noStatusHistory')}</p>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-6 sticky top-4 space-y-6">
            {/* Customer Info */}
            <div>
              <h3 className="font-bold mb-2">{t('admin.orderDetail.customer')}</h3>
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">{order.user.name || t('admin.ordersPage.notSpecified')}</p>
                <p>{order.user.email}</p>
                {order.user.phone && <p>{order.user.phone}</p>}
              </div>
            </div>

            {/* Vendor Info */}
            <div>
              <h3 className="font-bold mb-2">{t('admin.orderDetail.vendor')}</h3>
              <Link
                to={`/store/${order.vendor.slug}`}
                className="text-primary-500 hover:underline"
              >
                {order.vendor.storeName}
              </Link>
            </div>

            {/* Shipping Address */}
            <div>
              <h3 className="font-bold mb-2">{t('admin.orderDetail.shippingAddress')}</h3>
              <div className="text-sm text-gray-600">
                <p>{order.address.fullName}</p>
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

            {/* Order Summary */}
            <div>
              <h3 className="font-bold mb-4">{t('admin.orderDetail.orderSummary')}</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{t('admin.orderDetail.subtotal')}</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>{t('admin.orderDetail.shipping')}</span>
                  <span>{formatPrice(order.shippingCost)}</span>
                </div>
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>{t('admin.orderDetail.total')}</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500">
              <p>{t('admin.orderDetail.placedOn', { date: formatDate(order.createdAt) })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminOrderDetailPage;
