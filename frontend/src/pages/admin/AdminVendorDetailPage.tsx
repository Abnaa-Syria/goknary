import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Store, DollarSign, Percent, ShieldAlert,
  Briefcase, Package, ShoppingBag, Star, Mail, Phone,
  Calendar, CheckCircle, XCircle, AlertCircle, ExternalLink,
  ClipboardList
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { StatCard } from './DashboardComponents';
import { mapEnum, orderStatusMap, vendorStatusMap } from '../../utils/localization';

interface VendorDetails {
  vendor: {
    id: string;
    storeName: string;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    logo: string | null;
    banner: string | null;
    rating: number;
    totalReviews: number;
    status: string;
    verified: boolean;
    commissionRate: number;
    createdAt: string;
    user: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
    };
  };
  stats: {
    totalOrders: number;
    totalProducts: number;
    totalSales: number;
    commissionRate: number;
    commissionAmount: number;
    netEarnings: number;
    pendingSales: number;
    pendingEarnings: number;
    availableBalance: number;
    withdrawnAmount: number;
  };
  ordersByStatus: Array<{
    status: string;
    count: number;
  }>;
  recentOrders: Array<{
    id: string;
    status: string;
    total: number;
    createdAt: string;
    user: {
      name: string;
      email: string;
    };
  }>;
  products: Array<{
    id: string;
    name: string;
    sku: string;
    price: number;
    discountPrice: number | null;
    stock: number;
    status: string;
    category: {
      name: string;
    };
    brand: {
      name: string;
    } | null;
  }>;
}

const AdminVendorDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<VendorDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [newCommissionRate, setNewCommissionRate] = useState('10');
  const [commissionSaving, setCommissionSaving] = useState(false);

  useEffect(() => {
    if (vendorId) {
      fetchVendorDetails();
    }
  }, [vendorId]);

  const fetchVendorDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/vendors/${vendorId}`);
      setData(response.data);
      setNewCommissionRate(response.data.vendor.commissionRate?.toString() || '10');
    } catch (error: any) {
      console.error('Failed to fetch vendor details:', error);
      toast.error(error.response?.data?.error || 'Failed to fetch vendor details');
    } finally {
      setLoading(false);
    }
  };

  const handleCommissionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(newCommissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error(isRTL ? 'يجب أن تكون النسبة رقماً بين 0 و 100' : 'Commission rate must be a number between 0 and 100');
      return;
    }

    try {
      setCommissionSaving(true);
      await api.patch(`/admin/vendors/${vendorId}/commission`, { commissionRate: rate });
      toast.success(isRTL ? 'تم تحديث نسبة العمولة بنجاح' : 'Commission rate updated successfully');
      setCommissionModalOpen(false);
      fetchVendorDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error || (isRTL ? 'فشل تحديث نسبة العمولة' : 'Failed to update commission rate'));
    } finally {
      setCommissionSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!data) return;
    try {
      setActionLoading(true);
      await api.patch(`/admin/vendors/${vendorId}/approve`);
      toast.success(t('admin.vendorsPage.approveSuccess', 'Vendor approved successfully'));
      fetchVendorDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.approveFailed', 'Failed to approve vendor'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!data) return;
    if (!window.confirm(t('admin.vendorsPage.rejectConfirm', 'Are you sure you want to reject this vendor?'))) return;

    try {
      setActionLoading(true);
      await api.patch(`/admin/vendors/${vendorId}/reject`);
      toast.success(t('admin.vendorsPage.rejectSuccess', 'Vendor rejected'));
      fetchVendorDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.rejectFailed', 'Failed to reject vendor'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!data) return;
    if (!window.confirm(t('admin.vendorsPage.suspendConfirm', 'Are you sure you want to suspend this vendor?'))) return;

    try {
      setActionLoading(true);
      await api.patch(`/admin/vendors/${vendorId}/suspend`);
      toast.success(t('admin.vendorsPage.suspendSuccess', 'Vendor suspended'));
      fetchVendorDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.suspendFailed', 'Failed to suspend vendor'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'REJECTED':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'SUSPENDED':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-purple-100 text-purple-800';
      case 'SHIPPED':
        return 'bg-indigo-100 text-indigo-800';
      case 'CANCELLED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card p-12 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900 mb-2">{t('admin.vendorsPage.noVendors', 'Vendor not found')}</h3>
        <button onClick={() => navigate('/admin/vendors')} className="btn-primary mt-4">
          {t('admin.vendorsPage.back', 'Back to Vendor Directory')}
        </button>
      </div>
    );
  }

  const { vendor, stats, ordersByStatus, recentOrders, products } = data;
  const description = isRTL ? vendor.descriptionAr || vendor.description : vendor.description;

  return (
    <div className="space-y-6">
      {/* Back & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/vendors')}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all"
            title={t('admin.vendorsPage.back', 'Back to Vendors')}
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Store className="text-primary-500" />
              {vendor.storeName}
            </h2>
            <p className="text-gray-500 text-sm">/{vendor.slug}</p>
          </div>
        </div>

        {/* Administration Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            disabled={actionLoading}
            onClick={() => setCommissionModalOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-1.5"
          >
            <Percent size={16} />
            {isRTL ? 'تعديل نسبة العمولة' : 'Edit Commission'}
          </button>
          {vendor.status === 'PENDING' && (
            <>
              <button
                disabled={actionLoading}
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
              >
                {t('admin.vendorsPage.approve', 'Approve')}
              </button>
              <button
                disabled={actionLoading}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
              >
                {t('admin.vendorsPage.reject', 'Reject')}
              </button>
            </>
          )}
          {vendor.status === 'APPROVED' && (
            <button
              disabled={actionLoading}
              onClick={handleSuspend}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
            >
              {t('admin.vendorsPage.suspend', 'Suspend')}
            </button>
          )}
          {vendor.status === 'SUSPENDED' && (
            <button
              disabled={actionLoading}
              onClick={handleApprove}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all"
            >
              {t('admin.vendorsPage.reApprove', 'Re-approve')}
            </button>
          )}
        </div>
      </div>

      {/* Vendor Profile Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
        {/* Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-primary-400 to-indigo-500 relative">
          {vendor.banner && (
            <img 
              src={vendor.banner} 
              alt={vendor.storeName} 
              className="w-full h-full object-cover opacity-60" 
            />
          )}
          <span className={`absolute top-4 right-4 rtl:left-4 rtl:right-auto px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(vendor.status)} shadow-sm`}>
            {mapEnum(vendorStatusMap, vendor.status)}
          </span>
        </div>

        {/* Profile Meta */}
        <div className="p-6 pt-0 relative flex flex-col md:flex-row md:items-end gap-5 -mt-10">
          <div className="w-20 h-20 bg-white rounded-2xl border-4 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
            {vendor.logo ? (
              <img src={vendor.logo} alt={vendor.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-xl font-bold text-gray-900">{vendor.storeName}</h3>
            {description && <p className="text-sm text-gray-500 max-w-2xl">{description}</p>}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500 md:self-center border-t border-gray-50 pt-4 md:border-0 md:pt-0">
            <div className="flex items-center gap-1.5">
              <Star className="text-yellow-400 w-4 h-4 fill-yellow-400" />
              <span className="font-bold text-gray-900">{vendor.rating.toFixed(1)}</span>
              <span>({vendor.totalReviews} {t('product.reviews', 'reviews')})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              <span>{t('account.placedOn', 'Joined')}: {formatDate(vendor.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* User / Owner Info */}
        <div className="bg-gray-50 border-t border-gray-100 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Star className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('admin.vendorsPage.owner', 'Owner')}</p>
              <p className="text-sm font-semibold text-gray-900">{vendor.user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('account.email', 'Email')}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{vendor.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{t('account.phone', 'Phone')}</p>
              <p className="text-sm font-semibold text-gray-900">{vendor.user.phone || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${
            activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {isRTL ? 'نظرة عامة' : 'Overview'}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${
            activeTab === 'products' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {t('admin.products', 'Products')} ({stats.totalProducts})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${
            activeTab === 'orders' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          {t('admin.orders', 'Orders')} ({stats.totalOrders})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Financial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 text-start">
            <StatCard
              title={isRTL ? 'المبيعات المحققة' : 'Realized Sales'}
              value={formatPrice(stats.totalSales)}
              icon={DollarSign}
              color="primary"
            />
            <StatCard
              title={isRTL ? 'صافي الأرباح المحققة' : 'Realized Net Earnings'}
              value={formatPrice(stats.netEarnings)}
              icon={DollarSign}
              color="success"
            />
            <StatCard
              title={isRTL ? `عمولة المنصة المحققة (${stats.commissionRate}%)` : `Realized Platform Commission (${stats.commissionRate}%)`}
              value={formatPrice(stats.commissionAmount)}
              icon={Percent}
              color="warning"
            />
            <StatCard
              title={isRTL ? 'الرصيد المتاح للسحب' : 'Available Balance'}
              value={formatPrice(stats.availableBalance)}
              icon={DollarSign}
              color="success"
            />
            <StatCard
              title={isRTL ? 'أرباح معلقة' : 'Pending Earnings'}
              value={formatPrice(stats.pendingEarnings)}
              icon={DollarSign}
              color="warning"
            />
            <StatCard
              title={isRTL ? 'مبيعات معلقة' : 'Pending Sales'}
              value={formatPrice(stats.pendingSales)}
              icon={ShoppingBag}
              color="warning"
            />
            <StatCard
              title={isRTL ? 'إجمالي المسحوبات' : 'Withdrawn Amount'}
              value={formatPrice(stats.withdrawnAmount)}
              icon={DollarSign}
              color="info"
            />
            <StatCard
              title={t('admin.totalProducts', 'Total Products')}
              value={stats.totalProducts}
              icon={Package}
              color="info"
            />
            <StatCard
              title={t('admin.totalOrders', 'Total Orders')}
              value={stats.totalOrders}
              icon={ShoppingBag}
              color="primary"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders Status Summary */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-start">
              <h3 className="text-base font-bold text-gray-900 mb-5 flex items-center gap-2">
                <ClipboardList className="text-gray-400" />
                {t('admin.orderStatus', 'Order Status Breakdown')}
              </h3>
              {ordersByStatus.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {t('admin.noOrders', 'No orders recorded')}
                </p>
              ) : (
                <div className="space-y-4">
                  {ordersByStatus.map((statusObj) => {
                    const total = ordersByStatus.reduce((sum, s) => sum + s.count, 0);
                    const percentage = total > 0 ? Math.round((statusObj.count / total) * 100) : 0;
                    return (
                      <div key={statusObj.status} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-semibold text-gray-700">
                            {mapEnum(orderStatusMap, statusObj.status)}
                          </span>
                          <span className="text-gray-500 font-bold">
                            {statusObj.count} ({percentage}%)
                          </span>
                        </div>
                        <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              statusObj.status === 'DELIVERED' ? 'bg-green-500' :
                              statusObj.status === 'PENDING' ? 'bg-yellow-500' :
                              statusObj.status === 'PROCESSING' ? 'bg-purple-500' :
                              statusObj.status === 'SHIPPED' ? 'bg-indigo-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Recent Orders List */}
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 text-start">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ShoppingBag className="text-gray-400" />
                  {isRTL ? 'آخر الطلبات' : 'Recent Orders'}
                </h3>
              </div>
              {recentOrders.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  {t('admin.noOrders', 'No orders placed yet')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                        <th className="pb-3 text-start">{t('admin.ordersPage.orderId', 'Order ID')}</th>
                        <th className="pb-3 text-start">{t('admin.orderDetail.customer', 'Customer')}</th>
                        <th className="pb-3 text-start">{t('admin.ordersPage.amount', 'Amount')}</th>
                        <th className="pb-3 text-start">{t('admin.ordersPage.status', 'Status')}</th>
                        <th className="pb-3 text-end">{t('admin.vendorsPage.actions', 'Actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50/50">
                          <td className="py-3 font-semibold text-gray-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td className="py-3">
                            <div className="font-semibold text-gray-800">{order.user.name}</div>
                            <div className="text-xs text-gray-400">{order.user.email}</div>
                          </td>
                          <td className="py-3 font-bold text-gray-900">
                            {formatPrice(order.total)}
                          </td>
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getOrderStatusColor(order.status)}`}>
                              {mapEnum(orderStatusMap, order.status)}
                            </span>
                          </td>
                          <td className="py-3 text-end">
                            <Link 
                              to={`/admin/orders/${order.id}`}
                              className="text-primary-600 hover:text-primary-700 font-bold inline-flex items-center gap-1 text-xs"
                            >
                              {t('admin.orderDetail.viewDetails', 'View')} <ExternalLink size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-start">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-bold text-gray-900">{t('admin.vendorProducts.title', 'Vendor Product Catalog')}</h3>
            <button 
              onClick={() => navigate(`/admin/vendors/${vendorId}/products`)} 
              className="text-sm font-bold text-primary-500 hover:underline inline-flex items-center gap-1"
            >
              {t('admin.vendorsPage.manageProducts', 'Manage Catalog')} <ExternalLink size={14} />
            </button>
          </div>
          {products.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package size={36} className="mx-auto mb-2 text-gray-300" />
              {t('admin.vendorsPage.noProducts', 'No products listed yet')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-gray-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="px-6 py-4 text-start">{t('admin.vendorProducts.table.product', 'Product')}</th>
                    <th className="px-6 py-4 text-start">{t('product.sku', 'SKU')}</th>
                    <th className="px-6 py-4 text-start">{t('product.category', 'Category')}</th>
                    <th className="px-6 py-4 text-start">{t('product.price', 'Price')}</th>
                    <th className="px-6 py-4 text-start">{t('product.stock', 'Stock')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.vendorProducts.table.state', 'Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {products.map((prod) => (
                    <tr key={prod.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{prod.name}</div>
                        {prod.brand && <div className="text-xs text-gray-400">{prod.brand.name}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600">{prod.sku}</td>
                      <td className="px-6 py-4 text-gray-600">{prod.category.name}</td>
                      <td className="px-6 py-4">
                        {prod.discountPrice ? (
                          <div className="space-y-0.5">
                            <div className="font-bold text-gray-900">{formatPrice(prod.discountPrice)}</div>
                            <div className="text-xs text-gray-400 line-through">{formatPrice(prod.price)}</div>
                          </div>
                        ) : (
                          <div className="font-bold text-gray-900">{formatPrice(prod.price)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold">
                        {prod.stock === 0 ? (
                          <span className="text-red-500">{t('product.outOfStock', 'Out of Stock')}</span>
                        ) : (
                          <span className="text-gray-800">{prod.stock}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          prod.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          prod.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {prod.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-start">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">{isRTL ? 'سجل طلبات التاجر' : 'Vendor Order Log'}</h3>
          </div>
          {recentOrders.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ShoppingBag size={36} className="mx-auto mb-2 text-gray-300" />
              {t('admin.vendorsPage.noOrders', 'No orders recorded.')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-gray-500 font-semibold uppercase tracking-wider text-xs">
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.orderId', 'Order ID')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.date', 'Date')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.orderDetail.customer', 'Customer')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.amount', 'Amount')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.status', 'Status')}</th>
                    <th className="px-6 py-4 text-end">{t('admin.vendorsPage.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4 text-gray-600">{formatDate(order.createdAt)}</td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-800">{order.user.name}</div>
                        <div className="text-xs text-gray-400">{order.user.email}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900">{formatPrice(order.total)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                          {mapEnum(orderStatusMap, order.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-end">
                        <Link 
                          to={`/admin/orders/${order.id}`}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-primary-50 hover:text-primary-600 border border-gray-200 hover:border-primary-100 rounded-xl font-bold transition-all text-xs inline-flex items-center gap-1"
                        >
                          {t('admin.orderDetail.viewDetails', 'View Order')} <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {/* Commission Edit Modal */}
      <AnimatePresence>
        {commissionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setCommissionModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-gray-100"
            >
              <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {isRTL ? 'تعديل نسبة عمولة المنصة' : 'Edit Platform Commission Rate'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {isRTL ? 'تحديد النسبة المئوية التي تقتطعها المنصة من مبيعات هذا التاجر.' : 'Set the percentage rate the platform takes from this vendor\'s sales.'}
                </p>
              </div>

              <form onSubmit={handleCommissionSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">
                    {isRTL ? 'نسبة العمولة (%)' : 'Commission Rate (%)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      step="0.1"
                      value={newCommissionRate}
                      onChange={e => setNewCommissionRate(e.target.value)}
                      className="w-full ps-4 pe-12 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono font-bold"
                    />
                    <div className="absolute end-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">%</div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
                  <button 
                    type="button" 
                    onClick={() => setCommissionModalOpen(false)} 
                    className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={commissionSaving}
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-xl transition-all shadow-lg shadow-primary-200 disabled:opacity-50 flex items-center gap-2"
                  >
                    {commissionSaving ? t('common.loading') : (isRTL ? 'حفظ التغييرات' : 'Save Changes')}
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

export default AdminVendorDetailPage;
