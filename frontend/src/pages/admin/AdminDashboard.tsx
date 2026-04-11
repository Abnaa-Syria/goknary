import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, ShoppingBag, Package, Settings,
  Image as ImageIcon, Tag, Briefcase, LogOut,
  DollarSign, X, Store, MessageSquare, Percent,
  TrendingUp, ShoppingCart, RefreshCw, ArrowUpRight,
  Truck, Megaphone
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import api from '../../lib/api';
import AdminVendorsPage from './AdminVendorsPage';
import AdminUsersPage from './AdminUsersPage';
import AdminCategoriesPage from './AdminCategoriesPage';
import AdminBrandsPage from './AdminBrandsPage';
import AdminBannersPage from './AdminBannersPage';
import AdminOrdersPage from './AdminOrdersPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminReviewsPage from './AdminReviewsPage';
import AdminVendorProductsPage from './AdminVendorProductsPage';
import AdminCouponsPage from './AdminCouponsPage';
import AdminOrderDetailPage from './AdminOrderDetailPage';
import AdminShippingPage from './AdminShippingPage';
import AdminAnnouncementPage from './AdminAnnouncementPage';

import {
  StatCard, ChartCard, DashboardSkeleton, EmptyState,
  getMockTrends, DashboardTopNav
} from './DashboardComponents';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend
} from 'recharts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  approvedVendors: number;
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  totalSales: number;
}

interface DashboardData {
  stats: DashboardStats;
  revenueTrends: { name: string; revenue: number; orders: number }[];
  ordersByStatus: { status: string; count: number }[];
  topVendors: { id: string; storeName: string; revenue: number; orders: number }[];
  recentOrders: any[];
}

// ─── Status Badge ────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colors: Record<string, string> = {
    PENDING:    'bg-yellow-100 text-yellow-800',
    CONFIRMED:  'bg-blue-100 text-blue-800',
    PROCESSING: 'bg-purple-100 text-purple-800',
    SHIPPED:    'bg-indigo-100 text-indigo-800',
    DELIVERED:  'bg-green-100 text-green-800',
    CANCELLED:  'bg-red-100 text-red-800',
    REFUNDED:   'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

// ─── Sidebar Content ─────────────────────────────────────────────────────────

const SidebarContent: React.FC<{
  menuItems: any[];
  location: any;
  sidebarOpen: boolean;
  stats: DashboardStats | null;
  onLogout: () => void;
  t: any;
}> = ({ menuItems, location, sidebarOpen, stats, onLogout, t }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!sidebarOpen && (
        <div className="h-16 flex items-center justify-center border-b border-gray-50">
          <LayoutDashboard size={24} className="text-primary-600" />
        </div>
      )}

      {sidebarOpen && (
        <div className="h-16 hidden lg:flex items-center px-6 border-b border-gray-50">
          <span className="text-xl font-black text-gray-900 uppercase tracking-tighter">
            Go<span className="text-primary-600">Knary</span>
          </span>
          <span className="ms-2 text-[9px] font-bold bg-primary-100 text-primary-700 rounded-full px-2 py-0.5 uppercase tracking-widest">
            Admin
          </span>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          const badgeCount = item.countKey ? (stats as any)?.[item.countKey] : 0;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${
                isActive
                  ? 'bg-primary-50 text-primary-600 font-bold'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-900'} />
              {sidebarOpen && <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300">{item.name}</span>}

              {badgeCount > 0 && sidebarOpen && (
                <span className="ms-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ring-2 ring-white">
                  {badgeCount}
                </span>
              )}

              {isActive && (
                <motion.div
                  layoutId="adminActiveNav"
                  className="absolute start-0 w-1 h-6 bg-primary-600 rounded-full"
                />
              )}

              {!sidebarOpen && (
                <div className="absolute start-full ms-2 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-gray-50 bg-gray-50/10">
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all group ${!sidebarOpen && 'justify-center'}`}
        >
          <LogOut size={20} className="group-hover:-translate-x-1 transition-transform rtl:group-hover:translate-x-1" />
          {sidebarOpen && <span className="text-sm font-medium">{t('common.logout', 'Logout')}</span>}
        </button>
      </div>
    </div>
  );
};

// ─── Dashboard Home ──────────────────────────────────────────────────────────

const AdminDashboardHome: React.FC<{
  data: DashboardData | null;
  onRefresh: () => void;
  refreshing: boolean;
}> = ({ data, onRefresh, refreshing }) => {
  const { t } = useTranslation();

  const trendData = useMemo(
    () => (data?.revenueTrends?.length ? data.revenueTrends : getMockTrends()),
    [data]
  );

  const PIE_COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#6366f1', '#22c55e', '#ef4444', '#6b7280'];

  if (!data) return <DashboardSkeleton />;

  const { stats, recentOrders = [], topVendors = [], ordersByStatus = [] } = data;

  const avgOrderValue = stats.totalOrders > 0 ? Math.round(stats.totalSales / stats.totalOrders) : 0;
  const periodAvgOrders = trendData.length > 0
    ? Math.round(trendData.reduce((sum, d) => sum + d.orders, 0) / trendData.length)
    : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('admin.overview', 'Overview')}</h1>
          <p className="text-gray-500 mt-1 text-sm">Real-time marketplace performance &amp; analytics</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200 disabled:opacity-60"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {t('common.refresh', 'Refresh')}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 text-start">
        <StatCard
          title={t('admin.totalRevenue', 'Total Revenue')}
          value={`EGP ${stats.totalSales.toLocaleString()}`}
          icon={DollarSign}
          trend={{ value: 14.2, isPositive: true }}
          color="success"
        />
        <StatCard
          title={t('admin.totalOrders', 'Total Orders')}
          value={stats.totalOrders.toLocaleString()}
          icon={ShoppingBag}
          trend={{ value: 5.6, isPositive: true }}
          color="primary"
        />
        <StatCard
          title={t('admin.avgOrderValue', 'Avg. Order Value')}
          value={`EGP ${avgOrderValue.toLocaleString()}`}
          icon={TrendingUp}
          color="info"
        />
        <StatCard
          title={t('admin.pendingVendors', 'Pending Vendors')}
          value={stats.pendingVendors}
          icon={Briefcase}
          trend={{ value: stats.pendingVendors, isPositive: false }}
          color="warning"
        />
        <StatCard
          title={t('admin.customers', 'Customers')}
          value={stats.totalUsers.toLocaleString()}
          icon={Users}
          color="info"
        />
        <StatCard
          title={t('admin.totalVendors', 'Approved Vendors')}
          value={stats.approvedVendors || stats.totalVendors}
          icon={Store}
          color="primary"
        />
        <StatCard
          title={t('admin.totalProducts', 'Active Products')}
          value={(stats.activeProducts || stats.totalProducts).toLocaleString()}
          icon={Package}
          color="info"
        />
        <StatCard
          title={t('admin.totalProducts', 'Total Products')}
          value={stats.totalProducts.toLocaleString()}
          icon={ShoppingCart}
          color="primary"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Revenue Area Chart */}
        <ChartCard
          title={t('admin.revenueTrend', 'Revenue Trend')}
          subtitle={t('admin.revenueTrendSubtitle', 'Last {{count}} months gross sales', { count: trendData.length })}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                formatter={(val: any) => [`EGP ${Number(val).toLocaleString()}`, 'Revenue']} />
              <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Volume Bar Chart */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">{t('admin.orderVolume', 'Order Volume')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('admin.orderVolumeSubtitle', 'Monthly transaction count')}</p>
          </div>
          <div className="flex-1 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                  {trendData.map((_, i) => (
                    <Cell key={i} fill={i === trendData.length - 1 ? '#0ea5e9' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="pt-3 border-t border-gray-50 flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">{t('admin.monthlyAvg', 'Monthly Avg.')}</span>
            <span className="text-gray-900 font-bold">{t('admin.ordersCount', '{{count}} orders', { count: periodAvgOrders })}</span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Top Vendors + Status Breakdown + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Vendors */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">{t('admin.topVendors', 'Top Vendors')}</h3>
            <Link to="/admin/vendors" className="text-xs text-primary-600 hover:underline font-semibold flex items-center gap-1">
              {t('common.viewAll', 'View all')} <ArrowUpRight size={12} className="rtl:rotate-270" />
            </Link>
          </div>
          <div className="space-y-3">
            {topVendors.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.noVendorData', 'No vendor data yet')}</p>
            ) : (
              topVendors.map((vendor, i) => (
                <div key={vendor.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary-50 text-primary-700 text-xs font-black flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{vendor.storeName}</p>
                    <p className="text-xs text-gray-400">{vendor.orders} orders</p>
                  </div>
                  <span className="text-sm font-bold text-green-600 whitespace-nowrap">
                    EGP {vendor.revenue.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Order Status Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-base font-bold text-gray-900 mb-4">{t('admin.orderStatus', 'Order Status')}</h3>
          {ordersByStatus.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">{t('admin.noOrders', 'No orders yet')}</p>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ordersByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} paddingAngle={3}>
                    {ordersByStatus.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [v, name]} />
                  <Legend formatter={(v) => v} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Orders Feed */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">{t('admin.recentOrders', 'Recent Orders')}</h3>
            <Link to="/admin/orders" className="text-xs text-primary-600 hover:underline font-semibold flex items-center gap-1">
              {t('common.viewAll', 'View all')} <ArrowUpRight size={12} className="rtl:rotate-270" />
            </Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">{t('admin.noOrders', 'No orders yet')}</p>
            ) : (
              recentOrders.slice(0, 6).map((order: any) => (
                <div key={order.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="w-8 h-8 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={14} className="text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{order.user?.name || 'Guest'}</p>
                    <p className="text-[10px] text-gray-400">{order.vendor?.storeName || '—'}</p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-xs font-bold text-gray-900">{t('common.currency', 'EGP')} {order.total?.toLocaleString()}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Empty State */}
      {stats.totalSales === 0 && (
        <EmptyState
          title={t('admin.awaitingActivity', 'Marketplace Awaiting Activity')}
          message={t('admin.awaitingActivityDesc', 'Once vendors register products and customers place orders, your performance metrics will appear here.')}
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

  // Auth guard
  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/admin' } } });
      return;
    }
    if (user?.role !== 'ADMIN') {
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
      // API returns { stats: {...}, revenueTrends, ordersByStatus, topVendors, recentOrders }
      setDashData({
        stats: response.data.stats,
        revenueTrends: response.data.revenueTrends || [],
        ordersByStatus: response.data.ordersByStatus || [],
        topVendors: response.data.topVendors || [],
        recentOrders: response.data.recentOrders || [],
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
    { path: '/admin', name: t('admin.overview', 'Overview'), icon: LayoutDashboard },
    { path: '/admin/users', name: t('admin.users', 'Users'), icon: Users },
    { path: '/admin/vendors', name: t('admin.vendors', 'Vendors'), icon: Briefcase, countKey: 'pendingVendors' },
    { path: '/admin/categories', name: t('admin.categories', 'Categories'), icon: Tag },
    { path: '/admin/brands', name: t('admin.brands', 'Brands'), icon: ShoppingBag },
    { path: '/admin/banners', name: t('admin.banners', 'Banners'), icon: ImageIcon },
    { path: '/admin/orders', name: t('admin.orders', 'Orders'), icon: Package },
    { path: '/admin/reviews', name: t('admin.reviews', 'Reviews'), icon: MessageSquare },
    { path: '/admin/coupons', name: t('admin.coupons', 'Coupons'), icon: Percent },
    { path: '/admin/shipping', name: t('admin.shipping', 'Shipping Rates'), icon: Truck },
    { path: '/admin/announcements', name: t('admin.broadcast', 'Site Broadcast'), icon: Megaphone },
    { path: '/admin/settings', name: t('admin.settings', 'Settings'), icon: Settings },
  ];

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
        <div className="flex-1 p-8"><DashboardSkeleton /></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'ADMIN') {
    return <Navigate to="/login" replace />;
  }

  const sidebarW = sidebarOpen ? 'lg:w-64' : 'lg:w-16';
  const sidebarProps = {
    menuItems,
    location,
    sidebarOpen,
    stats: dashData?.stats ?? null,
    onLogout: handleLogout,
    t,
  };

  return (
    <div className={`min-h-screen bg-gray-50 flex font-sans antialiased ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Sidebar – Desktop */}
      <aside className={`hidden lg:flex flex-col bg-white border-e border-gray-100 shadow-sm flex-shrink-0 transition-all duration-300 ${sidebarW} overflow-hidden`}>
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* Drawer – Mobile */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: isRTL ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: isRTL ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 250 }}
              className="fixed top-0 start-0 h-full w-72 bg-white shadow-2xl z-50 lg:hidden"
            >
              <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
                <span className="text-lg font-black text-gray-900 tracking-tighter">
                  Go<span className="text-primary-600">Knary</span>
                </span>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <SidebarContent {...sidebarProps} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <DashboardTopNav
          sidebarOpen={sidebarOpen}
          toggleSidebar={() => {
            setSidebarOpen(!sidebarOpen);
            setDrawerOpen(!drawerOpen);
          }}
          onLogout={handleLogout}
          userName={user?.name || 'Admin'}
          role="Admin"
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
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="vendors" element={<AdminVendorsPage />} />
            <Route path="vendors/:vendorId/products" element={<AdminVendorProductsPage />} />
            <Route path="categories" element={<AdminCategoriesPage />} />
            <Route path="brands" element={<AdminBrandsPage />} />
            <Route path="banners" element={<AdminBannersPage />} />
            <Route path="orders" element={<AdminOrdersPage />} />
            <Route path="orders/:id" element={<AdminOrderDetailPage />} />
            <Route path="reviews" element={<AdminReviewsPage />} />
            <Route path="coupons" element={<AdminCouponsPage />} />
            <Route path="shipping" element={<AdminShippingPage />} />
            <Route path="announcements" element={<AdminAnnouncementPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
