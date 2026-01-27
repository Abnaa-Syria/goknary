import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchWishlist, removeFromWishlist } from '../store/slices/wishlistSlice';
import { FiTrash, FiHeart } from 'react-icons/fi';
import { formatPrice, calculateDiscountPercentage } from '../lib/utils';
import { SEO } from '../components/common/SEO';
import EmptyState from '../components/common/EmptyState';
import ProductCard from '../components/product/ProductCard';

const WishlistPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, count, loading } = useAppSelector((state) => state.wishlist);
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/wishlist' } } });
      return;
    }
    dispatch(fetchWishlist());
  }, [dispatch, isAuthenticated, navigate]);

  const handleRemove = (itemId: string) => {
    if (window.confirm(t('messages.confirmDelete'))) {
      dispatch(removeFromWishlist(itemId));
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  if (loading && items.length === 0) {
    return (
      <>
        <SEO title={t('common.wishlist')} description={t('common.wishlist')} />
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <div className="text-center">{t('common.loading')}</div>
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <SEO title={t('common.wishlist')} description={t('common.wishlist')} />
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <EmptyState
            icon={<FiHeart className="w-16 h-16 text-gray-400 mx-auto mb-4" />}
            title={t('account.wishlist')}
            message={t('cart.continueShopping')}
            actionLabel={t('cart.continueShopping')}
            actionLink="/"
          />
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title={t('common.wishlist')} description={t('common.wishlist')} />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('nav.myWishlist')}</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              {count} {count === 1 ? t('account.item') : t('account.items')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
          {items.map((item) => (
            <div key={item.id} className="group relative">
              <button
                onClick={() => handleRemove(item.id)}
                className="absolute top-3 end-3 z-10 p-2 bg-white rounded-full shadow-md hover:bg-red-50 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                aria-label={t('product.removeFromWishlist')}
              >
                <FiTrash className="w-5 h-5" />
              </button>
              <ProductCard product={item.product} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default WishlistPage;
