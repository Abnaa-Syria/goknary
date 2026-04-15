import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCompare, removeFromCompare, clearCompare } from '../store/slices/compareSlice';
import { FiTrash, FiX, FiShoppingCart } from 'react-icons/fi';
import { formatPrice, calculateDiscountPercentage } from '../lib/utils';
import { SEO } from '../components/common/SEO';
import EmptyState from '../components/common/EmptyState';
import { addToCart } from '../store/slices/cartSlice';
import { getImageUrl } from '../utils/image';

const ComparePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const { items, count, loading } = useAppSelector((state) => state.compare);

  useEffect(() => {
    dispatch(fetchCompare());
  }, [dispatch]);

  const handleRemove = (itemId: string) => {
    dispatch(removeFromCompare(itemId));
  };

  const handleClearAll = () => {
    if (window.confirm(t('messages.confirmDelete'))) {
      dispatch(clearCompare());
    }
  };

  const handleAddToCart = (productId: string) => {
    dispatch(addToCart({ productId, quantity: 1 }));
  };

  if (loading && items.length === 0) {
    return (
      <>
        <SEO title={t('common.products')} description="Compare products" />
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <div className="text-center">{t('common.loading')}</div>
        </div>
      </>
    );
  }

  if (items.length === 0) {
    return (
      <>
        <SEO title={t('common.products')} description="Compare products" />
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <EmptyState
            title={t('common.noResults')}
            message={t('cart.continueShopping')}
            actionLabel={t('home.shopNow')}
            actionLink="/"
          />
        </div>
      </>
    );
  }

  const maxItems = 4;
  const displayItems = items.slice(0, maxItems);

  return (
    <>
      <SEO title={t('common.products')} description="Compare products" />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('common.products')}</h1>
            <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
              {count} {count === 1 ? t('account.item') : t('account.items')}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={handleClearAll}
              className="px-3 sm:px-4 py-2 text-sm sm:text-base text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
            >
              {t('common.delete')}
            </button>
          )}
        </div>

        <div className="overflow-x-auto -mx-3 sm:mx-0">
          <div className="inline-block min-w-full px-3 sm:px-0">
            <div className="grid gap-3 sm:gap-4" style={{ gridTemplateColumns: `repeat(${displayItems.length + 1}, minmax(240px, 1fr))` }}>
              {/* Header Row - Properties Column */}
              <div className="bg-gray-50 rounded-lg p-4 sticky start-0 z-10">
                <h3 className="font-bold text-gray-900 mb-4">{t('product.description')}</h3>
                <div className="space-y-4 text-sm">
                  <div className="font-medium text-gray-700">{isRTL ? 'الصورة' : 'Image'}</div>
                  <div className="font-medium text-gray-700">{isRTL ? 'الاسم' : 'Name'}</div>
                  <div className="font-medium text-gray-700">{t('product.price')}</div>
                  <div className="font-medium text-gray-700">{t('product.discount')}</div>
                  <div className="font-medium text-gray-700">{t('product.rating')}</div>
                  <div className="font-medium text-gray-700">{t('product.stock')}</div>
                  <div className="font-medium text-gray-700">{t('product.brand')}</div>
                  <div className="font-medium text-gray-700">{t('product.vendor')}</div>
                  <div className="font-medium text-gray-700">{isRTL ? 'الإجراءات' : 'Actions'}</div>
                </div>
              </div>

              {/* Product Columns */}
              {displayItems.map((item) => {
                const discountPercentage = item.product.discountPrice
                  ? calculateDiscountPercentage(item.product.price, item.product.discountPrice)
                  : 0;
                const mainImage = item.product.images?.[0] || '/imgs/default-product.jpg';
                const productName = isRTL && (item.product as any).nameAr ? (item.product as any).nameAr : item.product.name;
                const brandName = item.product.brand 
                  ? (isRTL && (item.product.brand as any).nameAr ? (item.product.brand as any).nameAr : item.product.brand.name)
                  : null;
                const vendorName = isRTL && (item.product.vendor as any).storeNameAr 
                  ? (item.product.vendor as any).storeNameAr 
                  : item.product.vendor.storeName;

                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 relative">
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="absolute top-2 end-2 p-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 rounded-full transition-all"
                      aria-label={t('common.delete')}
                    >
                      <FiX className="w-4 h-4" />
                    </button>

                    <div className="space-y-4">
                      {/* Image */}
                      <Link to={`/product/${item.product.slug}`} className="block">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={getImageUrl(mainImage)}
                            alt={productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </Link>

                      {/* Name */}
                      <Link to={`/product/${item.product.slug}`} className="block">
                        <h3 className="font-semibold text-gray-900 hover:text-primary-600 transition-colors line-clamp-2">
                          {productName}
                        </h3>
                      </Link>

                      {/* Price */}
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-bold text-secondary-900">
                            {formatPrice(item.product.discountPrice || item.product.price)}
                          </span>
                          {item.product.discountPrice && (
                            <span className="text-sm text-gray-400 line-through">
                              {formatPrice(item.product.price)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Discount */}
                      <div>
                        {discountPercentage > 0 ? (
                          <span className="inline-block bg-accent-500 text-white text-xs font-bold px-2 py-1 rounded">
                            -{discountPercentage}%
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">{isRTL ? 'بدون خصم' : 'No discount'}</span>
                        )}
                      </div>

                      {/* Rating */}
                      <div className="flex items-center gap-1">
                        <span className="text-yellow-400">★</span>
                        <span className="text-sm font-semibold">{item.product.ratingAvg.toFixed(1)}</span>
                        <span className="text-xs text-gray-400">({item.product.ratingCount})</span>
                      </div>

                      {/* Stock */}
                      <div>
                        {item.product.stock > 0 ? (
                          <span className="text-sm text-green-600 font-medium">
                            {t('product.inStock')} ({item.product.stock})
                          </span>
                        ) : (
                          <span className="text-sm text-red-600 font-medium">{t('product.outOfStock')}</span>
                        )}
                      </div>

                      {/* Brand */}
                      <div>
                        {brandName ? (
                          <span className="text-sm text-gray-700">{brandName}</span>
                        ) : (
                          <span className="text-sm text-gray-400">N/A</span>
                        )}
                      </div>

                      {/* Vendor */}
                      <div>
                        <Link
                          to={`/store/${item.product.vendor.slug}`}
                          className="text-sm text-primary-600 hover:underline"
                        >
                          {vendorName}
                        </Link>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <Link
                          to={`/product/${item.product.slug}`}
                          className="block w-full text-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
                        >
                          {t('common.view')}
                        </Link>
                        <button
                          onClick={() => handleAddToCart(item.product.id)}
                          disabled={item.product.stock === 0}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                        >
                          <FiShoppingCart className="w-4 h-4" />
                          <span>{t('product.addToCart')}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {items.length >= maxItems && (
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs sm:text-sm text-yellow-800">
              {isRTL 
                ? `يمكن مقارنة ${maxItems} منتجات كحد أقصى. أزل منتجاً لإضافة آخر.`
                : `Maximum ${maxItems} products can be compared at once. Remove a product to add another.`
              }
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default ComparePage;
