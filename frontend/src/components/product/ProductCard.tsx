import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiStar, FiShoppingCart, FiHeart } from 'react-icons/fi';
import { Product } from '../../store/slices/productSlice';
import { calculateDiscountPercentage, formatPrice } from '../../lib/utils';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { addToWishlist, removeFromWishlistByProductId } from '../../store/slices/wishlistSlice';
import { addToCompare, removeFromCompare } from '../../store/slices/compareSlice';
import { getImageUrl } from '../../utils/image';

interface ProductCardProps {
  product: Product;
}

// Compare Icon (GitCompare style)
const CompareIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { itemIds: wishlistItemIds } = useAppSelector((state) => state.wishlist);
  const { itemIds: compareItemIds, items: compareItems } = useAppSelector((state) => state.compare);

  const isInWishlist = wishlistItemIds.includes(product.id);
  const isInCompare = compareItemIds.includes(product.id);

  // Get localized content
  const productName = isRTL && (product as any).nameAr ? (product as any).nameAr : product.name;
  const brandName = product.brand 
    ? (isRTL && (product.brand as any).nameAr ? (product.brand as any).nameAr : product.brand.name)
    : null;
  const vendorName = isRTL && (product.vendor as any)?.storeNameAr 
    ? (product.vendor as any)?.storeNameAr 
    : product.vendor?.storeName || 'Unknown Vendor';

  const handleWishlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: window.location.pathname } } });
      return;
    }
    if (isInWishlist) {
      dispatch(removeFromWishlistByProductId(product.id));
    } else {
      dispatch(addToWishlist(product.id));
    }
  };

  const handleCompareToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInCompare) {
      const compareItem = compareItems.find((item) => item.product.id === product.id);
      if (compareItem) {
        dispatch(removeFromCompare(compareItem.id));
      }
    } else {
      dispatch(addToCompare(product.id));
    }
  };

  const discountPercentage = product.discountPrice
    ? calculateDiscountPercentage(product.price, product.discountPrice)
    : 0;

  const displayPrice = product.discountPrice || product.price;
  const originalPrice = product.discountPrice ? product.price : null;

  const images = product.images || [];
  const mainImage = getImageUrl(images[0]);
  const hoverImage = images.length > 1 ? getImageUrl(images[1]) : mainImage;

  // Featured products typically have high ratings and sales - using rating as proxy
  const isFeatured = false; // product.featured is not in the Product type yet
  const isBestseller = product.ratingCount > 100 && product.ratingAvg >= 4.5;

  return (
    <div
      className="group relative bg-white rounded-lg overflow-hidden shadow-card hover:shadow-card-hover transition-all duration-300 border border-gray-100"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Badges */}
      <div className="absolute top-3 start-3 z-10 flex flex-col gap-2">
        {discountPercentage > 0 && (
          <span className="bg-accent-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
            -{discountPercentage}%
          </span>
        )}
        {isBestseller && (
          <span className="bg-secondary-900 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
            {t('nav.bestSellers')}
          </span>
        )}
        {isFeatured && !isBestseller && (
          <span className="bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
            {t('product.featured')}
          </span>
        )}
      </div>

      {/* Quick Actions - Show on Hover */}
      <div className="absolute top-3 end-3 z-10 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          className={`p-2 rounded-full shadow-md transition-colors ${
            isInWishlist ? 'bg-primary-500 text-white hover:bg-primary-600' : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-primary-600'
          }`}
          aria-label={isInWishlist ? t('product.removeFromWishlist') : t('product.addToWishlist')}
          onClick={handleWishlistToggle}
        >
          <FiHeart className={`w-4 h-4 ${isInWishlist ? 'fill-current' : ''}`} />
        </button>
        <button
          className={`p-2 rounded-full shadow-md transition-colors ${
            isInCompare ? 'bg-secondary-500 text-white hover:bg-secondary-600' : 'bg-white text-gray-700 hover:bg-gray-50 hover:text-secondary-600'
          }`}
          aria-label="Compare"
          onClick={handleCompareToggle}
        >
          <CompareIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Product Image */}
      <Link to={`/product/${product.slug}`} className="block relative overflow-hidden bg-gray-100 aspect-square">
        <img
          src={imageError ? getImageUrl(null) : (hovered ? hoverImage : mainImage)}
          alt={productName}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          onError={() => setImageError(true)}
        />
        {hovered && (
          <div className="absolute inset-0 bg-black/5"></div>
        )}
      </Link>

      {/* Product Info */}
      <div className="p-4 overflow-hidden">
        {/* Brand Name */}
        {brandName && (
          <p className="text-xs text-gray-500 mb-1 font-medium truncate">{brandName}</p>
        )}

        {/* Product Name */}
        <Link to={`/product/${product.slug}`}>
          <h3 className="font-medium text-sm text-gray-900 line-clamp-2 min-h-[2.5rem] mb-2 group-hover:text-primary-600 transition-colors break-words">
            {productName}
          </h3>
        </Link>

        {/* Rating */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex items-center">
            <FiStar className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-xs text-gray-700 font-medium ms-1">
              {product.ratingAvg.toFixed(1)}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            ({product.ratingCount})
          </span>
        </div>

        {/* Price */}
        <div className="flex flex-col items-start sm:flex-row sm:items-baseline gap-2 mb-2 min-h-[1.75rem]">
          <span className="text-lg font-bold text-secondary-900 truncate">
            {formatPrice(displayPrice)}
          </span>
          {originalPrice && (
            <span className="text-sm text-gray-400 line-through flex-shrink-0 mt-0.5 sm:mt-0">
              {formatPrice(originalPrice)}
            </span>
          )}
        </div>

        {/* Delivery Info */}
        <p className="text-xs text-green-600 mb-3 font-medium">
          ✓ {t('cart.freeShipping')}
        </p>

        {/* Vendor Name */}
        <div className="pt-2 border-top border-t border-gray-100">
          <div className="flex items-center justify-center text-xs text-gray-500 truncate">
            <span className="me-1 whitespace-nowrap">{t('product.vendor')}:</span>
            <Link
              to={`/store/${product.vendor?.slug || ''}`}
              onClick={(e) => e.stopPropagation()}
              className="text-primary-600 hover:underline font-medium truncate"
            >
              {vendorName}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
