import React, { useEffect } from 'react';
import { Routes, Route, Link, Navigate, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { getCurrentUser, logout } from '../store/slices/authSlice';
import ProfilePage from './account/ProfilePage';
import AddressesPage from './account/AddressesPage';
import OrdersPage from './account/OrdersPage';
import OrderDetailsPage from './account/OrderDetailsPage';

const AccountPage: React.FC = () => {
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

  if (loading || !isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Account</h1>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64">
          <div className="card p-4 mb-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary-500 flex items-center justify-center text-white font-bold text-xl">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
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
                  Profile
                </Link>
              </li>
              <li>
                <Link
                  to="/account/addresses"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Addresses
                </Link>
              </li>
              <li>
                <Link
                  to="/account/orders"
                  className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Orders
                </Link>
              </li>
              {user?.role === 'VENDOR' && (
                <li>
                  <Link
                    to="/vendor"
                    className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Vendor Dashboard
                  </Link>
                </li>
              )}
              {user?.role === 'ADMIN' && (
                <li>
                  <Link
                    to="/admin"
                    className="block px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Admin Dashboard
                  </Link>
                </li>
              )}
              <li className="border-t pt-2 mt-2">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1">
          <Routes>
            <Route index element={<ProfilePage />} />
            <Route path="addresses" element={<AddressesPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            <Route path="*" element={<Navigate to="/account" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AccountPage;
