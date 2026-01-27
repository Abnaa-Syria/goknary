import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSearch, FiUser, FiShoppingCart, FiMenu, FiTruck, FiHeart } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';
import { fetchCategories } from '../../store/slices/categorySlice';
import CartBadge from './CartBadge';
import WishlistBadge from './WishlistBadge';
import CompareBadge from './CompareBadge';
import MegaMenu from '../common/MegaMenu';
import MobileDrawer from '../common/MobileDrawer';
import LanguageSwitcher from '../LanguageSwitcher';

// Custom icons for utility bar (using SVG as fallback since these may not be in v4)
const MapPinIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const HeadphonesIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
  </svg>
);

const GiftIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);

// Compare Icon (GitCompare style)
const CompareIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.auth);
  const { categories } = useAppSelector((state) => state.categories);
  const [searchQuery, setSearchQuery] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [showMobileDrawer, setShowMobileDrawer] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);

  const { loading: categoriesLoading } = useAppSelector((state) => state.categories);
  const hasFetchedCategories = useRef(false);
  const hasFetchedUser = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !user && !hasFetchedUser.current) {
      hasFetchedUser.current = true;
      dispatch(getCurrentUser());
    }
    if (!categoriesLoading && categories.length === 0 && !hasFetchedCategories.current) {
      hasFetchedCategories.current = true;
      dispatch(fetchCategories());
    }
  }, [isAuthenticated, user, dispatch, categoriesLoading]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserMenu(false);
      setShowSearchSuggestions(false);
    };
    if (showUserMenu || showSearchSuggestions) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showUserMenu, showSearchSuggestions]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowSearchSuggestions(false);
    }
  };

  const handleSearchClick = () => {
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  // Static search suggestions (UI only - can be enhanced later with real autocomplete)
  const searchSuggestions = categories.slice(0, 5).map((cat) => ({
    text: isRTL && (cat as any).nameAr ? (cat as any).nameAr : cat.name,
    link: `/category/${cat.slug}`,
  }));

  return (
    <>
      <header className="bg-white shadow-sm sticky top-0 z-50 relative">
        {/* Utility Bar - Desktop Only */}
        <div className="hidden lg:block bg-secondary-900 text-white text-xs py-2">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 rtl:space-x-reverse">
                <div className="flex items-center gap-2">
                  <FiTruck className="w-4 h-4" />
                  <span>{t('home.freeShippingDesc')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <GiftIcon />
                  <span>{t('home.easyReturns')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HeadphonesIcon />
                  <span>{t('home.support247')}</span>
                </div>
              </div>
              <div className="flex items-center">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>

        {/* Main Header */}
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between py-3 sm:py-4">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 flex-shrink-0">
              <img 
                src="/imgs/WhatsApp_Image_2025-06-01_at_1.44.50_PM-removebg-preview-e1748777559633.webp" 
                alt="GoKnary Logo" 
                className="h-12 sm:h-14 md:h-16 w-auto object-contain"
              />
            </Link>

            {/* Categories Button + Search Bar - Desktop */}
            <div className="hidden lg:flex flex-1 items-center mx-4 xl:mx-8 max-w-3xl">
              {/* All Categories Button */}
              <div
                className="relative"
                data-categories-button
                onMouseEnter={() => setShowMegaMenu(true)}
              >
                <button
                  className="flex items-center gap-2 px-4 py-2.5 bg-secondary-900 text-white rounded-s-lg hover:bg-secondary-800 transition-colors font-medium text-sm whitespace-nowrap"
                  onClick={() => setShowMegaMenu(!showMegaMenu)}
                >
                  <FiMenu className="w-5 h-5" />
                  <span>{t('common.categories')}</span>
                </button>
              </div>

              {/* Search Bar */}
              <form onSubmit={handleSearch} className="relative flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchSuggestions(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowSearchSuggestions(searchQuery.length > 0)}
                    placeholder={t('common.searchPlaceholder')}
                    className="w-full px-4 py-2.5 pe-12 border border-gray-300 rounded-e-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  />
                  <button
                    type="submit"
                    className="absolute end-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-primary-500 transition-colors"
                  >
                    <FiSearch className="w-5 h-5" />
                  </button>
                </div>

                {/* Search Suggestions Dropdown */}
                {showSearchSuggestions && searchSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-dropdown z-50 max-h-64 overflow-y-auto">
                    {searchSuggestions.map((suggestion, idx) => (
                      <Link
                        key={idx}
                        to={suggestion.link}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        onClick={() => {
                          setShowSearchSuggestions(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center space-x-2">
                          <FiSearch className="w-4 h-4 text-gray-400" />
                          <span>{suggestion.text}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </form>
            </div>

            {/* Right Icons */}
            <div className="flex items-center gap-1 sm:gap-2 md:gap-4 flex-shrink-0">
              {/* Search Icon - Mobile */}
              <button
                onClick={() => navigate('/search')}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Search"
              >
                <FiSearch className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>

              {/* Account - Desktop */}
              <div className="hidden sm:block relative">
                {isAuthenticated ? (
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowUserMenu(!showUserMenu);
                      }}
                      className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <FiUser className="w-5 h-5" />
                      <span className="text-sm font-medium hidden lg:inline">
                        {user?.name?.split(' ')[0] || t('common.account')}
                      </span>
                    </button>
                    {showUserMenu && (
                      <div className="absolute end-0 mt-2 w-56 bg-white rounded-lg shadow-dropdown border border-gray-200 py-2 z-50">
                        <div className="px-4 py-2 border-b border-gray-200">
                          <p className="text-sm font-medium text-gray-900">{user?.name || 'User'}</p>
                          <p className="text-xs text-gray-500">{user?.email}</p>
                        </div>
                        <Link
                          to="/account"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('account.myAccount')}
                        </Link>
                        <Link
                          to="/account/orders"
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                          onClick={() => setShowUserMenu(false)}
                        >
                          {t('nav.myOrders')}
                        </Link>
                        {(user?.role === 'VENDOR' || user?.role === 'ADMIN') && (
                          <>
                            <div className="border-t my-1"></div>
                            {user.role === 'VENDOR' && (
                              <Link
                                to="/vendor"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => setShowUserMenu(false)}
                              >
                                {t('nav.vendorDashboard')}
                              </Link>
                            )}
                            {user.role === 'ADMIN' && (
                              <Link
                                to="/admin"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                onClick={() => setShowUserMenu(false)}
                              >
                                {t('nav.adminDashboard')}
                              </Link>
                            )}
                          </>
                        )}
                        <div className="border-t my-1"></div>
                        <button
                          onClick={() => {
                            setShowUserMenu(false);
                            navigate('/logout');
                          }}
                          className="block w-full text-start px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                        >
                          {t('common.logout')}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link
                    to="/login"
                    className="flex items-center gap-1 px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <FiUser className="w-5 h-5" />
                    <span className="text-sm font-medium hidden lg:inline">{t('common.login')}</span>
                  </Link>
                )}
              </div>

              {/* Wishlist - Only for authenticated users */}
              {isAuthenticated && (
                <Link
                  to="/wishlist"
                  className="relative flex items-center gap-1 px-2 sm:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label={t('common.wishlist')}
                >
                  <FiHeart className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="hidden xl:inline text-sm font-medium">{t('common.wishlist')}</span>
                  <WishlistBadge />
                </Link>
              )}

              {/* Compare */}
              <Link
                to="/compare"
                className="relative flex items-center gap-1 px-2 sm:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Compare products"
              >
                <CompareIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                <CompareBadge />
              </Link>

              {/* Cart */}
              <Link
                to="/cart"
                className="relative flex items-center gap-1 px-2 sm:px-3 py-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label={t('common.cart')}
              >
                <FiShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="hidden xl:inline text-sm font-medium">{t('common.cart')}</span>
                <CartBadge />
              </Link>

              {/* Menu Button - Mobile */}
              <button
                onClick={() => setShowMobileDrawer(true)}
                className="sm:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Open menu"
              >
                <FiMenu className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Mega Menu - Inside header for seamless connection */}
        <MegaMenu
          categories={categories}
          isOpen={showMegaMenu}
          onClose={() => setShowMegaMenu(false)}
        />
      </header>

      {/* Mobile Drawer */}
      <MobileDrawer
        isOpen={showMobileDrawer}
        onClose={() => setShowMobileDrawer(false)}
        categories={categories}
        isAuthenticated={isAuthenticated}
        userName={user?.name}
      />
    </>
  );
};

export default Header;
