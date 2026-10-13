import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Store, DollarSign, Percent, ShieldAlert,
  Briefcase, Package, ShoppingBag, Mail, Phone,
  Calendar, CheckCircle, XCircle, AlertCircle, ExternalLink,
  ClipboardList, ScrollText, Wallet, Clock, TrendingUp,
  Truck, RotateCcw, CheckCircle2, ShieldCheck, Tag,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { StatCard } from './DashboardComponents';
import {
  mapEnum,
  orderStatusMap,
  vendorStatusMap,
  productStatusMap,
  paymentMethodMap,
  paymentStatusMap,
} from '../../utils/localization';
import { getPolicyText, getReturnWindowDays, type VendorPolicyFields } from '../../lib/vendorPolicies';
import { useAppSelector } from '../../store/hooks';
import { hasPermission } from '../../utils/permissions';

interface VendorDetails {
  vendor: VendorPolicyFields & {
    id: string;
    storeName: string;
    slug: string;
    description: string | null;
    descriptionAr: string | null;
    logo: string | null;
    banner: string | null;
    rating?: number;
    totalReviews?: number;
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
    paymentMethod?: string;
    paymentStatus?: string;
    shippingCost?: number;
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
    images?: string[];
    category: {
      name: string;
    };
    brand: {
      name: string;
    } | null;
  }>;
}

const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-800', hex: '#22c55e' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#3b82f6' },
  PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#a855f7' },
  SHIPPED: { bg: 'bg-indigo-100', text: 'text-indigo-800', hex: '#6366f1' },
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#f59e0b' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', hex: '#ef4444' },
  REFUNDED: { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#64748b' },
};

const AdminVendorDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { vendorId } = useParams<{ vendorId: string }>();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const canManageFinance = hasPermission(user, 'UPDATE_PAYOUTS');

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

  // Real operational breakdown from database counts
  const totalTrackedOrders = ordersByStatus.reduce((sum, s) => sum + s.count, 0);
  const deliveredOrders = ordersByStatus.find((s) => s.status === 'DELIVERED')?.count || 0;
  const inProgressOrders = ordersByStatus
    .filter((s) => ['CONFIRMED', 'PROCESSING', 'SHIPPED'].includes(s.status))
    .reduce((sum, s) => sum + s.count, 0);
  const pendingOrders = ordersByStatus.find((s) => s.status === 'PENDING')?.count || 0;
  const cancelledOrders = ordersByStatus.find((s) => s.status === 'CANCELLED')?.count || 0;
  const refundedOrders = ordersByStatus.find((s) => s.status === 'REFUNDED')?.count || 0;

  // Real product mix counts
  const activeProducts = products.filter((p) => p.status === 'ACTIVE').length;
  const draftProducts = products.filter((p) => p.status === 'DRAFT').length;
  const outOfStockProducts = products.filter((p) => p.stock === 0).length;

  // Real store policies
  const returnPolicyText = getPolicyText(vendor, 'return', isRTL);
  const shippingPolicyText = getPolicyText(vendor, 'shipping', isRTL);
  const exchangePolicyText = getPolicyText(vendor, 'exchange', isRTL);
  const returnWindowDays = getReturnWindowDays(vendor);

  return (
    <div className="space-y-6">
      {/* Back & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/vendors')}
            className="p-2 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-all shadow-sm"
            title={t('admin.vendorsPage.back', 'Back to Vendors')}
          >
            <ArrowLeft size={18} className="rtl:rotate-180" />
          </button>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-900">
              <Store className="text-primary-600" />
              {vendor.storeName}
            </h2>
            <p className="text-gray-500 text-sm">/{vendor.slug}</p>
          </div>
        </div>

        {/* Administration Actions */}
        <div className="flex flex-wrap gap-2">
          {canManageFinance && <button
            disabled={actionLoading}
            onClick={() => setCommissionModalOpen(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Percent size={15} />
            {isRTL ? 'تعديل نسبة العمولة' : 'Edit Commission'}
          </button>}
          {vendor.status === 'PENDING' && (
            <>
              <button
                disabled={actionLoading}
                onClick={handleApprove}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
              >
                {t('admin.vendorsPage.approve', 'Approve')}
              </button>
              <button
                disabled={actionLoading}
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
              >
                {t('admin.vendorsPage.reject', 'Reject')}
              </button>
            </>
          )}
          {vendor.status === 'APPROVED' && (
            <button
              disabled={actionLoading}
              onClick={handleSuspend}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
            >
              {t('admin.vendorsPage.suspend', 'Suspend')}
            </button>
          )}
          {vendor.status === 'SUSPENDED' && (
            <button
              disabled={actionLoading}
              onClick={handleApprove}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-sm"
            >
              {t('admin.vendorsPage.reApprove', 'Re-approve')}
            </button>
          )}
        </div>
      </div>

      {/* Vendor Profile Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden relative">
        {/* Banner */}
        <div className="h-32 w-full bg-gradient-to-r from-blue-700 via-indigo-700 to-primary-800 relative">
          {vendor.banner && (
            <img
              src={vendor.banner}
              alt={vendor.storeName}
              className="w-full h-full object-cover opacity-50"
            />
          )}
          <span className={`absolute top-4 right-4 rtl:left-4 rtl:right-auto px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(vendor.status)} shadow-sm`}>
            {mapEnum(vendorStatusMap, vendor.status)}
          </span>
        </div>

        {/* Profile Meta (NO SEEDED RATINGS) */}
        <div className="p-6 pt-0 relative flex flex-col md:flex-row md:items-end gap-5 -mt-10">
          <div className="w-20 h-20 bg-white rounded-2xl border-4 border-white shadow-md overflow-hidden flex items-center justify-center flex-shrink-0">
            {vendor.logo ? (
              <img src={vendor.logo} alt={vendor.storeName} className="w-full h-full object-cover" />
            ) : (
              <Store className="w-10 h-10 text-gray-300" />
            )}
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold text-gray-900">{vendor.storeName}</h3>
              {vendor.verified && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <ShieldCheck size={12} />
                  {isRTL ? 'موثق' : 'Verified'}
                </span>
              )}
            </div>
            {description && <p className="text-sm text-gray-500 max-w-2xl">{description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500 md:self-center border-t border-gray-50 pt-4 md:border-0 md:pt-0">
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-3 py-1.5 rounded-xl">
              <Percent className="w-3.5 h-3.5 text-primary-600" />
              <span>{isRTL ? 'نسبة العمولة:' : 'Commission:'} <strong className="text-gray-900">{stats.commissionRate}%</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{t('account.placedOn', 'Joined')}: <strong className="text-gray-700">{formatDate(vendor.createdAt)}</strong></span>
            </div>
          </div>
        </div>

        {/* User / Owner Info */}
        <div className="bg-gray-50/70 border-t border-gray-100 p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 text-start">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Store className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{t('admin.vendorsPage.owner', 'Owner')}</p>
              <p className="text-sm font-semibold text-gray-900">{vendor.user.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{t('account.email', 'Email')}</p>
              <p className="text-sm font-semibold text-gray-900 truncate">{vendor.user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border border-gray-200 text-gray-400">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{t('account.phone', 'Phone')}</p>
              <p className="text-sm font-semibold text-gray-900">{vendor.user.phone || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${activeTab === 'overview' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
        >
          {isRTL ? 'نظرة عامة' : 'Overview'}
        </button>
        <button
          onClick={() => setActiveTab('products')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${activeTab === 'products' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
        >
          {t('admin.products', 'Products')} ({stats.totalProducts})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 font-bold text-sm border-b-2 transition-all relative ${activeTab === 'orders' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
        >
          {t('admin.orders', 'Orders')} ({stats.totalOrders})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 1. Grouped Financials Hierarchy */}
          <div className="space-y-4">
            {/* Group: Store Performance */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp size={15} className="text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {isRTL ? 'أداء المتجر والمبيعات' : 'Store Performance'}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-start">
                <StatCard
                  title={isRTL ? 'إجمالي المبيعات المحققة' : 'Realized Sales'}
                  value={formatPrice(stats.totalSales)}
                  icon={DollarSign}
                  color="primary"
                />
                <StatCard
                  title={t('admin.totalOrders', 'Total Orders')}
                  value={stats.totalOrders.toLocaleString()}
                  icon={ShoppingBag}
                  color="primary"
                />
                <StatCard
                  title={t('admin.totalProducts', 'Total Products')}
                  value={stats.totalProducts.toLocaleString()}
                  icon={Package}
                  color="info"
                />
              </div>
            </div>

            {/* Group: Vendor Money */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Wallet size={15} className="text-green-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {isRTL ? 'أموال ومستحقات التاجر' : 'Vendor Money & Balances'}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-start">
                <StatCard
                  title={isRTL ? 'صافي الأرباح المحققة' : 'Net Delivered Earnings'}
                  value={formatPrice(stats.netEarnings)}
                  icon={Wallet}
                  color="success"
                />
                <StatCard
                  title={isRTL ? 'الرصيد المتاح للسحب' : 'Available Balance'}
                  value={formatPrice(stats.availableBalance)}
                  icon={DollarSign}
                  color="success"
                />
                <StatCard
                  title={isRTL ? 'أرباح قيد الانتظار' : 'Pending Earnings'}
                  value={formatPrice(stats.pendingEarnings)}
                  icon={Clock}
                  color="warning"
                />
                <StatCard
                  title={isRTL ? 'إجمالي المسحوبات' : 'Withdrawn to Date'}
                  value={formatPrice(stats.withdrawnAmount)}
                  icon={CheckCircle}
                  color="info"
                />
              </div>
            </div>

            {/* Group: Platform Share */}
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <Percent size={15} className="text-amber-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  {isRTL ? 'حصة المنصة وعمولتها' : 'Platform Share & Commission'}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-start">
                <StatCard
                  title={isRTL ? 'نسبة عمولة المنصة المعتمدة' : 'Configured Commission Rate'}
                  value={`${stats.commissionRate}%`}
                  icon={Percent}
                  color="warning"
                />
                <StatCard
                  title={isRTL ? 'عمولة المنصة المحققة' : 'Realized Platform Commission'}
                  value={formatPrice(stats.commissionAmount)}
                  icon={DollarSign}
                  color="warning"
                />
              </div>
            </div>
          </div>

          {/* 2. Operational Health & Catalog Status (Real Data Only) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-start">
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {isRTL ? 'الحالة التشغيلية ومزيج الطلبات' : 'Operational Health & Order Mix'}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isRTL ? 'مؤشرات دقيقة من واقع الطلبات والمنتجات الفعلية للتاجر' : 'Real operational distribution from recorded vendor data'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="p-3 bg-green-50/70 border border-green-100 rounded-xl">
                <span className="text-[11px] font-semibold text-green-700 block truncate">
                  {isRTL ? 'طلبات مسلمة' : 'Delivered Orders'}
                </span>
                <span className="text-xl font-black text-green-900 mt-1 block">
                  {deliveredOrders.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                <span className="text-[11px] font-semibold text-blue-700 block truncate">
                  {isRTL ? 'قيد التجهيز/الشحن' : 'In-Progress'}
                </span>
                <span className="text-xl font-black text-blue-900 mt-1 block">
                  {inProgressOrders.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-yellow-50/70 border border-yellow-100 rounded-xl">
                <span className="text-[11px] font-semibold text-yellow-700 block truncate">
                  {isRTL ? 'طلبات معلقة' : 'Pending Orders'}
                </span>
                <span className="text-xl font-black text-yellow-900 mt-1 block">
                  {pendingOrders.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-red-50/70 border border-red-100 rounded-xl">
                <span className="text-[11px] font-semibold text-red-700 block truncate">
                  {isRTL ? 'طلبات ملغاة' : 'Cancelled Orders'}
                </span>
                <span className="text-xl font-black text-red-900 mt-1 block">
                  {cancelledOrders.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
                <span className="text-[11px] font-semibold text-gray-600 block truncate">
                  {isRTL ? 'طلبات مسترجعة' : 'Refunded Orders'}
                </span>
                <span className="text-xl font-black text-gray-800 mt-1 block">
                  {refundedOrders.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl">
                <span className="text-[11px] font-semibold text-indigo-700 block truncate">
                  {isRTL ? 'منتجات نشطة' : 'Active Products'}
                </span>
                <span className="text-xl font-black text-indigo-900 mt-1 block">
                  {activeProducts.toLocaleString()}
                </span>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl">
                <span className="text-[11px] font-semibold text-amber-700 block truncate">
                  {isRTL ? 'نفد من المخزون' : 'Out of Stock'}
                </span>
                <span className="text-xl font-black text-amber-900 mt-1 block">
                  {outOfStockProducts.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Store Policies (Structured 4-card grid) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-start">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <ScrollText className="text-gray-400" size={18} />
                  {t('policies.storePolicies', 'Store Policies')}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isRTL ? 'السياسات المحددة من قبل التاجر مباشرة' : 'Direct vendor-configured commerce policies'}
                </p>
              </div>
              <span className="text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-md border border-gray-100">
                {t('policies.readOnly', 'Read-only')}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Return Policy */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <RotateCcw size={14} className="text-blue-600" />
                      {isRTL ? 'سياسة الاسترجاع' : 'Return Policy'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      returnPolicyText ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {returnPolicyText ? (isRTL ? 'محددة' : 'Configured') : (isRTL ? 'غير محددة' : 'Not configured')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {returnPolicyText || (isRTL ? 'لم يتم تحديد سياسة استرجاع خاصة.' : 'No custom return policy provided.')}
                  </p>
                </div>
              </div>

              {/* Return Window */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-600" />
                      {isRTL ? 'مهلة الاسترجاع' : 'Return Window'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      returnWindowDays !== null ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {returnWindowDays !== null ? (isRTL ? 'محددة' : 'Configured') : (isRTL ? 'غير محددة' : 'Not configured')}
                    </span>
                  </div>
                  <p className="text-sm font-black text-gray-900 mt-1">
                    {returnWindowDays !== null
                      ? `${returnWindowDays} ${isRTL ? 'أيام من تاريخ الاستلام' : 'days after delivery'}`
                      : (isRTL ? 'غير محددة' : 'Not configured')}
                  </p>
                </div>
              </div>

              {/* Shipping Policy */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <Truck size={14} className="text-indigo-600" />
                      {isRTL ? 'سياسة الشحن' : 'Shipping Policy'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      shippingPolicyText ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {shippingPolicyText ? (isRTL ? 'محددة' : 'Configured') : (isRTL ? 'غير محددة' : 'Not configured')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {shippingPolicyText || (isRTL ? 'لم يتم تحديد شروط شحن خاصة.' : 'No custom shipping policy provided.')}
                  </p>
                </div>
              </div>

              {/* Exchange Policy */}
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                      <RotateCcw size={14} className="text-purple-600" />
                      {isRTL ? 'سياسة الاستبدال' : 'Exchange Policy'}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      exchangePolicyText ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {exchangePolicyText ? (isRTL ? 'محددة' : 'Configured') : (isRTL ? 'غير محددة' : 'Not configured')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-3">
                    {exchangePolicyText || (isRTL ? 'لم يتم تحديد سياسة استبدال خاصة.' : 'No custom exchange policy provided.')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Orders Status Distribution & Recent Orders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Orders Status Summary */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm text-start flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ClipboardList className="text-gray-400" size={18} />
                    {t('admin.orderStatus', 'Order Status Breakdown')}
                  </h3>
                  <span className="text-xs font-bold text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                    {totalTrackedOrders} {isRTL ? 'طلب' : 'orders'}
                  </span>
                </div>

                {ordersByStatus.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    {t('admin.noOrders', 'No orders recorded')}
                  </p>
                ) : (
                  <div>
                    {/* Segmented bar */}
                    <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden flex mb-4">
                      {ordersByStatus.filter(s => s.count > 0).map((s) => {
                        const pct = totalTrackedOrders > 0 ? (s.count / totalTrackedOrders) * 100 : 0;
                        const hex = ORDER_STATUS_COLORS[s.status]?.hex || '#94a3b8';
                        return (
                          <div
                            key={s.status}
                            style={{ width: `${pct}%`, backgroundColor: hex }}
                            title={`${mapEnum(orderStatusMap, s.status)}: ${s.count}`}
                            className="h-full first:rounded-s-full last:rounded-e-full transition-all"
                          />
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      {ordersByStatus.map((statusObj) => {
                        const percentage = totalTrackedOrders > 0 ? Math.round((statusObj.count / totalTrackedOrders) * 100) : 0;
                        const hex = ORDER_STATUS_COLORS[statusObj.status]?.hex || '#94a3b8';
                        return (
                          <div key={statusObj.status} className="flex items-center justify-between text-xs py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
                              <span className="font-medium text-gray-700">
                                {mapEnum(orderStatusMap, statusObj.status)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">{statusObj.count}</span>
                              <span className="text-[10px] text-gray-400 w-9 text-end">({percentage}%)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Recent Orders List */}
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2 text-start flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <ShoppingBag className="text-gray-400" size={18} />
                    {isRTL ? 'آخر الطلبات' : 'Recent Orders'}
                  </h3>
                  <button
                    onClick={() => setActiveTab('orders')}
                    className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1"
                  >
                    {t('common.viewAll', 'View all')} ({stats.totalOrders})
                  </button>
                </div>
                {recentOrders.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    {t('admin.noOrders', 'No orders placed yet')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100 text-gray-400 font-semibold">
                          <th className="pb-2.5 text-start">{t('admin.ordersPage.orderId', 'Order ID')}</th>
                          <th className="pb-2.5 text-start">{t('admin.orderDetail.customer', 'Customer')}</th>
                          <th className="pb-2.5 text-start">{isRTL ? 'الدفع' : 'Payment'}</th>
                          <th className="pb-2.5 text-start">{t('admin.ordersPage.amount', 'Amount')}</th>
                          <th className="pb-2.5 text-start">{t('admin.ordersPage.status', 'Status')}</th>
                          <th className="pb-2.5 text-end">{t('admin.vendorsPage.actions', 'Actions')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {recentOrders.slice(0, 6).map((order) => {
                          const statusColor = ORDER_STATUS_COLORS[order.status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                          return (
                            <tr key={order.id} className="hover:bg-gray-50/50">
                              <td className="py-2.5 font-bold text-gray-900">
                                #{order.id.slice(0, 8).toUpperCase()}
                              </td>
                              <td className="py-2.5">
                                <div className="font-semibold text-gray-800">{order.user.name}</div>
                                <div className="text-[10px] text-gray-400">{order.user.email}</div>
                              </td>
                              <td className="py-2.5 text-gray-500">
                                <div>{mapEnum(paymentMethodMap, order.paymentMethod || 'COD')}</div>
                                <div className="text-[10px] text-gray-400">{mapEnum(paymentStatusMap, order.paymentStatus || 'PENDING')}</div>
                              </td>
                              <td className="py-2.5 font-bold text-gray-900">
                                {formatPrice(order.total)}
                              </td>
                              <td className="py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor.bg} ${statusColor.text}`}>
                                  {mapEnum(orderStatusMap, order.status)}
                                </span>
                              </td>
                              <td className="py-2.5 text-end">
                                <Link 
                                  to={`/admin/orders/${order.id}`}
                                  className="text-primary-600 hover:text-primary-700 font-bold inline-flex items-center gap-1 text-[11px]"
                                >
                                  {t('admin.orderDetail.viewDetails', 'View')} <ExternalLink size={11} />
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Products Tab ── */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-start">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-gray-900">{t('admin.vendorProducts.title', 'Vendor Product Catalog')}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {products.length} {isRTL ? 'منتج مسجل' : 'registered products'}
              </p>
            </div>
            <button 
              onClick={() => navigate(`/admin/vendors/${vendorId}/products`)} 
              className="text-sm font-bold text-primary-600 hover:underline inline-flex items-center gap-1"
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
                        <div className="flex items-center gap-3">
                          {prod.images && prod.images.length > 0 ? (
                            <img
                              src={prod.images[0]}
                              alt={prod.name}
                              className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                              <Package size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate max-w-xs">{prod.name}</div>
                            {prod.brand && <div className="text-xs text-gray-400">{prod.brand.name}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-600 text-xs">{prod.sku}</td>
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
                          <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded text-xs font-bold">
                            {t('product.outOfStock', 'Out of Stock')}
                          </span>
                        ) : (
                          <span className="text-gray-800">{prod.stock}</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          prod.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                          prod.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {mapEnum(productStatusMap, prod.status)}
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

      {/* ── Orders Tab ── */}
      {activeTab === 'orders' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden text-start">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">{isRTL ? 'سجل طلبات التاجر' : 'Vendor Order Log'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {stats.totalOrders} {isRTL ? 'إجمالي الطلبات المسجلة' : 'total recorded orders'}
            </p>
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
                    <th className="px-6 py-4 text-start">{isRTL ? 'طريقة الدفع' : 'Payment'}</th>
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.amount', 'Amount')}</th>
                    <th className="px-6 py-4 text-start">{t('admin.ordersPage.status', 'Status')}</th>
                    <th className="px-6 py-4 text-end">{t('admin.vendorsPage.actions', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentOrders.map((order) => {
                    const statusColor = ORDER_STATUS_COLORS[order.status] || { bg: 'bg-gray-100', text: 'text-gray-700' };
                    return (
                      <tr key={order.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-mono font-semibold text-gray-900">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{formatDate(order.createdAt)}</td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-800">{order.user.name}</div>
                          <div className="text-xs text-gray-400">{order.user.email}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">
                          <div>{mapEnum(paymentMethodMap, order.paymentMethod || 'COD')}</div>
                          <div className="text-[10px] text-gray-400">{mapEnum(paymentStatusMap, order.paymentStatus || 'PENDING')}</div>
                        </td>
                        <td className="px-6 py-4 font-bold text-gray-900">{formatPrice(order.total)}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor.bg} ${statusColor.text}`}>
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
                    );
                  })}
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
