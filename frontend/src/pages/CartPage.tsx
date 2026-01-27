import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCart, updateCartItem, removeFromCart } from '../store/slices/cartSlice';
import { FiTrash, FiMinusCircle, FiPlusCircle } from 'react-icons/fi';
import { formatPrice } from '../lib/utils';
import { SEO } from '../components/common/SEO';
import EmptyState from '../components/common/EmptyState';

const CartPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, subtotal, total, itemCount, loading } = useAppSelector((state) => state.cart);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    dispatch(updateCartItem({ itemId, quantity: newQuantity }));
  };

  const handleRemove = (itemId: string) => {
    if (window.confirm(t('messages.confirmDelete'))) {
      dispatch(removeFromCart(itemId));
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <SEO title={t('cart.yourCart')} description={t('cart.emptyCart')} />
        <div className="container mx-auto px-4 py-8">
          <EmptyState
            title={t('cart.emptyCart')}
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
      <SEO title={t('cart.yourCart')} description={t('cart.cartSummary')} />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 lg:mb-8">
        {t('cart.yourCart')} ({itemCount} {itemCount === 1 ? t('product.quantity') : t('common.products')})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => {
            const displayPrice = item.discountPrice || item.price;
            const mainImage = item.product.images?.[0] || '/imgs/default-product.jpg';
            const productName = isRTL && (item.product as any).nameAr ? (item.product as any).nameAr : item.product.name;

            return (
              <div key={item.id} className="card p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  {/* Product Image */}
                  <Link
                    to={`/product/${item.product.slug}`}
                    className="flex-shrink-0 w-full sm:w-28 md:w-32 h-28 sm:h-28 md:h-32 rounded-lg overflow-hidden bg-gray-100"
                  >
                    <img
                      src={mainImage}
                      alt={productName}
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  {/* Product Info */}
                  <div className="flex-grow">
                    <Link to={`/product/${item.product.slug}`} className="block mb-2">
                      <h3 className="font-medium text-lg hover:text-primary-500 transition-colors">
                        {productName}
                      </h3>
                    </Link>
                    <p className="text-sm text-gray-500 mb-2">
                      {t('product.vendor')}:{' '}
                      <Link
                        to={`/store/${item.product.vendor.slug}`}
                        className="text-primary-500 hover:underline"
                      >
                        {isRTL && (item.product.vendor as any).storeNameAr 
                          ? (item.product.vendor as any).storeNameAr 
                          : item.product.vendor.storeName}
                      </Link>
                    </p>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 mb-4">
                      <span className="text-lg font-bold">{formatPrice(displayPrice)}</span>
                      {item.discountPrice && (
                        <span className="text-sm text-gray-400 line-through">
                          {formatPrice(item.price)}
                        </span>
                      )}
                    </div>

                    {/* Quantity Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center border border-gray-300 rounded-lg">
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                          className="p-2 hover:bg-gray-100"
                          disabled={item.quantity <= 1}
                        >
                          <FiMinusCircle className="w-4 h-4" />
                        </button>
                        <span className="px-4 py-2 min-w-[3rem] text-center">{item.quantity}</span>
                        <button
                          onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                          className="p-2 hover:bg-gray-100"
                          disabled={item.quantity >= item.product.stock}
                        >
                          <FiPlusCircle className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-end">
                        <p className="font-bold text-lg">{formatPrice(item.itemTotal)}</p>
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="text-red-500 hover:text-red-700 text-sm mt-1 flex items-center gap-1"
                        >
                          <FiTrash className="w-4 h-4" />
                          <span>{t('cart.removeItem')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="card p-4 sm:p-6 lg:sticky lg:top-4">
            <h2 className="text-xl font-bold mb-4">{t('cart.cartSummary')}</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('cart.subtotal')}</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('cart.shipping')}</span>
                <span className="font-medium">
                  {subtotal >= 500 ? (
                    <span className="text-green-600">{t('cart.freeShipping')}</span>
                  ) : (
                    formatPrice(50)
                  )}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>{t('cart.total')}</span>
                <span>{formatPrice(total + (subtotal >= 500 ? 0 : 50))}</span>
              </div>
            </div>

            <button
              onClick={() => navigate('/checkout')}
              className="w-full btn-primary py-3 text-lg"
            >
              {t('cart.checkout')}
            </button>

            <Link
              to="/"
              className="block text-center text-primary-500 hover:underline mt-4"
            >
              {t('cart.continueShopping')}
            </Link>

            {subtotal < 500 && (
              <p className="text-sm text-gray-500 mt-4 text-center">
                {t('home.freeShippingDesc')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default CartPage;
