import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProductBySlug, clearProduct } from '../store/slices/productSlice';
import { addToCart } from '../store/slices/cartSlice';
import { addToWishlist, removeFromWishlistByProductId, fetchWishlist } from '../store/slices/wishlistSlice';
import { addToCompare, removeFromCompare, fetchCompare } from '../store/slices/compareSlice';
import { FiStar, FiShoppingCart, FiHeart, FiTruck, FiShield, FiCheck, FiMinusCircle, FiPlusCircle } from 'react-icons/fi';
import { calculateDiscountPercentage, formatPrice } from '../lib/utils';
import ProductCard from '../components/product/ProductCard';
import { SEO } from '../components/common/SEO';
import Breadcrumbs from '../components/common/Breadcrumbs';
import api from '../lib/api';
import { getImageUrl } from '../utils/image';

// Compare Icon (GitCompare style)
const CompareIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const ProductPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { product, similarProducts, loading } = useAppSelector((state) => state.products);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { itemIds: wishlistItemIds } = useAppSelector((state) => state.wishlist);
  const { itemIds: compareItemIds, items: compareItems } = useAppSelector((state) => state.compare);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [imageZoom, setImageZoom] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  
  // Phase 4 Cross-Selling state
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const isInWishlist = product ? wishlistItemIds.includes(product.id) : false;
  const isInCompare = product ? compareItemIds.includes(product.id) : false;

  // Helpers for localized names
  const getProductName = (p: any | null | undefined) => {
    if (!p) return '';
    return isRTL && p.nameAr ? p.nameAr : p.name;
  };

  const getCategoryName = (c: any | null | undefined) => {
    if (!c) return isRTL ? t('category.defaultName', 'الفئة') : t('category.defaultName', 'Category');
    return isRTL && c.nameAr ? c.nameAr : c.name;
  };

  const getBrandName = (b: any | null | undefined) => {
    if (!b) return '';
    return isRTL && b.nameAr ? b.nameAr : b.name;
  };

  const getVendorName = (v: any | null | undefined) => {
    if (!v) return '';
    return isRTL && v.storeNameAr ? v.storeNameAr : v.storeName;
  };

  useEffect(() => {
    if (slug) {
      dispatch(fetchProductBySlug(slug));
    }
    if (isAuthenticated) {
      dispatch(fetchWishlist());
    }
    dispatch(fetchCompare());
    return () => {
      dispatch(clearProduct());
    };
  }, [slug, dispatch, isAuthenticated]);

  // Select default variant when product loads
  useEffect(() => {
    if (product?.variants && product.variants.length > 0) {
      const defaultVariant = product.variants.find((v: any) => v.isDefault) || product.variants[0];
      setSelectedVariant(defaultVariant);
    } else {
      setSelectedVariant(null);
    }
  }, [product]);

  // Fetch product reviews & related products
  useEffect(() => {
    const fetchMatrixData = async () => {
      if (!slug) return;
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const [reviewsRes, relatedRes] = await Promise.all([
          api.get(`/products/${slug}/reviews`, { params: { page: 1, limit: 10 } }),
          api.get(`/products/${slug}/related`)
        ]);
        setReviews(reviewsRes.data.reviews || []);
        setRelatedProducts(relatedRes.data.products || []);
      } catch (err: any) {
        console.error('Failed to load matrix data:', err);
        setReviewsError(err.response?.data?.error || 'Failed to load reviews');
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchMatrixData();
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('common.noResults')}</h1>
          <Link to="/" className="text-primary-500 hover:underline">
            {t('common.back')}
          </Link>
        </div>
      </div>
    );
  }

  // Use variant price/stock if selected, otherwise use product defaults
  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const currentDiscountPrice = selectedVariant ? selectedVariant.discountPrice : product.discountPrice;
  const currentStock = selectedVariant ? selectedVariant.stock : product.stock;

  const discountPercentage = currentDiscountPrice
    ? calculateDiscountPercentage(currentPrice, currentDiscountPrice)
    : 0;

  const displayPrice = currentDiscountPrice || currentPrice;
  const originalPrice = currentDiscountPrice ? currentPrice : null;
  const images = product.images || [];
  const mainImage = selectedVariant?.image || images[selectedImageIndex] || images[0] || '/imgs/default-product.jpg';

  const breadcrumbItems = [
    {
      label: getCategoryName(product.category),
      to: product.category ? `/category/${product.category.slug}` : undefined,
    },
    { label: getProductName(product) },
  ];

  const handleAddToCart = async () => {
    if (!product) return;
    
    try {
      await dispatch(addToCart({ productId: product.id, quantity })).unwrap();
      // Show success feedback
      alert('Item added to cart!');
    } catch (error: any) {
      alert(error || 'Failed to add item to cart');
    }
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    navigate('/checkout');
  };

  const handleWishlistToggle = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: window.location.pathname } } });
      return;
    }
    try {
      if (isInWishlist) {
        await dispatch(removeFromWishlistByProductId(product.id)).unwrap();
      } else {
        await dispatch(addToWishlist(product.id)).unwrap();
      }
    } catch (error: any) {
      alert(error || 'Failed to update wishlist');
    }
  };

  const handleCompareToggle = async () => {
    if (!product) return;
    try {
      if (isInCompare) {
        const compareItem = compareItems.find((item) => item.product.id === product.id);
        if (compareItem) {
          await dispatch(removeFromCompare(compareItem.id)).unwrap();
        }
      } else {
        await dispatch(addToCompare(product.id)).unwrap();
      }
    } catch (error: any) {
      alert(error || 'Failed to update compare list');
    }
  };

  const handleSubmitReview = async () => {
    if (!slug || !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: window.location.pathname } } });
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      alert('Please select a rating between 1 and 5');
      return;
    }

    setSubmittingReview(true);
    try {
      const response = await api.post(`/products/${slug}/reviews`, {
        rating: reviewRating,
        title: reviewTitle.trim() || null,
        comment: reviewComment.trim() || null,
      });

      // Add new review to the list
      setReviews([response.data.review, ...reviews]);
      
      // Reset form
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      setShowReviewForm(false);
      
      // Refresh product to update rating
      if (slug) {
        dispatch(fetchProductBySlug(slug));
      }

      alert('Review submitted successfully!');
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      alert(error.response?.data?.error || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <>
      <SEO
        title={getProductName(product)}
        description={
          product.description ||
          product.descriptionAr ||
          (isRTL
            ? `اشتري ${getProductName(product)} من GoKnary`
            : `Buy ${getProductName(product)} on GoKnary`)
        }
        keywords={`${getProductName(product)}, ${getCategoryName(product.category)}, ${getBrandName(product.brand)}`}
      />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <Breadcrumbs items={breadcrumbItems} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-12 mb-8 sm:mb-12 lg:mb-16">
          {/* Image Gallery */}
          <div className="relative">
            {/* Main Image */}
            <div 
              className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group cursor-zoom-in"
              onMouseEnter={() => setImageZoom(true)}
              onMouseLeave={() => setImageZoom(false)}
            >
              <img
                src={getImageUrl(mainImage)}
                alt={product.name}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  imageZoom ? 'scale-150' : 'scale-100'
                }`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/imgs/default-product.jpg';
                }}
              />
              {discountPercentage > 0 && (
                <span className="absolute top-4 left-4 bg-accent-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg z-10">
                  -{discountPercentage}% OFF
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
                {images.slice(0, 5).map((img, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      selectedImageIndex === index
                        ? 'border-primary-500 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <img
                      src={getImageUrl(img)}
                      alt={`${product.name} ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {/* Brand & Category */}
            <div className="mb-4">
              {product.brand && (
                <Link
                  to={`/category/${product.category?.slug}`}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  {getBrandName(product.brand)}
                </Link>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">
                {getProductName(product)}
              </h1>
              
              {/* Rating */}
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex items-center space-x-1">
                  <FiStar className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold text-gray-900">{product.ratingAvg.toFixed(1)}</span>
                </div>
                <span className="text-gray-500">
                  {isRTL
                    ? `(${product.ratingCount} تقييم)`
                    : `(${product.ratingCount} reviews)`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const el = document.getElementById('reviews');
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium underline"
                >
                  {isRTL ? 'عرض كل التقييمات' : 'See all reviews'}
                </button>
              </div>
            </div>

            {/* Variants Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {isRTL ? 'اختر خياراً:' : 'Select Option:'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant: any) => (
                    <button
                      key={variant.id}
                      onClick={() => setSelectedVariant(variant)}
                      disabled={!variant.status || variant.stock === 0}
                      className={`px-4 py-2 border-2 rounded-lg transition-all text-sm font-medium ${
                        selectedVariant?.id === variant.id
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : variant.stock === 0 || !variant.status
                          ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                          : 'border-gray-200 hover:border-gray-300 text-gray-700'
                      }`}
                    >
                      {isRTL && variant.nameAr ? variant.nameAr : variant.name}
                      {variant.stock === 0 && (
                        <span className={`${isRTL ? 'mr-1' : 'ml-1'} text-xs`}>
                          {isRTL ? 'غير متوفر' : '(Out of stock)'}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                {selectedVariant && (
                  <div className="mt-2 text-xs text-gray-500">
                    {selectedVariant.attributes?.map((attr: any, idx: number) => (
                      <span key={idx} className="inline-block bg-gray-100 px-2 py-0.5 rounded mr-1">
                        {isRTL && attr.nameAr ? attr.nameAr : attr.name}
                        {': '}
                        {isRTL && attr.valueAr ? attr.valueAr : attr.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Price Block */}
            <div className="mb-6 p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-primary-50 rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-4">
                <span className="text-3xl sm:text-4xl font-bold text-secondary-900">
                  {formatPrice(displayPrice)}
                </span>
                {originalPrice && (
                  <>
                    <span className="text-xl sm:text-2xl text-gray-400 line-through">
                      {formatPrice(originalPrice)}
                    </span>
                    <span className="bg-green-500 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded-lg">
                      {isRTL ? 'توفّر ' : 'Save '}
                      {formatPrice(originalPrice - displayPrice)}
                    </span>
                  </>
                )}
              </div>
              {currentStock > 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                  <FiCheck className="w-4 h-4" />
                  <span>
                    {t('product.inStock')} ({currentStock})
                  </span>
                </div>
              ) : (
                <div className="text-red-600 text-sm font-medium">{t('product.outOfStock')}</div>
              )}
            </div>

            {/* Quantity & Actions */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-6">
                <label className="text-sm font-medium text-gray-700">{t('product.quantity')}:</label>
                <div className="flex items-center space-x-2 border border-gray-300 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-l-lg"
                    aria-label={isRTL ? 'تقليل الكمية' : 'Decrease quantity'}
                  >
                    <FiMinusCircle className="w-5 h-5" />
                  </button>
                  <span className="px-4 py-2 text-lg font-medium min-w-[3rem] text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                    disabled={quantity >= currentStock}
                    className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-r-lg"
                    aria-label={isRTL ? 'زيادة الكمية' : 'Increase quantity'}
                  >
                    <FiPlusCircle className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleAddToCart}
                  disabled={currentStock === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-500 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg text-sm"
                >
                  <FiShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{t('product.addToCart')}</span>
                </button>
                <button
                  onClick={handleBuyNow}
                  disabled={currentStock === 0}
                  className="flex-1 flex items-center justify-center gap-2 bg-secondary-900 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-md hover:bg-secondary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg text-sm"
                >
                  <span>{t('product.buyNow')}</span>
                </button>
                <div className="flex gap-2 sm:gap-3">
                  <button
                    onClick={handleWishlistToggle}
                    className={`p-3 sm:p-4 border-2 rounded-lg transition-colors flex-shrink-0 ${
                      isInWishlist ? 'border-primary-500 bg-primary-50 text-primary-600 hover:bg-primary-100' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-label={
                      isInWishlist
                        ? isRTL
                          ? 'إزالة من المفضلة'
                          : 'Remove from wishlist'
                        : isRTL
                          ? 'إضافة إلى المفضلة'
                          : 'Add to wishlist'
                    }
                  >
                    <FiHeart className={`w-4 h-4 sm:w-5 sm:h-5 ${isInWishlist ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={handleCompareToggle}
                    className={`p-3 sm:p-4 border-2 rounded-lg transition-colors flex-shrink-0 ${
                      isInCompare ? 'border-secondary-500 bg-secondary-50 text-secondary-600 hover:bg-secondary-100' : 'border-gray-300 hover:bg-gray-50'
                    }`}
                    aria-label={
                      isInCompare
                        ? isRTL
                          ? 'إزالة من المقارنة'
                          : 'Remove from compare'
                        : isRTL
                          ? 'إضافة إلى المقارنة'
                          : 'Add to compare'
                    }
                  >
                    <CompareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Delivery & Services Info */}
            <div className="space-y-4 mb-8 p-4 sm:p-6 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-start space-x-3">
                <FiTruck className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {isRTL ? 'توصيل مجاني' : 'Free Delivery'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {isRTL
                      ? 'على الطلبات التي تزيد عن 500 جنيه. التسليم عادة خلال ٢–٥ أيام.'
                      : 'On orders over EGP 500. Usually delivered within 2-5 days.'}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FiShield className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {isRTL ? 'إرجاع سهل' : 'Easy Returns'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {isRTL
                      ? 'سياسة استرجاع خلال 14 يوماً بدون أسئلة.'
                      : '14-day return policy. No questions asked.'}
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <FiCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">
                    {isRTL ? 'دفع آمن' : 'Secure Payment'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {isRTL
                      ? 'بيانات الدفع الخاصة بك آمنة ومشفّرة.'
                      : 'Your payment information is safe and secure.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Seller Info */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">
                    {isRTL ? 'البائع' : 'Sold by'}
                  </p>
                  <Link
                    to={`/store/${product.vendor.slug}`}
                    className="text-primary-600 hover:text-primary-700 font-semibold text-lg"
                  >
                    {getVendorName(product.vendor)}
                  </Link>
                  <div className="flex items-center space-x-1 mt-1">
                    <FiStar className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm text-gray-600">
                      {product.vendor.rating?.toFixed(1) || '4.5'}
                    </span>
                  </div>
                </div>
                <Link
                  to={`/store/${product.vendor.slug}`}
                  className="px-4 py-2 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium"
                >
                  {isRTL ? 'زيارة المتجر' : 'Visit Store'}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        {(product.description || product.descriptionAr) && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('product.description')}</h2>
            <div className="prose max-w-none p-6 bg-white border border-gray-200 rounded-xl">
              <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                {isRTL && product.descriptionAr
                  ? product.descriptionAr
                  : product.description}
              </p>
            </div>
          </div>
        )}

        {/* Reviews Section */}
        <div id="reviews" className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{t('product.reviews')}</h2>
            {isAuthenticated && !showReviewForm && (
              <button
                onClick={() => setShowReviewForm(true)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors text-sm font-medium"
              >
                {isRTL ? 'اكتب تقييماً' : 'Write a Review'}
              </button>
            )}
          </div>

          {/* Review Form */}
          {showReviewForm && (
            <div className="mb-8 p-6 bg-white border border-gray-200 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {isRTL ? 'اكتب تقييمك' : 'Write Your Review'}
              </h3>
              <div className="space-y-4">
                {/* Rating */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isRTL ? 'التقييم' : 'Rating'} <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className="focus:outline-none"
                      >
                        <FiStar
                          className={`w-6 h-6 ${
                            star <= reviewRating
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="text-sm text-gray-600 ml-2">
                      {isRTL
                        ? `${reviewRating} من 5`
                        : `${reviewRating} out of 5`}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isRTL ? 'عنوان التقييم (اختياري)' : 'Review Title (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder={
                      isRTL ? 'اكتب ملخصاً قصيراً للتقييم' : 'Summarize your review'
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                {/* Comment */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isRTL ? 'نص التقييم (اختياري)' : 'Your Review (Optional)'}
                  </label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder={
                      isRTL
                        ? 'شاركنا تجربتك مع هذا المنتج'
                        : 'Share your experience with this product'
                    }
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3">
                  <button
                    onClick={handleSubmitReview}
                    disabled={submittingReview}
                    className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {submittingReview
                      ? isRTL
                        ? 'جاري الإرسال...'
                        : 'Submitting...'
                      : isRTL
                        ? 'إرسال التقييم'
                        : 'Submit Review'}
                  </button>
                  <button
                    onClick={() => {
                      setShowReviewForm(false);
                      setReviewRating(5);
                      setReviewTitle('');
                      setReviewComment('');
                    }}
                    disabled={submittingReview}
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isAuthenticated && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <button
                  onClick={() => navigate('/login', { state: { from: { pathname: window.location.pathname } } })}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {isRTL ? 'سجّل الدخول' : 'Sign in'}
                </button>
                {' '}
                {isRTL ? 'لكتابة تقييم' : 'to write a review'}
              </p>
            </div>
          )}

          {reviewsLoading ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-600">
                {isRTL ? 'جاري تحميل التقييمات...' : 'Loading reviews...'}
              </p>
            </div>
          ) : reviewsError ? (
            <div className="text-center py-12 bg-red-50 rounded-xl border border-red-200">
              <p className="text-red-600 text-sm">{reviewsError}</p>
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-gray-600">
                {isRTL
                  ? 'لا توجد تقييمات حتى الآن. كن أول من يقيّم هذا المنتج!'
                  : 'No reviews yet. Be the first to review this product!'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 divide-y">
              {reviews.map((review) => (
                <div key={review.id} className="p-4 sm:p-6 flex gap-3 sm:gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
                      {review.user?.name
                        ? review.user.name
                            .split(' ')
                            .map((n: string) => n[0])
                            .join('')
                            .slice(0, 2)
                        : 'U'}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {review.user?.name || 'Customer'}
                        </p>
                        <div className="flex items-center space-x-1">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <FiStar
                              key={idx}
                              className={`w-3.5 h-3.5 ${
                                idx < review.rating
                                  ? 'text-yellow-400 fill-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    {review.title && (
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {review.title}
                      </p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">
                        {review.comment}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related Products - Affinity Cross Selling */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6 flex items-center gap-2">
              <FiStar className="text-primary-500 fill-primary-500 w-6 h-6" />
              {isRTL ? 'منتجات ذات صلة' : 'Related Products'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProductPage;
