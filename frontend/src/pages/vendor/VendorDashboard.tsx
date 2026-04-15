import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  LayoutDashboard, ShoppingBag, Package, Settings, BarChart2,
  LogOut, DollarSign, Plus, Store, Clock, ArrowUpRight, X,
  RefreshCw, TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { mapEnum, orderStatusMap } from '../../utils/localization';
import VendorProductsPage from './VendorProductsPage';
import VendorProductFormPage from './VendorProductFormPage';
import VendorOrdersPage from './VendorOrdersPage';
import VendorOrderDetailsPage from './VendorOrderDetailsPage';
import VendorAnalyticsPage from './VendorAnalyticsPage';
import VendorApplyPage from './VendorApplyPage';
import VendorSettingsPage from './VendorSettingsPage';

import {
  StatCard, ChartCard, DashboardSkeleton, EmptyState, DashboardTopNav
} from '../admin/DashboardComponents';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorStats {
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  pendingOrders: number;
}

interface SalesByDay {
  name: string;   // formatted for chart (e.g. "Apr 5")
  revenue: number;
  orders: number;
}

interface TopProduct {
  product: { name: string | null; slug: string | null };
  quantitySold: number;
}

interface VendorDashData {
  stats: VendorStats;
  revenueTrends: SalesByDay[];
  topProducts: TopProduct[];
  recentOrders: any[];
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
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colors[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {mapEnum(orderStatusMap, status)}
    </span>
  );
};

// ─── Sidebar Content ──────────────────────────────────────────────────────────

const SidebarContent: React.FC<{
  menuItems: any[];
  location: any;
  sidebarOpen: boolean;
  onLogout: () => void;
  t: any;
}> = ({ menuItems, location, sidebarOpen, onLogout, t }) => {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!sidebarOpen && (
        <div className="h-16 flex items-center justify-center border-b border-gray-50">
          <Store size={22} className="text-purple-600" />
        </div>
      )}

      {sidebarOpen && (
        <div className="h-16 hidden lg:flex items-center px-6 border-b border-gray-50 gap-2">
          <span className="text-xl font-black text-gray-900 uppercase tracking-tighter">
            Go<span className="text-purple-600">Knary</span>
          </span>
          <span className="text-[9px] font-bold bg-purple-100 text-purple-700 rounded-full px-2 py-0.5 uppercase tracking-widest">
            Vendor
          </span>
        </div>
      )}

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path || (item.path !== '/vendor' && location.pathname.startsWith(item.path));

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${
                isActive
                  ? 'bg-purple-50 text-purple-600 font-bold'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-purple-600' : 'text-gray-400 group-hover:text-gray-900'} />
              {sidebarOpen && (
                <span className="text-sm whitespace-nowrap overflow-hidden transition-all duration-300">{item.name}</span>
              )}

              {isActive && (
                <motion.div
                  layoutId="vendorActiveNav"
                  className="absolute start-0 w-1 h-6 bg-purple-600 rounded-full"
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

      <div className="p-4 mt-auto border-t border-gray-50">
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

// ─── VendorDashboardHome ──────────────────────────────────────────────────────

const VendorDashboardHome: React.FC<{
  data: VendorDashData | null;
  onRefresh: () => void;
  refreshing: boolean;
  vendorName: string;
}> = ({ data, onRefresh, refreshing, vendorName }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const trendData = useMemo(
    () => (data?.revenueTrends || []),
    [data]
  );

  if (!data) return <DashboardSkeleton />;

  const { stats, topProducts = [], recentOrders = [] } = data;
  const avgOrderValue = stats.totalOrders > 0 ? Math.round(stats.totalSales / stats.totalOrders) : 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('vendor.overview', 'Store Overview')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Welcome back, <span className="font-semibold text-purple-600">{vendorName}</span> — tracking your store performance.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/vendor/products/new')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-all shadow-md shadow-purple-200"
          >
            <Plus size={16} />
            {t('vendor.addProduct', 'Add Product')}
          </button>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Pending orders alert */}
      {stats.pendingOrders > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl"
        >
          <Clock size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-800 font-semibold">
            You have <span className="font-black">{stats.pendingOrders}</span> pending orders awaiting action.
          </p>
          <Link to="/vendor/orders" className="ms-auto flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline whitespace-nowrap">
            Review <ArrowUpRight size={14} />
          </Link>
        </motion.div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title={t('vendor.totalSales', 'Total Sales')}
          value={formatPrice(stats.totalSales)}
          icon={DollarSign}
          trend={{ value: 12.4, isPositive: true }}
          color="success"
        />
        <StatCard
          title={t('vendor.totalOrders', 'Total Orders')}
          value={stats.totalOrders}
          icon={ShoppingBag}
          trend={{ value: 4.8, isPositive: true }}
          color="primary"
        />
        <StatCard
          title={t('vendor.avgOrderValue', 'Avg. Order Value')}
          value={formatPrice(avgOrderValue)}
          icon={TrendingUp}
          color="info"
        />
        <StatCard
          title={t('vendor.totalProducts', 'Products')}
          value={stats.totalProducts}
          icon={Package}
          color="info"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Revenue Chart */}
        <ChartCard title="Revenue Growth" subtitle="Daily sales (last 30 days)">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="vendorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                formatter={(val: any) => [formatPrice(Number(val)), t('vendor.revenue', 'Revenue')]} />
              <Area type="monotone" dataKey="revenue" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#vendorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Order Volume */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Order Volume</h3>
            <p className="text-xs text-gray-500 mt-0.5">Daily orders placed</p>
          </div>
          <div className="flex-1 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                  {trendData.map((_ : any, i: number  ) => (
                    <Cell key={i} fill={i === trendData.length - 1 ? '#a855f7' : '#e2e8f0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Top Products + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">{t('vendor.topProducts', 'Top Products (30d)')}</h3>
            <Link to="/vendor/products" className="text-xs text-purple-600 hover:underline font-semibold flex items-center gap-1">
              {t('vendor.allProducts', 'All products')} <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {topProducts.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No sales data yet. Add and promote your products!</p>
            ) : (
              topProducts.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 text-xs font-black flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{item.product?.name || '—'}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-700 whitespace-nowrap">
                    {item.quantitySold} {t('vendor.sold', 'sold')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-gray-900">{t('vendor.recentOrders', 'Recent Orders')}</h3>
            <Link to="/vendor/orders" className="text-xs text-purple-600 hover:underline font-semibold flex items-center gap-1">
              {t('common.viewAll', 'View all')} <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-3">
            {recentOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">{t('vendor.noOrdersReceived', 'No orders received yet. Share your store to get started!')}</p>
            ) : (
              recentOrders.slice(0, 5).map((order: any) => (
                <Link
                  key={order.id}
                  to={`/vendor/orders/${order.id}`}
                  className="flex items-center gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="w-8 h-8 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={14} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">#{order.id.slice(-8)}</p>
                    <p className="text-[10px] text-gray-400">{order.user?.name || 'Customer'}</p>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <p className="text-xs font-bold text-gray-900">{formatPrice(order.total)}</p>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {stats.totalSales === 0 && stats.totalOrders === 0 && (
        <EmptyState
          title="Your Store Awaits First Orders"
          message="Add products and share your store link to start receiving orders. Performance metrics will appear here."
        />
      )}
    </div>
  );
};

// ─── Root VendorDashboard ─────────────────────────────────────────────────────

const VendorDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInitialized } = useAppSelector((state) => state.auth);

  const [dashData, setDashData] = useState<VendorDashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [vendorInfo, setVendorInfo] = useState<{ storeName: string; status: string } | null>(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/vendor' } } });
      return;
    }
    if (user?.role !== 'VENDOR' && user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    fetchVendorData();
  }, [isAuthenticated, isInitialized, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchVendorData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [productsRes, ordersRes, analyticsRes, vendorRes] = await Promise.all([
        api.get('/vendor/products?limit=1').catch(() => ({ data: { pagination: { total: 0 } } })),
        api.get('/vendor/orders?limit=10').catch(() => ({ data: { orders: [], pagination: { total: 0 } } })),
        api.get('/vendor/analytics?period=30').catch(() => ({ data: { summary: {}, salesByDay: [] } })),
        api.get('/vendor/me').catch(() => ({ data: null })),
      ]);

      const summary = analyticsRes.data?.summary || {};
      const salesByDay: any[] = analyticsRes.data?.salesByDay || [];
      const topProducts: TopProduct[] = analyticsRes.data?.topProducts || [];

      // Map salesByDay → chart format (use last 14 days to avoid overcrowding)
      const last14 = salesByDay.slice(-14);
      const revenueTrends: SalesByDay[] = last14.map((d: any) => ({
        name: new Date(d.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
        revenue: Math.round(d.sales || 0),
        orders: d.orders || 0,
      }));

      // Count pending orders
      const allOrders: any[] = ordersRes.data?.orders || [];
      const pendingOrders = allOrders.filter((o: any) => o.status === 'PENDING').length;

      if (vendorRes.data) {
        setVendorInfo({ storeName: vendorRes.data.storeName, status: vendorRes.data.status });
      }

      setDashData({
        stats: {
          totalProducts: productsRes.data?.pagination?.total || 0,
          totalOrders: ordersRes.data?.pagination?.total || 0,
          totalSales: summary.totalSales || 0,
          pendingOrders,
        },
        revenueTrends,
        topProducts,
        recentOrders: allOrders.slice(0, 10),
      });
    } catch (error) {
      console.error('Failed to fetch vendor stats:', error);
      toast.error(t('vendor.dashboard.failedAnalytics', 'Failed to load store analytics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => fetchVendorData(true);

  const handleLogout = async () => {
    try {
      await dispatch(logout()).unwrap();
      toast.success(t('common.logoutSuccess', 'Logged out successfully'));
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const menuItems = [
    { path: '/vendor', name: t('vendor.overview', 'Overview'), icon: LayoutDashboard },
    { path: '/vendor/products', name: t('vendor.products', 'Products'), icon: Package },
    { path: '/vendor/orders', name: t('vendor.orders', 'Orders'), icon: ShoppingBag },
    { path: '/vendor/analytics', name: t('vendor.analytics', 'Analytics'), icon: BarChart2 },
    { path: '/vendor/settings', name: t('vendor.settings', 'Settings'), icon: Settings },
  ];

  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex">
        <div className="w-64 bg-white border-r border-gray-100 animate-pulse" />
        <div className="flex-1 p-8"><DashboardSkeleton /></div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'VENDOR' && user?.role !== 'ADMIN')) {
    return <Navigate to="/login" replace />;
  }

  // If vendor status is not APPROVED, show apply page info
  if (vendorInfo && vendorInfo.status === 'PENDING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-yellow-200 p-8 text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-yellow-50 flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-yellow-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('vendor.dashboard.reviewTitle', 'Application Under Review')}</h2>
          <p className="text-gray-500 text-sm mb-6">
            {t('vendor.dashboard.reviewMessage', "Your vendor application is being reviewed by our team. You'll receive an email once it's approved. This process typically takes 1-2 business days.")}
          </p>
          <button onClick={handleLogout} className="w-full py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition-colors">
            {t('common.logout', 'Sign Out')}
          </button>
        </div>
      </div>
    );
  }

  const sidebarW = sidebarOpen ? 'lg:w-64' : 'lg:w-16';
  const sidebarProps = { menuItems, location, sidebarOpen, onLogout: handleLogout, t };

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
                  Go<span className="text-purple-600">Knary</span>
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
          userName={user?.name || vendorInfo?.storeName || 'Vendor'}
          role="Vendor"
        />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Routes>
            <Route
              index
              element={
                <VendorDashboardHome
                  data={dashData}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                  vendorName={vendorInfo?.storeName || user?.name || 'Vendor'}
                />
              }
            />
            <Route path="products" element={<VendorProductsPage />} />
            <Route path="products/new" element={<VendorProductFormPage />} />
            <Route path="products/:id/edit" element={<VendorProductFormPage />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="orders/:id" element={<VendorOrderDetailsPage />} />
            <Route path="analytics" element={<VendorAnalyticsPage />} />
            <Route path="apply" element={<VendorApplyPage />} />
            <Route path="settings" element={<VendorSettingsPage />} />
            <Route path="*" element={<Navigate to="/vendor" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default VendorDashboard;
