import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import api from '../../lib/api';
import VendorProductsPage from './VendorProductsPage';
import VendorProductFormPage from './VendorProductFormPage';
import VendorOrdersPage from './VendorOrdersPage';
import VendorOrderDetailsPage from './VendorOrderDetailsPage';
import VendorAnalyticsPage from './VendorAnalyticsPage';
import VendorApplyPage from './VendorApplyPage';
import VendorSettingsPage from './VendorSettingsPage';

interface Vendor {
  id: string;
  storeName: string;
  slug: string;
  description?: string;
  status: string;
  rating: number;
}

const VendorDashboard: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated: authStatus } = useAppSelector((state) => state.auth);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authStatus) {
      navigate('/login', { state: { from: { pathname: '/vendor' } } });
      return;
    }

    if (user && (user.role === 'VENDOR' || user.role === 'ADMIN')) {
      fetchVendorProfile();
    } else {
      setLoading(false);
    }
  }, [authStatus, user, navigate]);

  const fetchVendorProfile = async () => {
    try {
      const response = await api.get('/vendor/me');
      setVendor(response.data.vendor);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No vendor profile - user needs to apply
        setVendor(null);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  // If user is not vendor/admin, redirect
  if (user && user.role !== 'VENDOR' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  // If no vendor profile and user is not admin, show apply page
  if (!vendor && user?.role !== 'ADMIN') {
    return <VendorApplyPage onApplied={fetchVendorProfile} />;
  }

  // If vendor status is pending
  if (vendor && vendor.status === 'PENDING') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="card p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{t('orders.pending')}</h1>
          <p className="text-gray-600 mb-6">
            {t('messages.updateSuccess')}
          </p>
          <p className="text-sm text-gray-500">{t('auth.storeName')}: {isRTL && (vendor as any).storeNameAr ? (vendor as any).storeNameAr : vendor.storeName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('vendor.dashboard')}</h1>
        {vendor && (
          <p className="text-gray-600 mt-2">
            <span className="font-medium">{isRTL && (vendor as any).storeNameAr ? (vendor as any).storeNameAr : vendor.storeName}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64">
          <nav className="card p-4 space-y-2">
            <Link
              to="/vendor"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('vendor.overview')}
            </Link>
            <Link
              to="/vendor/products"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('vendor.products')}
            </Link>
            <Link
              to="/vendor/orders"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('vendor.orders')}
            </Link>
            <Link
              to="/vendor/analytics"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('vendor.earnings')}
            </Link>
            <Link
              to="/vendor/settings"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('vendor.settings')}
            </Link>
          </nav>
        </aside>

        <main className="flex-1">
          <Routes>
            <Route index element={<VendorDashboardHome vendor={vendor} />} />
            <Route path="products" element={<VendorProductsPage />} />
            <Route path="products/new" element={<VendorProductFormPage />} />
            <Route path="products/:id/edit" element={<VendorProductFormPage />} />
            <Route path="orders" element={<VendorOrdersPage />} />
            <Route path="orders/:id" element={<VendorOrderDetailsPage />} />
            <Route path="analytics" element={<VendorAnalyticsPage />} />
            <Route path="settings" element={<VendorSettingsPage />} />
            <Route path="*" element={<Navigate to="/vendor" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const VendorDashboardHome: React.FC<{ vendor: Vendor | null }> = ({ vendor }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalSales: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [productsRes, ordersRes, analyticsRes] = await Promise.all([
        api.get('/vendor/products?limit=1').catch(() => ({ data: { pagination: { total: 0 } } })),
        api.get('/vendor/orders?limit=1').catch(() => ({ data: { pagination: { total: 0 } } })),
        api.get('/vendor/analytics?period=30').catch(() => ({ data: { summary: { totalSales: 0 } } })),
      ]);

      setStats({
        totalProducts: productsRes.data?.pagination?.total || 0,
        totalOrders: ordersRes.data?.pagination?.total || 0,
        totalSales: analyticsRes.data?.summary?.totalSales || 0,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      setStats({ totalProducts: 0, totalOrders: 0, totalSales: 0 });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('vendor.overview')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('vendor.totalProducts')}</h3>
          <p className="text-3xl font-bold">{stats.totalProducts}</p>
          <Link to="/vendor/products" className="text-primary-500 text-sm mt-2 hover:underline">
            {t('vendor.products')} →
          </Link>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('vendor.totalOrders')}</h3>
          <p className="text-3xl font-bold">{stats.totalOrders}</p>
          <Link to="/vendor/orders" className="text-primary-500 text-sm mt-2 hover:underline">
            {t('vendor.orders')} →
          </Link>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('vendor.totalSales')}</h3>
          <p className="text-3xl font-bold">{t('common.currency')} {stats.totalSales.toFixed(2)}</p>
          <Link to="/vendor/analytics" className="text-primary-500 text-sm mt-2 hover:underline">
            {t('vendor.earnings')} →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;
