import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, ShoppingBag, Package, Settings,
  Image as ImageIcon, Tag, Briefcase, LogOut,
  DollarSign, X, Store, MessageSquare, Percent,
  TrendingUp, ShoppingCart, RefreshCw, ArrowUpRight,
  Truck, Megaphone, Shield, Trophy,
  CheckCircle2, AlertTriangle, Clock, CreditCard, ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import api from '../../lib/api';
import AdminVendorsPage from './AdminVendorsPage';
import AdminVendorDetailPage from './AdminVendorDetailPage';
import AdminUsersPage from './AdminUsersPage';
import AdminCategoriesPage from './AdminCategoriesPage';
import AdminBrandsPage from './AdminBrandsPage';
import AdminBannersPage from './AdminBannersPage';
import AdminOrdersPage from './AdminOrdersPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminRankingPage from './AdminRankingPage';
import AdminDiscountSuggestionsPage from './AdminDiscountSuggestionsPage';
import AdminReviewsPage from './AdminReviewsPage';
import AdminProductsPage from './AdminProductsPage';
import AdminVendorProductsPage from './AdminVendorProductsPage';
import AdminPendingProductsPage from './AdminPendingProductsPage';
import AdminProductPreviewPage from './AdminProductPreviewPage';
import AdminProductStudioPage from './AdminProductStudioPage';
import ProductCommandCenterPage from '../common/ProductCommandCenterPage';
import AdminCouponsPage from './AdminCouponsPage';
import AdminOrderDetailPage from './AdminOrderDetailPage';
import AdminShippingPage from './AdminShippingPage';
import AdminAnnouncementPage from './AdminAnnouncementPage';
import AdminRolesPage from './AdminRolesPage';
import AdminPayoutsPage from './AdminPayoutsPage';
import AdminRefundsPage from './AdminRefundsPage';
import AdminTicketsPage from './AdminTicketsPage';
import AdminTicketDetailsPage from './AdminTicketDetailsPage';
import AdminSearchAnalyticsPage from './AdminSearchAnalyticsPage';
import { DashboardFooter } from '../../components/layout/DashboardFooter';

import { hasPermission, getRoleTheme } from '../../utils/permissions';

import {
  StatCard, ChartCard, DashboardSkeleton, EmptyState,
  DashboardTopNav
} from './DashboardComponents';
import { formatPrice } from '../../lib/utils';
import { mapEnum, orderStatusMap, paymentMethodMap, paymentStatusMap } from '../../utils/localization';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  approvedVendors: number;
  totalProducts: number;
  pendingProducts: number;
  activeProducts: number;
  totalOrders: number;
  deliveredOrders?: number;
  totalSales: number;
}

interface DashboardData {
  stats: DashboardStats;
  revenueTrends: { name: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number }[];
  topVendors: { id: string; storeName: string; revenue: number; orders: number }[];
  recentOrders: any[];
  settlementDate?: string | null;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    SHIPPED: 'bg-indigo-100 text-indigo-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

// ─── Forbidden 403 ────────────────────────────────────────────────────────────
const Forbidden403: React.FC<{ user: any }> = ({ user }) => {
  const roleTheme = getRoleTheme(user);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ backgroundColor: roleTheme.badgeBg }}
      >
        <Shield size={48} style={{ color: roleTheme.accent }} />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
      <p className="text-gray-500 max-w-md text-center mb-6">
        You don't have permission to view this page.
      </p>
      <Link
        to="/admin"
        className="px-6 py-2 rounded-xl text-white font-semibold transition-opacity hover:opacity-90"
        style={{ backgroundColor: roleTheme.accent }}
      >
        Back to Dashboard
      </Link>
    </div>
  );
};

// ─── Sidebar Content ──────────────────────────────────────────────────────────
const SidebarContent: React.FC<{
  menuItems: any[];
  location: any;
  sidebarOpen: boolean;
  stats: DashboardStats | null;
  onLogout: () => void;
  t: any;
  user: any;
}> = ({ menuItems, location, sidebarOpen, stats, onLogout, t, user }) => {
  const isRTL = document.documentElement.dir === 'rtl';
  const roleTheme = getRoleTheme(user);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ backgroundColor: roleTheme.sidebarBg, color: roleTheme.sidebarText }}
    >
      {!sidebarOpen && (
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          <LayoutDashboard size={24} style={{ color: roleTheme.accent }} />
        </div>
      )}

      {sidebarOpen && (
        <div className="h-16 hidden lg:flex items-center px-6 border-b border-white/10">
          <span
            className="text-xl font-black uppercase tracking-tighter"
            style={{ color: roleTheme.sidebarText }}
          >
            Go<span style={{ color: roleTheme.accent }}>Knary</span>
          </span>
          <span
            className="ms-2 text-[9px] font-bold rounded-full px-2 py-0.5 uppercase tracking-widest truncate max-w-[120px]"
            style={{ backgroundColor: roleTheme.badgeBg, color: roleTheme.badgeText }}
          >
            {roleTheme.label}
          </span>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            location.pathname === item.path ||
            (item.path !== '/admin' && location.pathname.startsWith(item.path));
          const badgeCount = item.countKey ? (stats as any)?.[item.countKey] : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group"
              style={
                isActive
                  ? { backgroundColor: `${roleTheme.accent}30`, color: roleTheme.sidebarText, fontWeight: 'bold' }
                  : { color: 'rgba(255,255,255,0.7)' }
              }
            >
              <Icon
                size={20}
                style={{ color: isActive ? roleTheme.sidebarText : 'rgba(255,255,255,0.5)' }}
                className="group-hover:text-white transition-colors"
              />
              {sidebarOpen && (
                <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300">
                  {item.name}
                </span>
              )}

              {badgeCount > 0 && sidebarOpen && (
                <span className="ms-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                  {badgeCount}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId="adminActiveNav"
                  className="absolute start-0 w-1 h-6 rounded-full"
                  style={{ backgroundColor: roleTheme.accent }}
                />
              )}

              {!sidebarOpen && (
                <div
                  className="absolute start-full ms-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50"
                >
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-white/10">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-white/10 rounded-xl transition-all group ${!sidebarOpen && 'justify-center'}`}
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform rtl:group-hover:translate-x-1" />
          {sidebarOpen && (
            <span className="text-sm font-medium">{t('common.logout', 'Logout')}</span>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Semantic Status Colors ───────────────────────────────────────────────────
const ORDER_STATUS_COLORS: Record<string, { bg: string; text: string; hex: string }> = {
  DELIVERED: { bg: 'bg-green-100', text: 'text-green-800', hex: '#22c55e' },
  CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-800', hex: '#3b82f6' },
  PROCESSING: { bg: 'bg-purple-100', text: 'text-purple-800', hex: '#a855f7' },
  SHIPPED: { bg: 'bg-indigo-100', text: 'text-indigo-800', hex: '#6366f1' },
  PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-800', hex: '#f59e0b' },
  CANCELLED: { bg: 'bg-red-100', text: 'text-red-800', hex: '#ef4444' },
  REFUNDED: { bg: 'bg-gray-100', text: 'text-gray-800', hex: '#64748b' },
};

const ARABIC_MONTHS: Record<string, string> = {
  Jan: 'يناير', Feb: 'فبراير', Mar: 'مارس', Apr: 'أبريل',
  May: 'مايو', Jun: 'يونيو', Jul: 'يوليو', Aug: 'أغسطس',
  Sep: 'سبتمبر', Oct: 'أكتوبر', Nov: 'نوفمبر', Dec: 'ديسمبر',
};

// ─── Dashboard Home ───────────────────────────────────────────────────────────
const AdminDashboardHome: React.FC<{
  data: DashboardData | null;
  onRefresh: () => void;
  refreshing: boolean;
}> = ({ data, onRefresh, refreshing }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { user } = useAppSelector((state) => state.auth);
  const [settling, setSettling] = useState(false);

  // Operational Queues state (loaded strictly from real existing endpoints)
  const [queueData, setQueueData] = useState<{
    pendingRefunds: number | null;
    pendingPayouts: number | null;
    openTickets: number | null;
    loading: boolean;
  }>({
    pendingRefunds: null,
    pendingPayouts: null,
    openTickets: null,
    loading: true,
  });

  const checkPerm = (perm: string) => hasPermission(user, perm);
  const roleTheme = getRoleTheme(user);

  // Fetch real operational queues
  useEffect(() => {
    let isMounted = true;
    const loadQueues = async () => {
      try {
        const promises: Promise<{ key: string; count: number | null }>[] = [];

        if (checkPerm('READ_ORDERS')) {
          promises.push(
            api.get('/refunds')
              .then((res) => {
                const list = res.data?.refunds || [];
                return {
                  key: 'pendingRefunds',
                  count: list.filter((r: any) =>
                    ['REQUESTED', 'UNDER_REVIEW', 'ITEM_RECEIVED'].includes(r.status || r.currentStatus)
                  ).length,
                };
              })
              .catch(() => ({ key: 'pendingRefunds', count: null }))
          );
        }

        if (checkPerm('READ_VENDORS')) {
          promises.push(
            api.get('/payouts/admin')
              .then((res) => {
                const list = res.data?.payouts || [];
                return {
                  key: 'pendingPayouts',
                  count: list.filter((p: any) => p.status === 'PENDING').length,
                };
              })
              .catch(() => ({ key: 'pendingPayouts', count: null }))
          );
        }

        if (checkPerm('READ_USERS')) {
          promises.push(
            api.get('/tickets')
              .then((res) => {
                const list = res.data?.tickets || [];
                return {
                  key: 'openTickets',
                  count: list.filter((tk: any) => ['OPEN', 'IN_PROGRESS'].includes(tk.status)).length,
                };
              })
              .catch(() => ({ key: 'openTickets', count: null }))
          );
        }

        const results = await Promise.all(promises);
        if (!isMounted) return;

        const counts: Record<string, number | null> = {};
        results.forEach((r) => {
          counts[r.key] = r.count;
        });

        setQueueData((prev) => ({
          ...prev,
          ...counts,
          loading: false,
        }));
      } catch {
        if (isMounted) setQueueData((prev) => ({ ...prev, loading: false }));
      }
    };

    loadQueues();
    return () => {
      isMounted = false;
    };
  }, [data, refreshing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSettlePlatform = async () => {
    const confirmed = window.confirm(
      t(
        'admin.settlePlatformConfirm',
        'Do you want to reset the platform statistics? Figures will be calculated from now on'
      )
    );
    if (!confirmed) return;

    setSettling(true);
    try {
      await api.post('/admin/platform/settle');
      toast.success(
        t('admin.settlePlatformSuccess', 'Platform statistics successfully reset!')
      );
      onRefresh();
    } catch (error) {
      console.error('Failed to settle platform:', error);
      toast.error(t('admin.settlePlatformFailed', 'Failed to reset platform statistics'));
    } finally {
      setSettling(false);
    }
  };


  const PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#22c55e', '#ef4444', '#6b7280'];
  const trendData = useMemo(() => {
    const raw = data?.revenueTrends || [];
    return raw.map((d) => ({
      ...d,
      displayName: isRTL ? ARABIC_MONTHS[d.name] || d.name : d.name,
    }));
  }, [data, isRTL]);

  if (!data) return <DashboardSkeleton />;

  const { stats, recentOrders = [], topVendors = [], ordersByStatus = [] } = data;

  const avgOrderValue =
    (stats.deliveredOrders || 0) > 0 ? Math.round(stats.totalSales / (stats.deliveredOrders || 1)) : 0;
  const periodTotalDeliveredOrders = trendData.reduce((sum, d) => sum + d.orders, 0);
  const periodAvgOrders =
    trendData.length > 0 ? Math.round(periodTotalDeliveredOrders / trendData.length) : 0;
  const periodTotalRevenue = trendData.reduce((sum, d) => sum + d.revenue, 0);

  // Peak month
  const peakMonth = trendData.reduce(
    (max, d) => (d.revenue > max.revenue ? d : max),
    { displayName: '—', revenue: 0, orders: 0 }
  );

  // Filter out 0-count statuses for clean pie presentation
  const activeOrdersByStatus = ordersByStatus.filter((s) => s.count > 0);
  const totalTrackedOrders = ordersByStatus.reduce((sum, s) => sum + s.count, 0);

  // ── Check all visible permissions ──
  const hasDashboard = checkPerm('READ_DASHBOARD');
  const hasOrders = checkPerm('READ_ORDERS');
  const hasVendors = checkPerm('READ_VENDORS');
  const hasUsers = checkPerm('READ_USERS');
  const hasProducts = checkPerm('READ_PRODUCTS');
  const hasManageVendors = checkPerm('MANAGE_VENDORS');

  const hasAnyWidget =
    hasDashboard || hasOrders || hasVendors || hasUsers || hasProducts || hasManageVendors;

  // Define Needs Attention queue items based strictly on available real counts
  const attentionItems = [
    (hasVendors || hasManageVendors) && {
      id: 'pending-vendors',
      title: isRTL ? 'بائعون بانتظار الموافقة' : 'Vendors Awaiting Approval',
      count: stats.pendingVendors || 0,
      link: '/admin/vendors?status=PENDING',
      icon: Briefcase,
    },
    hasProducts && {
      id: 'pending-products',
      title: isRTL ? 'منتجات بانتظار المراجعة' : 'Products Awaiting Review',
      count: stats.pendingProducts || 0,
      link: '/admin/pending-products',
      icon: Package,
    },
    hasOrders && queueData.pendingRefunds !== null && {
      id: 'pending-refunds',
      title: isRTL ? 'طلبات استرداد مفتوحة' : 'Open Refund Requests',
      count: queueData.pendingRefunds,
      link: '/admin/refunds',
      icon: RefreshCw,
    },
    hasVendors && queueData.pendingPayouts !== null && {
      id: 'pending-payouts',
      title: isRTL ? 'طلبات سحب معلقة' : 'Pending Payouts',
      count: queueData.pendingPayouts,
      link: '/admin/payouts',
      icon: DollarSign,
    },
    hasUsers && queueData.openTickets !== null && {
      id: 'open-tickets',
      title: isRTL ? 'تذاكر دعم مفتوحة' : 'Open Support Tickets',
      count: queueData.openTickets,
      link: '/admin/tickets',
      icon: MessageSquare,
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    count: number;
    link: string;
    icon: any;
  }>;

  // ── Empty state for STAFF with zero visible widgets ──
  if (user?.role === 'STAFF' && !hasAnyWidget) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
        <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center max-w-lg">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: `${roleTheme.accent}20` }}
          >
            <LayoutDashboard size={40} style={{ color: roleTheme.accent }} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {user?.name}</h2>
          <p className="text-gray-500 mb-4">
            Use the sidebar to navigate to your permitted sections.
          </p>
          <span
            className="px-3 py-1 text-xs font-bold rounded-full"
            style={{ backgroundColor: roleTheme.badgeBg, color: roleTheme.badgeText }}
          >
            {user?.customRole?.name || 'STAFF'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* ── A. Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('admin.overview', 'Overview')}
          </h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            {t('admin.overviewSubtitle', 'Marketplace performance overview')}
          </p>
          {data.settlementDate && (
            <p className="text-xs text-purple-600 mt-1 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse inline-block" />
              {t('admin.statsCalculatedFrom', 'Statistics calculated from: {{date}}', {
                date: new Date(data.settlementDate).toLocaleString(),
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {checkPerm('MANAGE_ROLES') && (
            <button
              onClick={handleSettlePlatform}
              disabled={settling || refreshing}
              className="flex items-center gap-2 px-3.5 py-2 bg-purple-600 text-white text-xs sm:text-sm font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-sm shadow-purple-200 disabled:opacity-60"
            >
              <RefreshCw size={14} className={settling ? 'animate-spin' : ''} />
              {t('admin.settlePlatform', 'Settle Platform')}
            </button>
          )}
          <button
            onClick={onRefresh}
            disabled={refreshing || settling}
            className="flex items-center gap-2 px-3.5 py-2 text-white text-xs sm:text-sm font-semibold rounded-xl transition-all shadow-sm disabled:opacity-60"
            style={{ backgroundColor: roleTheme.accent }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {/* ── B. Operational Attention (Real Queue Counts Only) ── */}
      {attentionItems.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600">
                <AlertTriangle size={16} />
              </div>
              <h2 className="text-sm font-bold text-gray-900">
                {isRTL ? 'يحتاج إلى انتباهك' : 'Needs Attention'}
              </h2>
            </div>
            <span className="text-xs font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-0.5 rounded-full">
              {attentionItems.filter((i) => i.count > 0).length} {isRTL ? 'مهام معلقة' : 'pending queues'}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {attentionItems.map((item) => {
              const Icon = item.icon;
              const hasPending = item.count > 0;
              return (
                <Link
                  key={item.id}
                  to={item.link}
                  className={`flex flex-col justify-between p-3.5 rounded-xl border transition-all ${
                    hasPending
                      ? 'bg-white border-amber-200 hover:border-amber-400 hover:shadow-sm'
                      : 'bg-white/60 border-gray-100 hover:bg-white text-gray-500'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="text-xs font-semibold text-gray-700 truncate">{item.title}</span>
                    <Icon size={14} className={hasPending ? 'text-amber-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex items-baseline justify-between mt-1">
                    <span className={`text-xl font-black ${hasPending ? 'text-gray-900' : 'text-gray-400'}`}>
                      {item.count.toLocaleString()}
                    </span>
                    <span className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5">
                      {isRTL ? 'مراجعة' : 'Review'} →
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── C. Primary KPI Row (Max 6 core marketplace cards) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 text-start">
        {hasDashboard && (
          <StatCard
            title={t('admin.realizedRevenue', 'Realized Revenue')}
            value={formatPrice(stats.totalSales)}
            icon={DollarSign}
            color="success"
          />
        )}
        {hasOrders && (
          <StatCard
            title={t('admin.totalOrders', 'Total Orders')}
            value={stats.totalOrders.toLocaleString()}
            icon={ShoppingBag}
            color="primary"
          />
        )}
        {hasDashboard && (
          <StatCard
            title={t('admin.avgDeliveredOrderValue', 'Avg. Delivered Order')}
            value={formatPrice(avgOrderValue)}
            icon={TrendingUp}
            color="info"
          />
        )}
        {hasVendors && (
          <StatCard
            title={t('admin.totalVendors', 'Approved Vendors')}
            value={(stats.approvedVendors || stats.totalVendors).toLocaleString()}
            icon={Store}
            color="primary"
          />
        )}
        {hasUsers && (
          <StatCard
            title={t('admin.customers', 'Customers')}
            value={stats.totalUsers.toLocaleString()}
            icon={Users}
            color="info"
          />
        )}
        {hasProducts && (
          <StatCard
            title={t('admin.activeProducts', 'Active Products')}
            value={(stats.activeProducts || stats.totalProducts).toLocaleString()}
            icon={Package}
            color="primary"
          />
        )}
      </div>

      {/* ── D. Revenue & Orders Trend (2-Column Grid) ── */}
      {(hasDashboard || hasOrders) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
          {hasDashboard && (
            <div className="lg:col-span-2 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {t('admin.revenueTrend', 'Revenue Trend')}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isRTL
                        ? `إجمالي مبيعات آخر ${trendData.length} أشهر`
                        : `Last ${trendData.length} months gross delivered sales`}
                    </p>
                  </div>
                  <div className="text-xs text-gray-500 font-medium bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-100 w-fit">
                    {isRTL ? 'إجمالي الفترة:' : 'Period Total:'}{' '}
                    <span className="font-bold text-gray-900">{formatPrice(periodTotalRevenue)}</span>
                  </div>
                </div>

                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={roleTheme.accent} stopOpacity={0.2} />
                          <stop offset="95%" stopColor={roleTheme.accent} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="displayName"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '14px',
                          border: 'none',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [formatPrice(Number(val)), t('admin.dashboard.revenue', 'Revenue')]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke={roleTheme.accent}
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#revGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {isRTL ? 'أعلى شهر مبيعاً:' : 'Peak Month:'}{' '}
                  <strong className="text-gray-800">{peakMonth.displayName}</strong> ({formatPrice(peakMonth.revenue)})
                </span>
                <span className="text-[11px] text-gray-400">
                  {isRTL ? 'مبيعات الطلبات المسلمة فقط' : 'Delivered orders only'}
                </span>
              </div>
            </div>
          )}

          {hasOrders && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {isRTL ? 'حجم الطلبات المسلمة' : 'Delivered Order Volume'}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isRTL ? 'عدد الطلبات شهرياً' : 'Monthly transaction volume'}
                    </p>
                  </div>
                </div>

                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="displayName"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{
                          borderRadius: '14px',
                          border: 'none',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          fontSize: '12px',
                        }}
                        formatter={(val: any) => [val, t('admin.dashboard.orders', 'Orders')]}
                      />
                      <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                        {trendData.map((_, i) => (
                          <Cell
                            key={i}
                            fill={i === trendData.length - 1 ? roleTheme.accent : '#cbd5e1'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="pt-3 mt-2 border-t border-gray-50 flex items-center justify-between text-xs">
                <span className="text-gray-500 font-medium">
                  {t('admin.monthlyAvg', 'Monthly Avg.')}
                </span>
                <span className="text-gray-900 font-bold">
                  {t('admin.ordersCount', '{{count}} orders', { count: periodAvgOrders })}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── E. Bottom Operational Grid (Top Vendors by Sales, Order Status, Recent Orders) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Top Vendors by Sales */}
        {hasVendors && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {isRTL ? 'أفضل البائعين حسب المبيعات' : 'Top Vendors by Sales'}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isRTL ? 'مرتب حسب إجمالي المبيعات المكتملة' : 'Ranked by delivered sales volume'}
                  </p>
                </div>
                <Link
                  to="/admin/vendors"
                  className="text-xs hover:underline font-semibold flex items-center gap-1"
                  style={{ color: roleTheme.accent }}
                >
                  {t('common.viewAll', 'View all')} <ArrowUpRight size={12} />
                </Link>
              </div>

              <div className="space-y-3">
                {topVendors.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    {t('admin.noVendorData', 'No vendor data yet')}
                  </p>
                ) : (
                  topVendors.map((vendor, i) => (
                    <div key={vendor.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-colors">
                      <div
                        className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${roleTheme.accent}20`, color: roleTheme.accent }}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Link
                          to={`/admin/vendors/${vendor.id}`}
                          className="text-sm font-semibold text-gray-900 hover:text-blue-600 truncate block"
                        >
                          {vendor.storeName}
                        </Link>
                        <p className="text-xs text-gray-400">
                          {vendor.orders} {isRTL ? 'طلب مكتمل' : 'delivered orders'}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                        {formatPrice(vendor.revenue)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Column 2: Order Status Distribution */}
        {hasOrders && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {t('admin.orderStatus', 'Order Status')}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isRTL ? 'توزيع حالات الطلبات النشطة' : 'Distribution across active orders'}
                  </p>
                </div>
                <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                  {totalTrackedOrders} {isRTL ? 'طلب' : 'orders'}
                </span>
              </div>

              {activeOrdersByStatus.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-10">
                  {t('admin.noOrders', 'No orders yet')}
                </p>
              ) : (
                <>
                  <div className="h-[170px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeOrdersByStatus}
                          dataKey="count"
                          nameKey="status"
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {activeOrdersByStatus.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={ORDER_STATUS_COLORS[entry.status]?.hex || '#94a3b8'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any, name: any) => [
                            `${v} (${totalTrackedOrders > 0 ? Math.round((Number(v) / totalTrackedOrders) * 100) : 0}%)`,
                            mapEnum(orderStatusMap, name),
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-gray-50">
                    {activeOrdersByStatus.slice(0, 5).map((s) => {
                      const color = ORDER_STATUS_COLORS[s.status] || { hex: '#94a3b8', bg: 'bg-gray-100', text: 'text-gray-700' };
                      const pct = totalTrackedOrders > 0 ? Math.round((s.count / totalTrackedOrders) * 100) : 0;
                      return (
                        <div key={s.status} className="flex items-center justify-between text-xs py-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color.hex }} />
                            <span className="text-gray-700 font-medium">{mapEnum(orderStatusMap, s.status)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-500 font-semibold">{s.count}</span>
                            <span className="text-[10px] text-gray-400 w-8 text-end">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Column 3: Recent Orders */}
        {hasOrders && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {t('admin.recentOrders', 'Recent Orders')}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isRTL ? 'أحدث المعاملات بالمنصة' : 'Latest marketplace transactions'}
                  </p>
                </div>
                <Link
                  to="/admin/orders"
                  className="text-xs hover:underline font-semibold flex items-center gap-1"
                  style={{ color: roleTheme.accent }}
                >
                  {t('common.viewAll', 'View all')} <ArrowUpRight size={12} />
                </Link>
              </div>

              <div className="space-y-2.5">
                {recentOrders.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">
                    {t('admin.noOrders', 'No orders yet')}
                  </p>
                ) : (
                  recentOrders.slice(0, 5).map((order: any) => (
                    <div
                      key={order.id}
                      className="p-2.5 rounded-xl border border-gray-50 hover:border-gray-200 transition-all bg-gray-50/40 hover:bg-white"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-bold text-gray-900">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className="text-xs font-extrabold text-gray-900">
                          {formatPrice(order.total)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                        <span className="truncate max-w-[140px] font-medium text-gray-700">
                          {order.user?.name || 'Customer'}
                        </span>
                        <span className="truncate max-w-[120px] text-gray-400">
                          {order.vendor?.storeName || '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-gray-100/60">
                        <span className="text-[10px] text-gray-400">
                          {mapEnum(paymentMethodMap, order.paymentMethod || 'COD')} • {mapEnum(paymentStatusMap, order.paymentStatus || 'PENDING')}
                        </span>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {stats.totalSales === 0 && (
        <EmptyState
          title={t('admin.awaitingActivity', 'Marketplace Awaiting Activity')}
          message={t(
            'admin.awaitingActivityDesc',
            'Once vendors register products and customers place orders, your performance metrics will appear here.'
          )}
        />
      )}
    </div>
  );
};

// ─── Root AdminDashboard ──────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // ── Compute roleTheme ONCE here — single source of truth ──
  const roleTheme = getRoleTheme(user);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/admin' } } });
      return;
    }
    if (user?.role !== 'ADMIN' && user?.role !== 'STAFF') {
      navigate('/');
      return;
    }
    fetchStats();
  }, [isAuthenticated, isInitialized, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await api.get('/admin/dashboard');
      setDashData({
        stats: response.data.stats,
        revenueTrends: response.data.revenueTrends || [],
        ordersByStatus: response.data.ordersByStatus || [],
        topVendors: response.data.topVendors || [],
        recentOrders: response.data.recentOrders || [],
        settlementDate: response.data.settlementDate || null,
      });
    } catch (error: any) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to sync with analytics server');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => fetchStats(true);

  const menuItems = [
    { path: '/admin', name: t('admin.overview', 'Overview'), icon: LayoutDashboard, permission: 'READ_DASHBOARD' },
    { path: '/admin/search-analytics', name: t('search.analyticsTitle', 'Search Analytics'), icon: TrendingUp, permission: 'READ_DASHBOARD' },
    { path: '/admin/users', name: t('admin.users', 'Users'), icon: Users, permission: 'READ_USERS' },
    { path: '/admin/vendors', name: t('admin.vendors', 'Vendors'), icon: Briefcase, permission: 'READ_VENDORS', countKey: 'pendingVendors' },
    { path: '/admin/payouts', name: t('admin.payouts', 'Payout Requests'), icon: DollarSign, permission: 'READ_VENDORS' },
    { path: '/admin/products', name: t('admin.products', 'Products'), icon: Package, permission: 'READ_PRODUCTS' },
    { path: '/admin/pending-products', name: t('admin.pendingProducts.nav', 'Pending Products'), icon: Package, permission: 'READ_PRODUCTS', countKey: 'pendingProducts' },
    { path: '/admin/categories', name: t('admin.categories', 'Categories'), icon: Tag, permission: 'READ_CATEGORIES' },
    { path: '/admin/brands', name: t('admin.brands', 'Brands'), icon: ShoppingBag, permission: 'READ_BRANDS' },
    { path: '/admin/banners', name: t('admin.banners', 'Banners'), icon: ImageIcon, permission: 'READ_BANNERS' },
    { path: '/admin/orders', name: t('admin.orders', 'Orders'), icon: Package, permission: 'READ_ORDERS' },
    { path: '/admin/refunds', name: t('admin.refunds', 'Refund Requests'), icon: RefreshCw, permission: 'READ_ORDERS' },
    { path: '/admin/reviews', name: t('admin.reviews', 'Reviews'), icon: MessageSquare, permission: 'READ_REVIEWS' },
    { path: '/admin/tickets', name: t('admin.tickets', 'Support Tickets'), icon: MessageSquare, permission: 'READ_USERS' },
    { path: '/admin/coupons', name: t('admin.coupons', 'Coupons'), icon: Percent, permission: 'READ_COUPONS' },
    { path: '/admin/shipping', name: t('admin.shipping', 'Shipping Rates'), icon: Truck, permission: 'READ_SHIPPING' },
    { path: '/admin/announcements', name: t('admin.broadcast', 'Site Broadcast'), icon: Megaphone, permission: 'READ_ANNOUNCEMENTS' },
    { path: '/admin/ranking', name: t('admin.rankingNav', 'Ranking'), icon: Trophy, permission: 'READ_SETTINGS' },
    { path: '/admin/discount-suggestions', name: t('discountSuggestions.adminNav', 'Discount Suggestions'), icon: Tag, permission: 'READ_PRODUCTS' },
    { path: '/admin/settings', name: t('admin.settings', 'Settings'), icon: Settings, permission: 'MANAGE_ROLES' },
    { path: '/admin/roles', name: t('admin.roles', 'Roles & Access'), icon: Shield, permission: 'MANAGE_ROLES' },
  ];

  const visibleMenuItems = menuItems.filter((item) => hasPermission(user, item.permission));

  const Guard = ({ perm, children }: { perm: string; children: JSX.Element }) => {
    if (!hasPermission(user, perm)) return <Forbidden403 user={user} />;
    return children;
  };

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      toast.success('Logged out successfully');
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="w-64 bg-white border-r border-gray-100 animate-pulse" />
        <div className="flex-1 p-8">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'ADMIN' && user?.role !== 'STAFF')) {
    return <Navigate to="/login" replace />;
  }

  const sidebarW = sidebarOpen ? 'lg:w-64' : 'lg:w-16';
  const sidebarProps = {
    menuItems: visibleMenuItems,
    location,
    sidebarOpen,
    stats: dashData?.stats ?? null,
    onLogout: handleLogout,
    t,
    user,
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex font-sans antialiased ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Sidebar – Desktop */}
      <aside
        className={`hidden lg:flex flex-col border-e border-gray-100 shadow-sm flex-shrink-0 transition-all duration-300 ${sidebarW} overflow-hidden`}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Drawer – Mobile */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 start-0 h-full w-72 shadow-2xl z-50 lg:hidden"
              style={{ backgroundColor: roleTheme.sidebarBg }}
            >
              <div
                className="flex items-center justify-between px-5 h-16 border-b border-white/10"
              >
                <span className="text-lg font-black tracking-tighter" style={{ color: roleTheme.sidebarText }}>
                  Go<span style={{ color: roleTheme.accent }}>Knary</span>
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10"
                >
                  <X size={18} style={{ color: roleTheme.sidebarText }} />
                </button>
              </div>
              <SidebarContent {...sidebarProps} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/*
          ── KEY FIX ──
          Pass roleTheme as a resolved object (not the function itself).
          Also pass role as roleTheme.label (dynamic) not hardcoded "Admin".
        */}
        <DashboardTopNav
          sidebarOpen={sidebarOpen}
          toggleSidebar={() => {
            setSidebarOpen(!sidebarOpen);
            setDrawerOpen(!drawerOpen);
          }}
          onLogout={handleLogout}
          userName={user?.name || 'Admin'}
          role={roleTheme.label}
          roleTheme={roleTheme}
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Routes>
            <Route
              index
              element={
                <AdminDashboardHome
                  data={dashData}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                />
              }
            />
            <Route path="search-analytics" element={<Guard perm="READ_DASHBOARD"><AdminSearchAnalyticsPage /></Guard>} />
            <Route path="users" element={<Guard perm="READ_USERS"><AdminUsersPage /></Guard>} />
            <Route path="vendors" element={<Guard perm="READ_VENDORS"><AdminVendorsPage /></Guard>} />
            <Route path="vendors/:vendorId" element={<Guard perm="READ_VENDORS"><AdminVendorDetailPage /></Guard>} />
            <Route path="vendors/:vendorId/products" element={<Guard perm="READ_PRODUCTS"><AdminVendorProductsPage /></Guard>} />
            <Route path="payouts" element={<Guard perm="READ_VENDORS"><AdminPayoutsPage /></Guard>} />
            <Route path="products" element={<Guard perm="READ_PRODUCTS"><AdminProductsPage /></Guard>} />
            <Route path="pending-products" element={<Guard perm="READ_PRODUCTS"><AdminPendingProductsPage /></Guard>} />
            <Route path="products/new" element={<Guard perm="CREATE_PRODUCTS"><AdminProductStudioPage /></Guard>} />
            <Route path="products/:id/edit" element={<Guard perm="UPDATE_PRODUCTS"><AdminProductStudioPage /></Guard>} />
            <Route path="products/:id/preview" element={<Guard perm="READ_PRODUCTS"><AdminProductPreviewPage /></Guard>} />
            <Route path="products/:id" element={<Guard perm="READ_PRODUCTS"><ProductCommandCenterPage role="admin" /></Guard>} />
            <Route path="categories" element={<Guard perm="READ_CATEGORIES"><AdminCategoriesPage /></Guard>} />
            <Route path="brands" element={<Guard perm="READ_BRANDS"><AdminBrandsPage /></Guard>} />
            <Route path="banners" element={<Guard perm="READ_BANNERS"><AdminBannersPage /></Guard>} />
            <Route path="orders" element={<Guard perm="READ_ORDERS"><AdminOrdersPage /></Guard>} />
            <Route path="orders/:id" element={<Guard perm="READ_ORDERS"><AdminOrderDetailPage /></Guard>} />
            <Route path="refunds" element={<Guard perm="READ_ORDERS"><AdminRefundsPage /></Guard>} />
            <Route path="reviews" element={<Guard perm="READ_REVIEWS"><AdminReviewsPage /></Guard>} />
            <Route path="tickets" element={<Guard perm="READ_USERS"><AdminTicketsPage /></Guard>} />
            <Route path="tickets/:id" element={<Guard perm="READ_USERS"><AdminTicketDetailsPage /></Guard>} />
            <Route path="coupons" element={<Guard perm="READ_COUPONS"><AdminCouponsPage /></Guard>} />
            <Route path="shipping" element={<Guard perm="READ_SHIPPING"><AdminShippingPage /></Guard>} />
            <Route path="announcements" element={<Guard perm="READ_ANNOUNCEMENTS"><AdminAnnouncementPage /></Guard>} />
            <Route path="roles" element={<Guard perm="MANAGE_ROLES"><AdminRolesPage /></Guard>} />
            <Route path="ranking" element={<Guard perm="READ_SETTINGS"><AdminRankingPage /></Guard>} />
            <Route path="discount-suggestions" element={<Guard perm="READ_PRODUCTS"><AdminDiscountSuggestionsPage /></Guard>} />
            <Route path="settings" element={<Guard perm="MANAGE_ROLES"><AdminSettingsPage /></Guard>} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
};

export default AdminDashboard;