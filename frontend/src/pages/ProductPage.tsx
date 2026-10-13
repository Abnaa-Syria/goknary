import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProductBySlug, clearProduct } from '../store/slices/productSlice';
import { addToCart } from '../store/slices/cartSlice';
import { addToWishlist, removeFromWishlistByProductId, fetchWishlist } from '../store/slices/wishlistSlice';
import { addToCompare, removeFromCompare, fetchCompare } from '../store/slices/compareSlice';
import { FiStar, FiShoppingCart, FiHeart, FiMinusCircle, FiPlusCircle } from 'react-icons/fi';
import RecommendationSection from '../components/product/RecommendationSection';
import ProductDetailView from '../components/product/ProductDetailView';
import { SEO } from '../components/common/SEO';
import api from '../lib/api';
import { useTrackView } from '../lib/tracking';
import toast from 'react-hot-toast';
import { CustomerVariant, getActiveVariants, isPurchasableVariant, pickInitialVariant } from '../lib/variantSelection';
import { getProductOffer } from '../lib/productOffer';

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
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<CustomerVariant | null>(null);
  const [quantityNote, setQuantityNote] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsTotal, setReviewsTotal] = useState<number | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  useTrackView('PRODUCT_VIEW', product && product.slug === slug ? product.id : null);

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

  // Open on the active default variant (its price is the catalog price on cards), even when it is out of
  // stock; legacy data without an active default falls back to the first active variant.
  useEffect(() => {
    setSelectedVariant(pickInitialVariant(getActiveVariants(product?.variants as CustomerVariant[] | undefined)));
    setQuantity(1);
    setQuantityNote('');
  }, [product]);

  const selectVariant = (variant: CustomerVariant) => {
    setSelectedVariant(variant);
    if (variant.stock > 0 && quantity > variant.stock) {
      setQuantity(variant.stock);
      setQuantityNote(t('variantOptions.quantityAdjusted', 'Quantity changed to {{count}}, the most available for this option.', { count: variant.stock }));
    } else {
      setQuantityNote('');
    }
  };

  // Fetch product reviews (recommendations load separately, so their failure cannot hide reviews)
  useEffect(() => {
    const fetchReviews = async () => {
      if (!slug) return;
      setReviewsLoading(true);
      setReviewsError(null);
      try {
        const reviewsRes = await api.get(`/products/${slug}/reviews`, { params: { page: 1, limit: 10 } });
        setReviews(reviewsRes.data.reviews || []);
        const total = reviewsRes.data.pagination?.total;
        setReviewsTotal(typeof total === 'number' ? total : null);
      } catch (err: any) {
        console.error('Failed to load reviews:', err);
        setReviewsError(err.response?.data?.error || 'Failed to load reviews');
      } finally {
        setReviewsLoading(false);
      }
    };

    fetchReviews();
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

  // Variant products: the selected variant is the only source of price, discount, stock and availability.
  const offer = getProductOffer(product as any, selectedVariant);
  const { usesVariants, stock: currentStock } = offer;
  const canPurchase = currentStock > 0 && quantity <= currentStock && (!usesVariants || isPurchasableVariant(selectedVariant));
  const purchaseBlockedReason = canPurchase
    ? ''
    : usesVariants && !selectedVariant
      ? t('variantOptions.chooseAvailable', 'Choose an available option to continue.')
      : currentStock <= 0
        ? usesVariants
          ? t('variantOptions.selectedOutOfStock', 'This option is currently out of stock. Choose another option to buy.')
          : t('product.outOfStock')
        : '';

  const addSelectionToCart = async (): Promise<boolean> => {
    if (!product) return false;
    if (usesVariants && !isPurchasableVariant(selectedVariant)) {
      toast.error(t('product.feedback.selectAvailableOption', 'Please select an available option first'));
      return false;
    }
    if (!canPurchase) return false;

    try {
      await dispatch(addToCart({
        productId: product.id,
        variantId: usesVariants ? selectedVariant?.id : undefined,
        quantity,
      })).unwrap();
      return true;
    } catch (error: any) {
      toast.error(typeof error === 'string' && error ? error : t('product.feedback.addToCartFailed', 'Failed to add item to cart'));
      return false;
    }
  };

  const handleAddToCart = async () => {
    if (await addSelectionToCart()) {
      toast.success(t('product.feedback.addedToCart', 'Item added to cart'));
    }
  };

  const handleBuyNow = async () => {
    if (await addSelectionToCart()) {
      navigate('/checkout');
    }
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
      toast.error(typeof error === 'string' && error ? error : t('product.feedback.wishlistFailed', 'Failed to update wishlist'));
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
      toast.error(typeof error === 'string' && error ? error : t('product.feedback.compareFailed', 'Failed to update compare list'));
    }
  };

  const handleSubmitReview = async () => {
    if (!slug || !isAuthenticated) {
      navigate('/login', { state: { from: { pathname: window.location.pathname } } });
      return;
    }

    if (!reviewRating || reviewRating < 1 || reviewRating > 5) {
      toast.error(t('product.feedback.ratingRequired', 'Please select a rating between 1 and 5'));
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
      setReviewsTotal((n) => (n === null ? null : n + 1));
      
      // Reset form
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      setShowReviewForm(false);
      
      // Refresh product to update rating
      if (slug) {
        dispatch(fetchProductBySlug(slug));
      }

      toast.success(t('product.feedback.reviewSubmitted', 'Review submitted successfully'));
    } catch (error: any) {
      console.error('Failed to submit review:', error);
      toast.error(error.response?.data?.error || t('product.feedback.reviewFailed', 'Failed to submit review'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const ratingSlot = (
    <div className="flex items-center space-x-3 mb-4">
      {reviewsTotal !== null && reviewsTotal > 0 && product.ratingCount === reviewsTotal && (
        <div className="flex items-center space-x-1">
          <FiStar className="w-5 h-5 fill-yellow-400 text-yellow-400" />
          <span className="font-semibold text-gray-900">{product.ratingAvg.toFixed(1)}</span>
        </div>
      )}
      {reviewsTotal !== null && (
        <span className="text-gray-500">
          {reviewsTotal > 0
            ? `(${t('product.reviewCount', { count: reviewsTotal })})`
            : t('product.noReviews')}
        </span>
      )}
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
  );

  const purchaseArea = (
    <>
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm font-medium text-gray-700">{t('product.quantity')}:</label>
        <div className="flex items-center space-x-2 border border-gray-300 rounded-lg">
          <button
            type="button"
            onClick={() => { setQuantity(Math.max(1, quantity - 1)); setQuantityNote(''); }}
            disabled={quantity <= 1}
            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-l-lg"
            aria-label={isRTL ? 'تقليل الكمية' : 'Decrease quantity'}
          >
            <FiMinusCircle className="w-5 h-5" />
          </button>
          <span className="px-4 py-2 text-lg font-medium min-w-[3rem] text-center" aria-live="polite">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => { setQuantity(Math.min(currentStock, quantity + 1)); setQuantityNote(''); }}
            disabled={quantity >= currentStock}
            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors rounded-r-lg"
            aria-label={isRTL ? 'زيادة الكمية' : 'Increase quantity'}
          >
            <FiPlusCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
      {quantityNote && <p className="-mt-4 mb-4 text-xs text-amber-700" role="status">{quantityNote}</p>}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleAddToCart}
          disabled={!canPurchase}
          className="flex-1 flex items-center justify-center gap-2 bg-primary-500 text-white font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg text-sm"
        >
          <FiShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t('product.addToCart')}</span>
        </button>
        <button
          onClick={handleBuyNow}
          disabled={!canPurchase}
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
      {purchaseBlockedReason && (
        <p className="mt-3 text-sm text-red-600" role="status">{purchaseBlockedReason}</p>
      )}
    </>
  );

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
        <ProductDetailView
          product={product}
          offer={offer}
          selectedVariant={selectedVariant}
          onSelectVariant={selectVariant}
          mode="store"
          ratingSlot={ratingSlot}
          purchaseArea={purchaseArea}
        />

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

        {/* You may also like (falls back to same-category products if recommendations fail) */}
        <RecommendationSection
          context="product"
          productId={product.id}
          title={() => t('recommendations.youMayAlsoLike', 'You may also like')}
          fallbackProducts={similarProducts}
        />
      </div>
    </>
  );
};

export default ProductPage;
