import React, { useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getCurrentUser, logout } from '../store/slices/authSlice';
import ProfilePage from './account/ProfilePage';
import AddressesPage from './account/AddressesPage';
import MyOrdersPage from './MyOrdersPage';
import OrderDetailsPage from './account/OrderDetailsPage';
import RefundsPage from './account/RefundsPage';
import TicketsPage from './account/TicketsPage';
import TicketDetailsPage from './account/TicketDetailsPage';

const AccountPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      navigate('/login', { state: { from: { pathname: '/account' } } });
    } else if (!user && isAuthenticated) {
      dispatch(getCurrentUser());
    }
  }, [isAuthenticated, loading, user, dispatch, navigate]);

  const handleLogout = async () => {
    await dispatch(logout());
    navigate('/');
  };

  if (loading || !isAuthenticated || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 print:p-0 print:m-0 print:max-w-none print:w-full">
      <h1 className="text-3xl font-bold mb-8 print:hidden">{t('account.myAccount')}</h1>

      <div className="flex flex-col md:flex-row gap-8 print:gap-0">
        <aside className="w-full md:w-64 print:hidden">
          <div className="card p-4 mb-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xl">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
              <div className="text-start">
                <p className="font-medium">{user?.name || 'User'}</p>
                <p className="text-sm text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="card p-4">
            <ul className="space-y-2">
              <li>
                <Link
                  to="/account"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('account.profile')}
                </Link>
              </li>
              <li>
                <Link
                  to="/account/addresses"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('account.addresses')}
                </Link>
              </li>
              <li>
                <Link
                  to="/account/orders"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('account.orders')}
                </Link>
              </li>
              <li>
                <Link
                  to="/account/refunds"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('account.returnsRefunds')}
                </Link>
              </li>
              <li>
                <Link
                  to="/account/tickets"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {t('account.supportTickets')}
                </Link>
              </li>
              {user?.role === 'VENDOR' && (
                <li>
                  <Link
                    to="/vendor"
                    className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('nav.vendorDashboard')}
                  </Link>
                </li>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'STAFF') && (
                <li>
                  <Link
                    to="/admin"
                    className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    {t('nav.adminDashboard')}
                  </Link>
                </li>
              )}
              <li className="border-t pt-2 mt-2">
                <button
                  onClick={handleLogout}
                  className="block w-full text-start px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  {t('common.logout')}
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1">
          <Routes>
            <Route index element={<ProfilePage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="orders" element={<MyOrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="refunds" element={<RefundsPage />} />
            <Route path="tickets" element={<TicketsPage />} />
            <Route path="tickets/:id" element={<TicketDetailsPage />} />
            <Route path="*" element={<Navigate to="/account" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AccountPage;
