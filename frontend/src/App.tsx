import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import CategoryPage from './pages/CategoryPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import AccountPage from './pages/AccountPage';
import WishlistPage from './pages/WishlistPage';
import ComparePage from './pages/ComparePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import LogoutPage from './pages/LogoutPage';
import SearchPage from './pages/SearchPage';
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
import VendorProducts from './pages/vendor/VendorProducts';
import VendorOrders from './pages/vendor/VendorOrders';

// Admin routes
import AdminDashboard from './pages/admin/AdminDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="category/:slug" element={<CategoryPage />} />
          <Route path="product/:slug" element={<ProductPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="store/:vendorSlug" element={<StorePage />} />

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
          <Route path="register" element={<RegisterPage />} />
          <Route path="logout" element={<LogoutPage />} />
          
          {/* Account Routes */}
          <Route path="account/*" element={<AccountPage />} />
          
          {/* Vendor Routes */}
          <Route path="vendor/*" element={<VendorDashboard />} />
          
          {/* Admin Routes */}
          <Route path="admin/*" element={<AdminDashboard />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;

