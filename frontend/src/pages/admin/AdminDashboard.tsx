import React, { useEffect, useState } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import api from '../../lib/api';
import AdminVendorsPage from './AdminVendorsPage';
import AdminCategoriesPage from './AdminCategoriesPage';
import AdminBrandsPage from './AdminBrandsPage';
import AdminBannersPage from './AdminBannersPage';
import AdminOrdersPage from './AdminOrdersPage';

interface DashboardStats {
  totalUsers: number;
  totalVendors: number;
  pendingVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
}

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/admin' } } });
      return;
    }

    if (user?.role !== 'ADMIN') {
      navigate('/');
      return;
    }

    fetchStats();
  }, [isAuthenticated, user, navigate]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/admin/dashboard');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">{t('admin.dashboard')}</h1>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64">
          <nav className="card p-4 space-y-2">
            <Link
              to="/admin"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.overview')}
            </Link>
            <Link
              to="/admin/vendors"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors relative"
            >
              {t('admin.vendors')}
              {stats.pendingVendors > 0 && (
                <span className="absolute end-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.pendingVendors}
                </span>
              )}
            </Link>
            <Link
              to="/admin/categories"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.categories')}
            </Link>
            <Link
              to="/admin/brands"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.brands')}
            </Link>
            <Link
              to="/admin/banners"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.banners')}
            </Link>
            <Link
              to="/admin/orders"
              className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {t('admin.orders')}
            </Link>
          </nav>
        </aside>

        <main className="flex-1">
          <Routes>
            <Route index element={<AdminDashboardHome stats={stats} />} />
            <Route path="vendors/*" element={<AdminVendorsPage />} />
            <Route path="categories/*" element={<AdminCategoriesPage />} />
            <Route path="brands/*" element={<AdminBrandsPage />} />
            <Route path="banners/*" element={<AdminBannersPage />} />
            <Route path="orders/*" element={<AdminOrdersPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

const AdminDashboardHome: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('admin.overview')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.totalUsers')}</h3>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.totalVendors')}</h3>
          <p className="text-3xl font-bold">{stats.totalVendors}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.pendingVendors')}</h3>
          <p className="text-3xl font-bold text-yellow-600">{stats.pendingVendors}</p>
          {stats.pendingVendors > 0 && (
            <Link
              to="/admin/vendors?status=PENDING"
              className="text-primary-500 text-sm mt-2 hover:underline"
            >
              {t('common.viewAll')} →
            </Link>
          )}
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.totalProducts')}</h3>
          <p className="text-3xl font-bold">{stats.totalProducts}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.totalOrders')}</h3>
          <p className="text-3xl font-bold">{stats.totalOrders}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">{t('admin.totalRevenue')}</h3>
          <p className="text-3xl font-bold">{t('common.currency')} {stats.totalSales.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
