import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchHomeSections } from '../store/slices/homeSlice';
import { Link } from 'react-router-dom';
import ProductCard from '../components/product/ProductCard';
import CategoryCard from '../components/category/CategoryCard';
import { fetchCategories } from '../store/slices/categorySlice';
import { ProductCardSkeleton, CategoryCardSkeleton } from '../components/common/Skeleton';
import { SEO } from '../components/common/SEO';
import { FiChevronRight, FiStar } from 'react-icons/fi';
import { formatPrice } from '../lib/utils';

// Custom arrow/chevron icons since they may not be in react-icons v4
const ArrowRightIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const HomePage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const { banners, sections, loading } = useAppSelector((state) => state.home);
  const { categories, loading: categoriesLoading } = useAppSelector((state) => state.categories);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const hasFetchedHome = useRef(false);
  const hasFetchedCategories = useRef(false);
  
  // Get featured products from sections
  const featuredProducts = sections.find(s => s.type === 'best_sellers' || s.type === 'trending')?.products || [];
  const topDealsProducts = sections.find(s => s.type === 'top_deals')?.products || [];

  useEffect(() => {
    if (!hasFetchedHome.current && !loading) {
      hasFetchedHome.current = true;
      dispatch(fetchHomeSections());
    }
    if (!hasFetchedCategories.current && !categoriesLoading) {
      hasFetchedCategories.current = true;
      dispatch(fetchCategories());
    }
  }, [dispatch, loading, categoriesLoading]);

  // Auto-rotate hero carousel
  const heroBanners = banners.filter((b) => b.type === 'HERO');
  useEffect(() => {
    if (heroBanners.length > 1) {
      const interval = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % heroBanners.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [heroBanners.length]);

  return (
    <>
      <SEO
        title="Home"
        description="Shop the best products on GoKnary - Your trusted e-commerce marketplace"
        keywords="e-commerce, shopping, products, deals, online store"
      />
      {loading && banners.length === 0 ? (
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">Loading...</div>
        </div>
      ) : (
        <div className="w-full">
          {/* Hero Section - Modern Design */}
          {heroBanners.length > 0 && (
            <section className="relative mb-6 sm:mb-8 lg:mb-12 pt-4 lg:pt-6">
              <div className="container mx-auto px-3 sm:px-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-4">
                  {/* Main Hero Carousel - Takes 8 columns */}
                  <div className="lg:col-span-8 relative overflow-hidden rounded-2xl lg:rounded-3xl h-[260px] sm:h-[320px] lg:h-[650px] shadow-lg group">
                    {heroBanners.map((banner, index) => (
                      <Link
                        key={banner.id}
                        to={banner.linkUrl || '#'}
                        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                          index === currentHeroIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                        }`}
                      >
                        <div className="relative w-full h-full">
                          <img
                            src={banner.imageUrl}
                            alt={banner.title || 'Banner'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/imgs/default-product.jpg';
                            }}
                          />
                          {/* Improved Gradient Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/40 to-transparent"></div>
                          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70"></div>
                          
                          {banner.title && (
                            <div className="absolute inset-0 flex items-center justify-center lg:justify-start lg:items-center p-4 sm:p-6 lg:p-12 pb-16 sm:pb-24 lg:pb-20">
                              <div className="max-w-2xl w-full z-20 flex flex-col h-full justify-center lg:justify-between items-center lg:items-start text-center lg:text-left">
                                {/* Text content - hidden on very small screens */}
                                <div className="hidden sm:block">
                                  {/* Special Offer Badge */}
                                  <div className="inline-block mb-3 sm:mb-5 px-3 sm:px-5 py-1.5 sm:py-2 bg-primary-500 rounded-lg shadow-lg">
                                    <span className="text-white text-xs sm:text-sm font-bold uppercase tracking-wide">{t('home.specialOffers')}</span>
                                  </div>
                                  
                                  {/* Title */}
                                  <h2 className="text-white text-2xl sm:text-3xl lg:text-5xl xl:text-6xl font-black mb-3 sm:mb-5 drop-shadow-lg leading-tight">
                                    {isRTL && (banner as any).titleAr ? (banner as any).titleAr : banner.title}
                                  </h2>
                                  
                                  {/* Description */}
                                  <p className="text-white/95 text-sm sm:text-base lg:text-lg mb-2 sm:mb-6 lg:mb-8 drop-shadow-md max-w-xl">
                                    {isRTL 
                                      ? 'اكتشف العروض المذهلة ووفر حتى 50% على المنتجات المختارة'
                                      : 'Discover amazing deals and save up to 50% on selected items'}
                                  </p>
                                </div>
                                
                                {/* CTA Button - always visible */}
                                <div className="mt-4 lg:mt-auto">
                                  <button className="group/btn inline-flex items-center gap-2 sm:gap-3 bg-primary-500 hover:bg-primary-600 text-white px-6 sm:px-8 py-3 sm:py-4 lg:px-10 lg:py-5 rounded-xl font-bold text-sm sm:text-base lg:text-lg transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-primary-500/50 transform hover:scale-[1.02]">
                                    <span>{t('home.shopNow')}</span>
                                    <ArrowRightIcon className={`w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 group-hover/btn:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                    
                    {/* Navigation Arrows - Middle Sides */}
                    {heroBanners.length > 1 && (
                      <>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentHeroIndex((prev) => (prev - 1 + heroBanners.length) % heroBanners.length);
                          }}
                          className="absolute left-2 sm:left-3 lg:left-4 top-1/2 -translate-y-1/2 z-30 bg-white/95 hover:bg-white text-gray-900 p-2 sm:p-2.5 lg:p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                          aria-label="Previous slide"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentHeroIndex((prev) => (prev + 1) % heroBanners.length);
                          }}
                          className="absolute right-2 sm:right-3 lg:right-4 top-1/2 -translate-y-1/2 z-30 bg-white/95 hover:bg-white text-gray-900 p-2 sm:p-2.5 lg:p-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
                          aria-label="Next slide"
                        >
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}

                    {/* Carousel Indicators - Improved */}
                    {heroBanners.length > 1 && (
                      <div className="absolute bottom-4 sm:bottom-5 lg:bottom-6 left-1/2 transform -translate-x-1/2 z-30 flex items-center space-x-2.5 bg-black/50 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                        {heroBanners.map((_, index) => (
                          <button
                            key={index}
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentHeroIndex(index);
                            }}
                            className={`rounded-full transition-all duration-300 ${
                              index === currentHeroIndex
                                ? 'w-8 h-2 bg-white shadow-md'
                                : 'w-2 h-2 bg-white/50 hover:bg-white/70'
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Side Promo Tiles - Takes 4 columns, Improved Layout */}
                  <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-4">
                    {banners
                      .filter((b) => b.type === 'PROMO')
                      .slice(0, 2)
                      .map((banner, idx) => (
                        <Link
                          key={banner.id}
                          to={banner.linkUrl || '#'}
                          className="relative overflow-hidden rounded-2xl h-[290px] lg:h-[calc((650px-4px)/2)] group shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                          <div className="relative w-full h-full">
                            <img
                              src={banner.imageUrl}
                              alt={banner.title || 'Promo'}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/imgs/default-product.jpg';
                              }}
                            />
                            {/* Improved Overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                            
                            {banner.title && (
                              <div className="absolute inset-0 flex flex-col justify-end p-5 lg:p-6">
                                <h3 className="text-white font-black text-xl lg:text-2xl mb-2 drop-shadow-lg">
                                  {isRTL && (banner as any).titleAr ? (banner as any).titleAr : banner.title}
                                </h3>
                                <span className="inline-flex items-center space-x-1.5 text-white text-sm font-semibold group-hover:text-primary-300 transition-colors">
                                  <span>{isRTL ? 'استكشف المجموعة' : 'Explore Collection'}</span>
                                  <ArrowRightIcon className={`w-4 h-4 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                                </span>
                              </div>
                            )}
                          </div>
                        </Link>
                      ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Hot Deals Section - Below Hero */}
          {featuredProducts.length > 0 && (
            <section className="mb-6 sm:mb-8 lg:mb-10">
              <div className="container mx-auto px-3 sm:px-4">
                <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-100 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4 sm:mb-6">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-gray-900 flex items-center gap-2 sm:gap-3">
                      <span className="text-2xl sm:text-3xl">🔥</span>
                      <span>Hot Deals</span>
                    </h3>
                    <Link
                      to="/category/deals"
                      className="text-sm text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                    >
                      See All <ChevronRightIcon className="w-4 h-4" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
                    {featuredProducts.slice(0, 6).map((product) => {
                      const discountPercentage = product.discountPrice
                        ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
                        : 0;
                      
                      return (
                        <Link
                          key={product.id}
                          to={`/product/${product.slug}`}
                          className="group bg-white rounded-xl border-2 border-gray-200 hover:border-primary-300 p-4 transition-all duration-300 hover:shadow-lg"
                        >
                          <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-gray-100 mb-3">
                            {discountPercentage > 0 && (
                              <span className="absolute top-2 left-2 bg-accent-500 text-white text-xs font-bold px-2 py-1 rounded z-10">
                                -{discountPercentage}%
                              </span>
                            )}
                            <img
                              src={product.images?.[0] || '/imgs/default-product.jpg'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors leading-tight min-h-[2.5rem]">
                            {product.name}
                          </h4>
                          <div className="flex flex-col items-start sm:flex-row sm:items-baseline sm:space-x-2 mb-2">
                            <span className="text-base sm:text-lg font-extrabold text-secondary-900">
                              {formatPrice(product.discountPrice || product.price)}
                            </span>
                            {product.discountPrice && (
                              <span className="text-xs sm:text-sm text-gray-400 line-through mt-0.5 sm:mt-0">
                                {formatPrice(product.price)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-1">
                            <FiStar className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs font-semibold text-gray-700">
                              {product.ratingAvg.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400">({product.ratingCount})</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Categories Strip */}
          <section className="mb-6 sm:mb-8 lg:mb-10 bg-gray-50 py-4 sm:py-6 lg:py-8">
            <div className="container mx-auto px-3 sm:px-4">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{t('nav.shopByCategory')}</h2>
                <Link
                  to="/categories"
                  className="hidden md:flex items-center text-primary-600 hover:text-primary-700 font-medium text-sm"
                >
                  {t('common.viewAll')} <FiChevronRight className={`ms-1 w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
                </Link>
              </div>
              {categoriesLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <CategoryCardSkeleton key={i} />
                  ))}
                </div>
              ) : categories.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                  {categories.slice(0, 6).map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              ) : null}
            </div>
          </section>

          {/* Product Sections */}
          <div className="container mx-auto px-3 sm:px-4 pb-6 sm:pb-8">
            {sections.map((section, sectionIndex) => (
              <section key={section.id} className="mb-6 sm:mb-8 lg:mb-10">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1">
                      {isRTL && (section as any).titleAr ? (section as any).titleAr : section.title}
                    </h2>
                  </div>
                  <Link
                    to={`/category/${section.type === 'top_deals' ? 'deals' : section.type}`}
                    className="hidden md:flex items-center text-primary-600 hover:text-primary-700 font-medium text-sm group"
                  >
                    {t('common.viewAll')}
                    <FiChevronRight className={`ms-1 w-4 h-4 group-hover:translate-x-1 transition-transform ${isRTL ? 'rotate-180' : ''}`} />
                  </Link>
                </div>
                {loading ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <ProductCardSkeleton key={i} />
                    ))}
                  </div>
                ) : section.products.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
                    {section.products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12 bg-gray-50 rounded-lg">
                    <p className="text-lg">{t('common.noResults')}</p>
                  </div>
                )}
              </section>
            ))}

            {/* Promo Banners Grid */}
            {banners.filter((b) => b.type === 'PROMO').length > 2 && (
              <section className="mb-8 lg:mb-10">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                  {banners
                    .filter((b) => b.type === 'PROMO')
                    .slice(2)
                    .map((banner) => (
                      <Link
                        key={banner.id}
                        to={banner.linkUrl || '#'}
                        className="relative overflow-hidden rounded-xl aspect-[4/3] group"
                      >
                        <img
                          src={banner.imageUrl}
                          alt={banner.title || 'Promo'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        {banner.title && (
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
                            <h3 className="text-white font-bold text-lg">
                              {isRTL && (banner as any).titleAr ? (banner as any).titleAr : banner.title}
                            </h3>
                          </div>
                        )}
                      </Link>
                    ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default HomePage;
