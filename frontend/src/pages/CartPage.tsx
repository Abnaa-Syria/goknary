import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCart, updateCartItem, removeFromCart, hasVariantProblem, hasCartItemProblem, getCartItemStock } from '../store/slices/cartSlice';
import VariantSummary from '../components/common/VariantSummary';
import { FiTrash, FiMinusCircle, FiPlusCircle } from 'react-icons/fi';
import { Tag } from 'lucide-react';
import { formatPrice } from '../lib/utils';
import { SEO } from '../components/common/SEO';
import EmptyState from '../components/common/EmptyState';
import RecommendationSection from '../components/product/RecommendationSection';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { IMAGE_PLACEHOLDER, getImageUrl } from '../utils/image';
import { getProductImageAlt, getVariantImageAlt } from '../utils/imageAlt';

const CartPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, subtotal, itemCount, loading } = useAppSelector((state) => state.cart);
  const { freeShippingThreshold } = useAppSelector((state) => state.settings);

  const [promoCode, setPromoCode] = React.useState('');
  const [applyingPromo, setApplyingPromo] = React.useState(false);
  const [appliedPromo, setAppliedPromo] = React.useState<{ code: string; discountAmount: number } | null>(null);

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

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setApplyingPromo(true);
    try {
      const response = await api.post('/coupons/apply', { code: promoCode, cartTotal: subtotal });
      setAppliedPromo({
        code: response.data.code,
        discountAmount: response.data.discountAmount
      });
      toast.success(response.data.message || 'Promo applied successfully!');
      setPromoCode('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid promo code');
    } finally {
      setApplyingPromo(false);
    }
  };

  const hasInvalidItems = items.some(hasCartItemProblem);
  const currentShipping = subtotal >= freeShippingThreshold ? 0 : 50;
  const finalCalculatedTotal = (subtotal - (appliedPromo?.discountAmount || 0)) + currentShipping;

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
              const mainImage = item.variant?.image || item.product.images?.[0] || IMAGE_PLACEHOLDER;
              const productName = isRTL && (item.product as any).nameAr ? (item.product as any).nameAr : item.product.name;
              const maxQuantity = getCartItemStock(item);
              const variantProblem = hasVariantProblem(item);
              const outOfStock = !variantProblem && maxQuantity <= 0;
              const overStock = !variantProblem && !outOfStock && item.quantity > maxQuantity;

              return (
                <div key={item.id} className="card p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* Product Image */}
                    <Link
                      to={`/product/${item.product.slug}`}
                      className="flex-shrink-0 w-full sm:w-28 md:w-32 h-28 sm:h-28 md:h-32 rounded-lg overflow-hidden bg-gray-100"
                    >
                      <img
                        src={getImageUrl(mainImage)}
                        alt={item.variant?.image
                          ? getVariantImageAlt(item.variant, item.product as any, isRTL)
                          : getProductImageAlt(item.product as any, item.product.images?.[0], isRTL)}
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
                      <VariantSummary variant={item.variant} className="text-sm text-gray-600 mb-1" />
                      {item.requiresVariantSelection && (
                        <p className="text-sm text-red-600 mb-2" role="status">
                          {t('variantOptions.cartReselect', 'Please remove this item and add it again after choosing an option.')}
                        </p>
                      )}
                      {item.unavailable && (
                        <p className="text-sm text-red-600 mb-2" role="status">
                          {t('variantOptions.cartUnavailable', 'This option is no longer available. Please remove it from your cart.')}
                        </p>
                      )}
                      {outOfStock && (
                        <p className="text-sm text-red-600 mb-2" role="status">
                          {item.variant
                            ? t('variantOptions.cartOutOfStock', 'This option is currently out of stock. Remove it to continue to checkout.')
                            : t('variantOptions.cartProductOutOfStock', 'This product is currently out of stock. Remove it to continue to checkout.')}
                        </p>
                      )}
                      {overStock && (
                        <p className="text-sm text-amber-700 mb-2" role="status">
                          {t('variantOptions.cartOverStock', 'Only {{count}} available. Reduce the quantity to continue.', { count: maxQuantity })}{' '}
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, maxQuantity)}
                            className="font-semibold underline hover:text-amber-900"
                          >
                            {t('variantOptions.setQuantity', 'Change quantity to {{count}}', { count: maxQuantity })}
                          </button>
                        </p>
                      )}
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
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50"
                            disabled={item.quantity <= 1}
                            aria-label={t('variantOptions.decreaseQuantity', 'Decrease quantity')}
                          >
                            <FiMinusCircle className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 min-w-[3rem] text-center">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-gray-100 disabled:opacity-50"
                            disabled={item.quantity >= maxQuantity || variantProblem}
                            aria-label={t('variantOptions.increaseQuantity', 'Increase quantity')}
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
                    {subtotal >= freeShippingThreshold ? (
                      <span className="text-green-600">{t('cart.freeShipping')}</span>
                    ) : (
                      formatPrice(50)
                    )}
                  </span>
                </div>

                {appliedPromo && (
                  <div className="flex justify-between items-center text-emerald-600 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <span className="font-medium flex items-center gap-2">
                      <Tag size={16} /> Promo: {appliedPromo.code}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">- {formatPrice(appliedPromo.discountAmount)}</span>
                      <button onClick={() => setAppliedPromo(null)} className="text-emerald-700 hover:text-emerald-900">
                        <FiTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t pt-3 flex justify-between text-lg font-bold">
                  <span>{t('cart.total')}</span>
                  <span>{formatPrice(Math.max(0, finalCalculatedTotal))}</span>
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="mb-6 border-t border-gray-100 pt-6 mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Have a promo code?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter code..."
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500 font-mono uppercase"
                    disabled={applyingPromo || !!appliedPromo}
                  />
                  <button
                    onClick={handleApplyPromo}
                    disabled={applyingPromo || !promoCode.trim() || !!appliedPromo}
                    className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors font-medium whitespace-nowrap"
                  >
                    {applyingPromo ? '...' : 'Apply'}
                  </button>
                </div>
              </div>

              {hasInvalidItems && (
                <p className="text-sm text-red-600 mt-6">
                  {isRTL
                    ? 'بعض المنتجات في السلة تحتاج مراجعة قبل إتمام الطلب'
                    : 'Some items in your cart need attention before checkout'}
                </p>
              )}
              <button
                onClick={() => navigate('/checkout', { state: { appliedPromo } })}
                disabled={hasInvalidItems}
                className="w-full btn-primary py-3 text-lg mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('cart.checkout')}
              </button>

              <Link
                to="/"
                className="block text-center text-primary-500 hover:underline mt-4"
              >
                {t('cart.continueShopping')}
              </Link>

              {subtotal < freeShippingThreshold && (
                <p className="text-sm text-gray-500 mt-4 text-center">
                  {t('home.freeShippingDesc', { amount: freeShippingThreshold })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Optional and independent of the cart: hidden while loading or if the request fails */}
        <RecommendationSection
          context="cart"
          cartProductIds={items.map((item) => item.product.id)}
          title={() => t('recommendations.youMayAlsoLike', 'You may also like')}
          className="mt-8 sm:mt-12"
        />
      </div>
    </>
  );
};

export default CartPage;
