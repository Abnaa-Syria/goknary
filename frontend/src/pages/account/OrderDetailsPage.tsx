import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, RotateCcw, AlertTriangle, CheckCircle2, Clock, Truck, RefreshCw, Send, Check, Printer } from 'lucide-react';
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
    storeNameAr?: string;
    slug: string;
  };
  items: Array<{
    id: string; // OrderItem ID
    product: {
      id: string;
      name: string;
      nameAr?: string;
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
  const { t, i18n } = useTranslation();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Item Refund Modal States
  const [selectedItem, setSelectedItem] = useState<OrderDetails['items'][0] | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const getPaymentMethodLabel = (method?: string) => {
    switch (method) {
      case 'COD':
        return i18n.language === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery';
      case 'KASHIER':
        return i18n.language === 'ar' ? 'كاشير (دفع إلكتروني)' : 'Kashier';
      default:
        return method || (i18n.language === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery');
    }
  };

  const getPaymentStatusLabel = (status?: string) => {
    switch (status) {
      case 'PENDING':
        return i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending';
      case 'PAID':
        return i18n.language === 'ar' ? 'تم الدفع' : 'Paid';
      case 'FAILED':
        return i18n.language === 'ar' ? 'فشلت العملية' : 'Failed';
      default:
        return status || (i18n.language === 'ar' ? 'قيد الانتظار' : 'Pending');
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

  const itemCount = order.items.length;

  // Spacing and font sizing presets for PRINT to guarantee fitting on exactly one page
  let printPadding = 'print:p-6';
  let printFontSize = 'print:text-[13px] print:leading-normal';
  let printTitleSize = 'print:text-2xl';
  let printSubtitleSize = 'print:text-lg';
  let printLogoHeight = 'print:h-12';
  let printSectionMargin = 'print:mb-6';
  let printTablePadding = 'print:py-3 print:px-4';
  let printFooterMargin = 'print:mt-12 print:pt-4';
  let printStampMargin = 'print:mt-4';
  let printDetailsPadding = 'print:p-5';

  if (itemCount > 12) {
    // Tier 4: Ultra compact for 13+ items
    printPadding = 'print:p-3';
    printFontSize = 'print:text-[8.5px] print:leading-tight';
    printTitleSize = 'print:text-base';
    printSubtitleSize = 'print:text-xs';
    printLogoHeight = 'print:h-7';
    printSectionMargin = 'print:mb-1.5';
    printTablePadding = 'print:py-0.5 print:px-2';
    printFooterMargin = 'print:mt-2 print:pt-1';
    printStampMargin = 'print:mt-1';
    printDetailsPadding = 'print:p-2';
  } else if (itemCount > 7) {
    // Tier 3: Compact for 8-12 items
    printPadding = 'print:p-4';
    printFontSize = 'print:text-[10px] print:leading-snug';
    printTitleSize = 'print:text-lg';
    printSubtitleSize = 'print:text-sm';
    printLogoHeight = 'print:h-9';
    printSectionMargin = 'print:mb-3';
    printTablePadding = 'print:py-1 print:px-3';
    printFooterMargin = 'print:mt-4 print:pt-2';
    printStampMargin = 'print:mt-2';
    printDetailsPadding = 'print:p-3';
  } else if (itemCount > 3) {
    // Tier 2: Medium compact for 4-7 items
    printPadding = 'print:p-5';
    printFontSize = 'print:text-[11.5px] print:leading-snug';
    printTitleSize = 'print:text-xl';
    printSubtitleSize = 'print:text-base';
    printLogoHeight = 'print:h-10';
    printSectionMargin = 'print:mb-4';
    printTablePadding = 'print:py-1.5 print:px-3';
    printFooterMargin = 'print:mt-6 print:pt-3';
    printStampMargin = 'print:mt-3';
    printDetailsPadding = 'print:p-4';
  }

  return (
    <div className="text-start relative w-full">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 12mm !important;
          }
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* Reset parent flexbox, padding, and layout constraints during print to center the invoice */
          #root, .container, main, .flex, .flex-col, .grid {
            display: block !important;
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
          }
          .print-card-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Page Header (Hidden on Print) */}
      <div className="print:hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('account.orderDetails', 'Order Details')}</h2>
          <p className="text-sm text-gray-500">{t('checkout.orderNumber', 'Order Number')} #{order.id.slice(0, 8)}</p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-sm font-bold text-gray-700 hover:text-secondary-800"
          >
            <Printer size={16} className="text-secondary-600" />
            <span>{i18n.language === 'ar' ? 'طباعة الفاتورة' : 'Print Invoice'}</span>
          </button>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
            {t(`orders.${order.status.toLowerCase()}`, order.status)}
          </span>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:block print:w-full print:m-0 print:p-0">
        {/* Left Column: Unified Responsive Invoice Card */}
        <div className="lg:col-span-2 print:m-0 print:p-0 print:w-full">
          <div 
            dir={i18n.language === 'ar' ? 'rtl' : 'ltr'} 
            className={`bg-white text-black text-start max-w-4xl mx-auto w-full font-sans border border-gray-150 shadow-sm rounded-3xl
              p-6 sm:p-8 md:p-10 transition-all duration-300 hover:shadow-md
              print:border-0 print:shadow-none print:rounded-none print:w-full print:mx-0 print:p-0
              ${printPadding} ${printFontSize}`}
          >
            {/* Invoice Header */}
            <div className={`flex justify-between items-start border-b-2 border-secondary-900 ${
              itemCount > 3 ? 'pb-4 print:pb-2 mb-5 print:mb-2' : 'pb-8 mb-8 print:pb-4 print:mb-4'
            } ${printSectionMargin}`}>
              <div>
                <img 
                  src="/imgs/WhatsApp_Image_2025-06-01_at_1.44.50_PM-removebg-preview-e1748777559633.webp" 
                  alt="GoKnary Logo" 
                  className={`w-auto object-contain ${
                    itemCount > 3 ? 'h-10 print:h-8 mb-1.5' : 'h-14 mb-3'
                  } ${printLogoHeight}`}
                />
                <h1 className={`${itemCount > 3 ? 'text-xl' : 'text-2xl'} ${printTitleSize} font-black text-secondary-900 tracking-tight`}>GoKnary</h1>
                <p className="text-[10px] text-gray-400 mt-0.5">Multi-Vendor E-Commerce Platform</p>
                <p className="text-[10px] text-gray-400">support@goknary.com</p>
              </div>
              <div className="text-end">
                <h2 className={`${itemCount > 3 ? 'text-lg' : 'text-xl'} ${printSubtitleSize} font-extrabold text-secondary-900 tracking-wide`}>INVOICE / فاتورة</h2>
                <div className="mt-1.5 space-y-0.5 text-xs font-semibold text-gray-700">
                  <p className="text-gray-950 font-bold"># {order.id.toUpperCase()}</p>
                  <p className="text-gray-500">{i18n.language === 'ar' ? 'التاريخ' : 'Date'}: {new Date(order.createdAt).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}</p>
                  <p className="text-gray-500">{i18n.language === 'ar' ? 'الحالة' : 'Status'}: {t(`orders.${order.status.toLowerCase()}`, order.status)}</p>
                </div>
                
                {/* Payment Status Stamp */}
                <div className={`${itemCount > 3 ? 'mt-2' : 'mt-4'} ${printStampMargin}`}>
                  <span className={`inline-block border-2 font-black rounded-lg px-2.5 py-0.5 text-[10px] uppercase tracking-widest transform -rotate-3 ${
                    order.paymentStatus === 'PAID'
                      ? 'border-green-600 text-green-600 bg-green-50/30'
                      : 'border-amber-600 text-amber-600 bg-amber-50/30'
                  }`}>
                    {order.paymentStatus === 'PAID'
                      ? (i18n.language === 'ar' ? '★ تم الدفع / PAID ★' : '★ PAID ★')
                      : (i18n.language === 'ar' ? '★ معلق / PENDING ★' : '★ PENDING ★')
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Customer & Vendor Details */}
            <div className={`grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-6 print:gap-4 ${
              itemCount > 3 ? 'mb-5 print:mb-2' : 'mb-8 print:mb-4'
            } ${printSectionMargin} text-xs print-card-avoid`}>
              {/* Customer Details */}
              <div className={`bg-gray-50/50 rounded-2xl border border-gray-150 p-4 sm:p-5 ${printDetailsPadding}`}>
                <h3 className="font-bold text-secondary-900 border-b border-gray-200 pb-1.5 mb-2.5 uppercase tracking-wider text-[10px]">
                  {i18n.language === 'ar' ? 'بيانات العميل / Customer Details' : 'Customer Details'}
                </h3>
                <div className="space-y-0.5 text-gray-700 leading-relaxed font-medium text-start">
                  <p className="font-extrabold text-gray-900">{order.address.fullName}</p>
                  <p>{order.address.phone}</p>
                  <p>{order.address.addressLine1}</p>
                  {order.address.addressLine2 && <p className="italic text-gray-500">{order.address.addressLine2}</p>}
                  <p>{order.address.city}, {order.address.country}</p>
                </div>
              </div>

              {/* Vendor Details */}
              <div className={`bg-gray-50/50 rounded-2xl border border-gray-150 p-4 sm:p-5 ${printDetailsPadding}`}>
                <h3 className="font-bold text-secondary-900 border-b border-gray-200 pb-1.5 mb-2.5 uppercase tracking-wider text-[10px]">
                  {i18n.language === 'ar' ? 'بيانات البائع / Vendor Details' : 'Vendor Details'}
                </h3>
                <div className="space-y-0.5 text-gray-700 leading-relaxed font-medium text-start">
                  <p className="font-extrabold text-gray-900">
                    {i18n.language === 'ar' && order.vendor.storeNameAr ? order.vendor.storeNameAr : order.vendor.storeName}
                  </p>
                  <p className="text-gray-500">Platform Registered Merchant</p>
                  <div className="pt-2 mt-2 border-t border-dashed border-gray-200 text-[10px]">
                    <p><span className="font-bold text-gray-900">{i18n.language === 'ar' ? 'طريقة الدفع: ' : 'Payment Method: '}</span>{getPaymentMethodLabel(order.paymentMethod)}</p>
                    <p><span className="font-bold text-gray-900">{i18n.language === 'ar' ? 'حالة الدفع: ' : 'Payment Status: '}</span>{getPaymentStatusLabel(order.paymentStatus)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Items Table */}
            <div className={`border border-gray-200 rounded-2xl print:rounded-xl overflow-hidden shadow-sm print:shadow-none ${
              itemCount > 3 ? 'mb-5 print:mb-2' : 'mb-8 print:mb-4'
            } ${printSectionMargin}`}>
              <div className="overflow-x-auto print:overflow-visible">
                <table className="w-full text-start border-collapse text-xs min-w-[500px] print:min-w-0">
                  <thead>
                    <tr className="bg-secondary-900 text-white font-bold">
                      <th className={`text-start font-bold ${printTablePadding}`}>{i18n.language === 'ar' ? 'المنتج / Product' : 'Product'}</th>
                      <th className={`text-end font-bold w-32 sm:w-36 ${printTablePadding}`}>{i18n.language === 'ar' ? 'سعر الوحدة / Unit Price' : 'Unit Price'}</th>
                      <th className={`text-center font-bold w-20 sm:w-24 ${printTablePadding}`}>{i18n.language === 'ar' ? 'الكمية / Qty' : 'Qty'}</th>
                      <th className={`text-end font-bold w-32 sm:w-36 ${printTablePadding}`}>{i18n.language === 'ar' ? 'الإجمالي / Total' : 'Total'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, idx) => {
                      const itemPrice = item.discountPrice || item.price;
                      const productName = i18n.language === 'ar' && item.product.nameAr
                        ? item.product.nameAr
                        : item.product.name;
                      return (
                        <tr key={item.id} className={`border-b border-gray-150 text-gray-800 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                          <td className={`px-4 font-semibold text-start text-gray-900 ${
                            itemCount > 3 ? 'py-2 print:py-1' : 'py-3.5 print:py-2'
                          }`}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <Link to={`/product/${item.product.slug}`} className="hover:text-primary-500 transition-colors">
                                {productName}
                              </Link>
                              {item.refundRequest ? (
                                <div className="print:hidden">{getRefundStatusBadge(item.refundRequest.status)}</div>
                              ) : (
                                order.status === 'DELIVERED' && (
                                  <button
                                    onClick={() => setSelectedItem(item)}
                                    className="print:hidden text-[10px] font-bold text-secondary-900 hover:text-secondary-800 bg-secondary-50 hover:bg-secondary-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-0.5 self-start"
                                  >
                                    <RotateCcw size={10} />
                                    {i18n.language === 'ar' ? 'إرجاع المنتج' : 'Return Item'}
                                  </button>
                                )
                              )}
                            </div>
                          </td>
                          <td className={`px-4 text-end font-mono text-gray-700 ${
                            itemCount > 3 ? 'py-2 print:py-1' : 'py-3.5 print:py-2'
                          }`}>{formatPrice(itemPrice)}</td>
                          <td className={`px-4 text-center font-bold text-gray-800 ${
                            itemCount > 3 ? 'py-2 print:py-1' : 'py-3.5 print:py-2'
                          }`}>{item.quantity}</td>
                          <td className={`px-4 text-end font-mono font-bold text-secondary-900 ${
                            itemCount > 3 ? 'py-2 print:py-1' : 'py-3.5 print:py-2'
                          }`}>{formatPrice(itemPrice * item.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pricing Summary */}
            <div className={`flex justify-end text-xs ${
              itemCount > 3 ? 'mb-8 print:mb-3' : 'mb-12 print:mb-6'
            } ${printSectionMargin} print-card-avoid`}>
              <div className={`w-full sm:w-80 print:w-72 bg-gray-50/40 rounded-2xl border border-gray-200 shadow-sm print:shadow-none p-4 sm:p-5 ${
                itemCount > 3 ? 'space-y-1.5 print:space-y-1' : 'space-y-2.5'
              }`}>
                <div className="flex justify-between text-gray-650 font-medium">
                  <span>{i18n.language === 'ar' ? 'المجموع الفرعي / Subtotal' : 'Subtotal'}</span>
                  <span className="font-mono">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-650 font-medium">
                  <span>{i18n.language === 'ar' ? 'مصاريف الشحن / Shipping' : 'Shipping'}</span>
                  <span className="font-mono">{formatPrice(order.shippingCost)}</span>
                </div>
                <div className="border-t border-gray-300 pt-2 flex justify-between font-black text-secondary-900 text-base">
                  <span>{i18n.language === 'ar' ? 'الإجمالي / Total' : 'Total'}</span>
                  <span className="font-mono">{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            {/* Invoice Footer */}
            <div className={`border-t border-gray-255 text-center text-[10px] text-gray-400 leading-relaxed print-card-avoid ${
              itemCount > 3 
                ? 'mt-8 print:mt-3 pt-4 print:pt-1.5 space-y-0.5' 
                : 'mt-16 print:mt-8 pt-8 print:pt-4 space-y-1.5'
            } ${printFooterMargin}`}>
              <p className="font-black text-gray-600 text-xs">Thank you for shopping at GoKnary! / شكراً لتسوقكم من جو كناري!</p>
              <p>If you have any questions, please contact support@goknary.com</p>
              <p>This is a computer generated invoice and does not require a physical signature.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Status Timeline & Action Buttons (Hidden on Print) */}
        <div className="lg:col-span-1 space-y-6 print:hidden">
          {/* Timeline Card */}
          <div className="card p-6">
            <h3 className="text-lg font-bold mb-5 text-gray-900 text-start">{t('account.statusHistory', 'Order Status History')}</h3>
            <div className="space-y-4 relative">
              {order.statusHistory.map((history, index) => (
                <div key={index} className="flex items-start gap-3 relative pb-2 last:pb-0">
                  {index < order.statusHistory.length - 1 && (
                    <div className="absolute top-5 left-1.5 bottom-[-16px] w-[2px] bg-gray-100"></div>
                  )}
                  <div className="flex-shrink-0 w-3 h-3 rounded-full bg-secondary-600 mt-1.5 border-2 border-white ring-4 ring-secondary-50"></div>
                  <div className="flex-grow text-start">
                    <p className="font-semibold text-sm text-gray-800">{t(`orders.${history.status.toLowerCase()}`, history.status)}</p>
                    {history.notes && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{history.notes}</p>}
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(history.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="card p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider text-start">{t('account.orderActions', 'Actions')}</h3>
            
            {['PENDING', 'CONFIRMED', 'PROCESSING'].includes(order.status) && (
              <button
                onClick={handleCancelOrder}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-50 text-red-650 hover:bg-red-105 transition-all border border-red-100 rounded-xl font-bold text-sm"
              >
                <XCircle size={16} />
                {i18n.language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
              </button>
            )}
            
            <Link
              to="/account/orders"
              className="block text-center px-4 py-3 bg-gray-50 hover:bg-gray-100 text-gray-750 transition-all border border-gray-200 rounded-xl font-bold text-sm"
            >
              {t('account.backToOrders', 'Back to My Orders')}
            </Link>
          </div>
        </div>
      </div>

      {/* Item Refund Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
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
                <RotateCcw className="text-secondary-900 animate-spin-reverse" />
                Return Item Refund Request
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                You are requesting a return for: <span className="font-bold text-gray-800">{selectedItem.product.name}</span>
              </p>

              <div className="bg-gray-50 p-4 rounded-2xl mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400 font-medium">Refund Estimate:</span>
                  <span className="text-secondary-900 font-black text-sm">
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
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 text-start">
                    Reason for Return
                  </label>
                  <textarea
                    rows={4}
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    required
                    placeholder="Describe why you want to return this product (e.g. wrong size, damaged package, defective item)..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm transition-all text-start"
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
                    className="btn-secondary flex-1 py-3 rounded-xl flex items-center justify-center gap-1 disabled:opacity-50"
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
