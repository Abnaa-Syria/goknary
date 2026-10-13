import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiX, FiUser, FiShoppingCart, FiHeart, FiChevronDown } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import { Category } from '../../store/slices/categorySlice';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  isAuthenticated: boolean;
  userName?: string;
}

const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  categories,
  isAuthenticated,
  userName,
}) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();

  // Helper function to get localized category name
  const getCategoryName = (category: Category) => {
    return isRTL && (category as any).nameAr ? (category as any).nameAr : category.name;
  };

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // The API returns the tree: roots with nested children at any depth.
  const topLevelCategories = categories.filter((cat) => !cat.parentId);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLinkClick = () => {
    onClose();
  };

  const renderCategory = (category: Category, depth: number): React.ReactNode => {
    const children = category.children ?? [];
    const isExpanded = expanded.has(category.id);
    return (
      <li key={category.id}>
        <div className="flex items-center">
          <Link
            to={`/category/${category.slug}`}
            onClick={handleLinkClick}
            className={`flex-1 px-3 py-2 rounded-md transition-colors hover:bg-primary-50 hover:text-primary-600 ${
              depth === 0 ? 'text-sm text-gray-700' : 'text-xs text-gray-600'
            }`}
          >
            {getCategoryName(category)}
          </Link>
          {children.length > 0 && (
            <button
              type="button"
              onClick={() => toggleExpanded(category.id)}
              className="p-2 text-gray-400 hover:text-primary-600 rounded-md"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              <FiChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
        {children.length > 0 && isExpanded && (
          <ul className="ms-3 ps-2 border-s border-gray-100 space-y-0.5">
            {children.map((child) => renderCategory(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 sm:w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <Link to="/" onClick={handleLinkClick}>
              <img 
                src="/imgs/WhatsApp_Image_2025-06-01_at_1.44.50_PM-removebg-preview-e1748777559633.webp" 
                alt="GoKnary Logo" 
                className="h-10 w-auto object-contain"
              />
            </Link>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>

          {/* User Section */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            {isAuthenticated ? (
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
                    {userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{userName || 'User'}</p>
                    <p className="text-xs text-gray-500">My Account</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    to="/account"
                    onClick={handleLinkClick}
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors"
                  >
                    <FiUser className="w-4 h-4" />
                    <span>Account</span>
                  </Link>
                  <Link
                    to="/cart"
                    onClick={handleLinkClick}
                    className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors"
                  >
                    <FiShoppingCart className="w-4 h-4" />
                    <span>Cart</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  to="/login"
                  onClick={handleLinkClick}
                  className="block w-full px-4 py-2 bg-primary-500 text-white text-center rounded-lg font-medium hover:bg-primary-600 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={handleLinkClick}
                  className="block w-full px-4 py-2 border-2 border-primary-500 text-primary-500 text-center rounded-lg font-medium hover:bg-primary-50 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Categories</h3>
              <ul className="space-y-1">
                {topLevelCategories.map((category) => renderCategory(category, 0))}
              </ul>
              <Link
                to="/categories"
                onClick={handleLinkClick}
                className="block mt-2 px-3 py-2 text-sm font-medium text-primary-600 hover:underline"
              >
                {isRTL ? 'كل الفئات' : 'All categories'}
              </Link>
            </div>
          </div>

          {/* Footer Links */}
          <div className="p-4 border-t border-gray-200 space-y-2">
            <Link
              to="/account/orders"
              onClick={handleLinkClick}
              className="block text-sm text-gray-700 hover:text-primary-600"
            >
              My Orders
            </Link>
            <Link
              to="/account/addresses"
              onClick={handleLinkClick}
              className="block text-sm text-gray-700 hover:text-primary-600"
            >
              Addresses
            </Link>
            {isAuthenticated && (
              <button
                onClick={() => {
                  handleLinkClick();
                  navigate('/logout');
                }}
                className="block w-full text-left text-sm text-red-500 hover:text-red-600"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileDrawer;

