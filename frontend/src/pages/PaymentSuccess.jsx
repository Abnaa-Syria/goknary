import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCartState } from '../store/slices/cartSlice';
import api from '../lib/api';
import { formatPrice } from '../lib/utils';
import { CheckCircle2, Clock, Home, PackageCheck, Printer, ShoppingBag } from 'lucide-react';
import { IMAGE_PLACEHOLDER, getImageUrl } from '../utils/image';
import { parseVariantSnapshot } from '../lib/variants';
import OrderItemVariant from '../components/common/OrderItemVariant';
import {
  getPaymentConfirmationState,
  isValidOrderReference,
  shouldClearCartAfterConfirmation,
} from '../lib/paymentConfirmation';
import { clearCartSessionId } from '../lib/cartSession';
import { clearCheckoutIdempotencyKey } from '../lib/checkoutIdempotency';

const parseOrderIds = (searchParams) => {
  const orderIds = searchParams.get('order_ids');
  if (orderIds) {
    return [...new Set(orderIds.split(',').map((id) => id.trim()).filter(isValidOrderReference))].slice(0, 25);
  }

  const singleReference = [
    searchParams.get('merchantOrderId'),
    searchParams.get('orderId'),
    searchParams.get('order_id'),
  ].find(Boolean);

  return singleReference
    ? [...new Set(String(singleReference).split('__').filter(isValidOrderReference))].slice(0, 25)
    : [];
};

const normalizeImages = (images) => {
  if (Array.isArray(images)) return images;
  try {
    const parsed = JSON.parse(images || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return images ? [images] : [];
  }
};

/**
 * PaymentSuccess Page
 * Thank-you + invoice page for COD and Kashier conversions.
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderIds = useMemo(() => parseOrderIds(searchParams), [searchParams]);
  const paymentMethod = searchParams.get('method');
  const dispatch = useDispatch();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const isAr = document.documentElement.lang?.startsWith('ar');
  const labels = {
    loading: isAr ? 'جاري تحميل الفاتورة...' : 'Loading invoice...',
    fallbackTitle: isAr ? 'تعذر تأكيد الطلب' : 'Order Confirmation Unavailable',
    fallbackDesc: isAr ? 'تعذر التحقق من تفاصيل الطلب. راجع صفحة طلباتك للتأكد من حالته.' : 'We could not verify this order. Check My Orders for its current status.',
    viewOrders: isAr ? 'عرض طلباتي' : 'View My Orders',
    thankYou: isAr ? 'شكراً لطلبك' : 'Thank you for your order',
    thankYouDesc: isAr ? 'تم استلام طلبك بنجاح. هذه الصفحة تعمل كفاتورة وتأكيد لعملية الشراء.' : 'Your order has been received successfully. This page works as your order invoice and purchase confirmation.',
    invoiceDetails: isAr ? 'تفاصيل الفاتورة' : 'Invoice Details',
    order: isAr ? 'الطلب' : 'Order',
    vendor: isAr ? 'البائع' : 'Vendor',
    qty: isAr ? 'الكمية' : 'Qty',
    payment: isAr ? 'الدفع' : 'Payment',
    paid: isAr ? 'مدفوع / مؤكد' : 'Paid / Confirmed',
    pending: isAr ? 'بانتظار التأكيد' : 'Pending Confirmation',
    orderConfirmed: isAr ? 'تم تأكيد الطلب' : 'Order Confirmed',
    paymentPending: isAr ? 'الدفع معلق' : 'Payment Pending',
    paymentConfirmed: isAr ? 'تم تأكيد الدفع' : 'Payment Confirmed',
    method: isAr ? 'طريقة الدفع' : 'Method',
    kashier: isAr ? 'كاشير - دفع إلكتروني' : 'Kashier online payment',
    cod: isAr ? 'الدفع عند الاستلام' : 'Cash on delivery',
    subtotal: isAr ? 'الإجمالي الفرعي' : 'Subtotal',
    shipping: isAr ? 'الشحن' : 'Shipping',
    discount: isAr ? 'الخصم' : 'Discount',
    total: isAr ? 'الإجمالي' : 'Total',
    print: isAr ? 'طباعة الفاتورة' : 'Print Invoice',
    home: isAr ? 'العودة للرئيسية' : 'Return Home',
  };

  useEffect(() => {
    const fetchOrders = async () => {
      if (orderIds.length === 0) {
        setLoading(false);
        return;
      }

      try {
        const responses = await Promise.all(
          orderIds.map((id) => api.get(`/orders/${id}`))
        );
        setOrders(responses.map((response) => response.data));
      } catch (error) {
        console.error('Failed to load invoice orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [orderIds]);

  const totals = useMemo(() => {
    return orders.reduce(
      (acc, order) => ({
        subtotal: acc.subtotal + (order.subtotal || 0),
        shipping: acc.shipping + (order.shippingCost || 0),
        discount: acc.discount + (order.discountAmount || 0),
        total: acc.total + (order.total || 0),
      }),
      { subtotal: 0, shipping: 0, discount: 0, total: 0 }
    );
  }, [orders]);

  useEffect(() => {
    if (orders.length === 0 || totals.total <= 0) return;

    const conversionKey = `purchase_tracked_${orderIds.join('_')}`;
    if (sessionStorage.getItem(conversionKey)) return;
    sessionStorage.setItem(conversionKey, '1');

    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'purchase',
      ecommerce: {
        transaction_id: orderIds.join(','),
        value: Number(totals.total.toFixed(2)),
        currency: 'EGP',
        shipping: Number(totals.shipping.toFixed(2)),
        items: orders.flatMap((order) =>
          (order.items || []).map((item) => ({
            item_id: item.product?.id,
            item_name: item.product?.name,
            price: item.discountPrice || item.price,
            quantity: item.quantity,
            item_brand: order.vendor?.storeName,
          }))
        ),
      },
    });
  }, [orders, orderIds, totals]);

  const firstOrder = orders[0];
  const isKashier = paymentMethod === 'kashier' || firstOrder?.paymentMethod === 'KASHIER';
  const confirmationState = getPaymentConfirmationState(orders);
  const isPaymentConfirmed = confirmationState === 'payment-confirmed';

  useEffect(() => {
    if (!shouldClearCartAfterConfirmation(confirmationState)) return;
    dispatch(clearCartState());
    clearCartSessionId();
    clearCheckoutIdempotencyKey();
  }, [confirmationState, dispatch]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">{labels.loading}</p>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center border border-gray-100">
          <Clock className="w-14 h-14 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-black text-gray-900 mb-2">{labels.fallbackTitle}</h1>
          <p className="text-gray-500 mb-6">{labels.fallbackDesc}</p>
          <Link to="/account/orders" className="block w-full py-4 px-6 bg-primary-600 text-white rounded-2xl font-bold">
            {labels.viewOrders}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-xl shadow-gray-100/60 p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-11 h-11 text-green-600" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-2">{labels.thankYou}</h1>
          <p className="text-gray-500 max-w-2xl mx-auto">
            {labels.thankYouDesc}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {orderIds.map((id) => (
              <span key={id} className="px-4 py-2 bg-gray-50 rounded-xl text-xs font-black text-gray-600 uppercase tracking-widest">
                 #{id.slice(-8).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <PackageCheck className="text-primary-600" />
              <h2 className="text-lg font-black text-gray-900 uppercase">{labels.invoiceDetails}</h2>
            </div>

            <div className="divide-y divide-gray-50">
              {orders.map((order) => (
                <div key={order.id} className="p-6">
                  <div className="flex flex-wrap justify-between gap-3 mb-5">
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{labels.order}</p>
                       <p className="font-black text-gray-900">#{order.id.slice(-8).toUpperCase()}</p>
                    </div>
                    <div className="text-start lg:text-end">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{labels.vendor}</p>
                      <p className="font-black text-gray-900">{order.vendor?.storeName || 'GoKnary'}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(order.items || []).map((item) => {
                      const images = normalizeImages(item.product?.images);
                      const snapshot = parseVariantSnapshot(item.variantInfo);
                      return (
                        <div key={item.id} className="flex items-center gap-4 bg-gray-50/60 rounded-2xl p-3">
                          <div className="w-14 h-14 rounded-xl bg-white overflow-hidden border border-gray-100">
                            <img
                              src={getImageUrl(snapshot?.image || images[0] || IMAGE_PLACEHOLDER)}
                              alt={(snapshot?.image && snapshot.name) || item.product?.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-gray-900 truncate">{item.product?.name}</p>
                            <OrderItemVariant snapshot={snapshot} className="text-xs text-gray-500" />
                            <p className="text-xs text-gray-400 font-bold">{labels.qty}: {item.quantity}</p>
                          </div>
                          <p className="text-sm font-black text-gray-900">
                            {formatPrice((item.discountPrice || item.price) * item.quantity)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 h-fit space-y-5">
            <div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{labels.payment}</p>
               <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase ${isPaymentConfirmed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                 {confirmationState === 'payment-confirmed'
                   ? labels.paymentConfirmed
                   : confirmationState === 'order-confirmed'
                     ? `${labels.orderConfirmed} / ${labels.paymentPending}`
                     : labels.paymentPending}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {labels.method}: {isKashier ? labels.kashier : labels.cod}
              </p>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{labels.subtotal}</span>
                <span className="font-bold">{formatPrice(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{labels.shipping}</span>
                <span className="font-bold">{formatPrice(totals.shipping)}</span>
              </div>
              {totals.discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>{labels.discount}</span>
                  <span className="font-bold">-{formatPrice(totals.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg border-t border-gray-100 pt-4">
                <span className="font-black text-gray-900">{labels.total}</span>
                <span className="font-black text-primary-600">{formatPrice(totals.total)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => window.print()}
                className="w-full py-4 px-6 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Printer size={16} /> {labels.print}
              </button>
              <Link
                to="/account/orders"
                className="w-full py-4 px-6 bg-gray-50 text-gray-700 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <ShoppingBag size={16} /> {labels.viewOrders}
              </Link>
              <Link
                to="/"
                className="w-full py-4 px-6 bg-primary-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Home size={16} /> {labels.home}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
