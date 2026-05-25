import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { getCurrentUser } from './store/slices/authSlice';
import { fetchPublicSettings } from './store/slices/settingsSlice';
import { useTranslation } from 'react-i18next';
import Layout from './components/layout/Layout';
import ProtectedRoute from './components/routing/ProtectedRoute';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AccountPage from './pages/AccountPage';
import WishlistPage from './pages/WishlistPage';
import ComparePage from './pages/ComparePage';
import AddressesPage from './pages/account/AddressesPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import LogoutPage from './pages/LogoutPage';
import SearchPage from './pages/SearchPage';
import PaymentSuccess from './pages/PaymentSuccess';
import ShopPage from './pages/ShopPage';
import StorePage from './pages/StorePage';
import SupportContactPage from './pages/SupportContactPage';
import FAQPage from './pages/FAQPage';
import ShippingInfoPage from './pages/ShippingInfoPage';
import ReturnsPolicyPage from './pages/ReturnsPolicyPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsConditionsPage from './pages/TermsConditionsPage';
import CookiePolicyPage from './pages/CookiePolicyPage';

// Vendor routes
import VendorDashboard from './pages/vendor/VendorDashboard';
import VendorApplyPage from './pages/vendor/VendorApplyPage';

import { Toaster } from 'react-hot-toast';

// Admin routes
import AdminDashboard from './pages/admin/AdminDashboard';

/**
 * Access Guard: Prevents Vendors from accessing the public homepage/marketplace.
 * Admins are permitted to view the site for quality control.
 */
const VendorLockdown: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  
  if (isAuthenticated && user?.role === 'VENDOR') {
    return <Navigate to="/vendor" replace />;
  }
  
  return <>{children}</>;
};

function App() {
  const dispatch = useAppDispatch();
  const { i18n } = useTranslation();

  useEffect(() => {
    dispatch(fetchPublicSettings()).catch(() => {});
    const token = localStorage.getItem('accessToken');
    if (token) {
      dispatch(getCurrentUser()).catch(() => {});
    }
  }, [dispatch]);

  // Enterprise Localization Sync: Ensure DOM attributes reflect i18n state on mount/change
  useEffect(() => {
    const currentLang = i18n.language || 'en';
    document.documentElement.dir = currentLang.startsWith('ar') ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
  }, [i18n.language]);

  return (
    <Router>
      <Toaster position="top-center" reverseOrder={false} />
      <Routes>
        {/* Public Routes with Vendor Lockdown */}
        <Route path="/" element={<VendorLockdown><Layout /></VendorLockdown>}>
          <Route index element={<HomePage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="addresses" element={<AddressesPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="store/:vendorSlug" element={<StorePage />} />
          <Route path="payment-success" element={<PaymentSuccess />} />

          {/* Static / Info Pages */}
          <Route path="support/contact" element={<SupportContactPage />} />
          <Route path="support/faq" element={<FAQPage />} />
          <Route path="support/shipping" element={<ShippingInfoPage />} />
          <Route path="support/returns" element={<ReturnsPolicyPage />} />

          <Route path="legal/privacy" element={<PrivacyPolicyPage />} />
          <Route path="legal/terms" element={<TermsConditionsPage />} />
          <Route path="legal/cookies" element={<CookiePolicyPage />} />
          
          {/* Auth Routes */}
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="logout" element={<LogoutPage />} />
          
          <Route path="become-vendor" element={<VendorApplyPage />} />
          
          {/* Account Routes */}
          <Route path="account/*" element={<AccountPage />} />
        </Route>

        {/* Dedicated Dashboard Routes (No public Header/Footer) */}
        <Route path="vendor/*" element={
          <ProtectedRoute allowedRoles={['VENDOR']}>
            <VendorDashboard />
          </ProtectedRoute>
        } />
        <Route path="admin/*" element={
          <ProtectedRoute allowedRoles={['ADMIN', 'STAFF']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;

