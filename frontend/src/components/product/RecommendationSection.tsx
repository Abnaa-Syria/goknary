import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import ProductCard from './ProductCard';
import { Product } from '../../store/slices/productSlice';
import { parseProductImages } from '../../utils/image';
import { useAppSelector } from '../../store/hooks';
import { getGuestRecommendationContext } from '../../lib/guestRecommendations';

export type RecommendationContext = 'home' | 'product' | 'cart';

interface RecommendationSectionProps {
  context: RecommendationContext;
  productId?: string;
  cartProductIds?: string[];
  limit?: number;
  /** Receives whether the list was personalized for the logged-in customer. */
  title: (personalized: boolean) => string;
  /** Shown instead when the request fails (e.g. same-category products already on the page). */
  fallbackProducts?: Product[];
  /** Render nothing unless the list is personalized (guests already see a general section). */
  personalizedOnly?: boolean;
  className?: string;
}

const normalize = (products: any[]): Product[] =>
  (products || []).map((p) => ({ ...p, images: parseProductImages(p.images) }));

/**
 * Optional product strip fed by GET /api/recommendations. It never blocks the page: while loading,
 * on error or with no results it renders nothing (or the given fallback products).
 */
const RecommendationSection: React.FC<RecommendationSectionProps> = ({
  context,
  productId,
  cartProductIds,
  limit = 12,
  title,
  fallbackProducts,
  personalizedOnly = false,
  className = '',
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [personalized, setPersonalized] = useState(false);
  const [failed, setFailed] = useState(false);
  const isCustomer = useAppSelector(
    (state) => state.auth.isAuthenticated && state.auth.user?.role === 'CUSTOMER'
  );
  const cartKey = (cartProductIds || []).slice().sort().join(',');

  useEffect(() => {
    if (context === 'product' && !productId) return;
    let cancelled = false;
    const guest = getGuestRecommendationContext();
    setFailed(false);
    api
      .get('/recommendations', {
        params: {
          context,
          limit,
          ...(productId ? { productId } : {}),
          ...(context === 'cart' && cartKey ? { cartProductIds: cartKey } : {}),
          ...(guest.productIds.length ? { interestProductIds: guest.productIds.join(',') } : {}),
          ...(guest.categoryIds.length ? { interestCategoryIds: guest.categoryIds.join(',') } : {}),
        },
      })
      .then((res) => {
        if (cancelled) return;
        setProducts(normalize(res.data?.products));
        setPersonalized(!!res.data?.personalized);
      })
      .catch(() => {
        if (cancelled) return;
        setProducts([]);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [context, productId, cartKey, limit, isCustomer]);

  const shown = failed ? fallbackProducts || [] : products;
  if (shown.length === 0 || (personalizedOnly && !personalized)) return null;

  return (
    <section className={className} data-testid={`recommendations-${context}`}>
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">{title(personalized && !failed)}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
        {shown.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};

export default RecommendationSection;

interface RecentlyViewedSectionProps {
  title: string;
  limit?: number;
  className?: string;
}

/** The logged-in customer's own recently viewed products; hidden for guests, on error or when empty. */
export const RecentlyViewedSection: React.FC<RecentlyViewedSectionProps> = ({ title, limit = 12, className = '' }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const isCustomer = useAppSelector(
    (state) => state.auth.isAuthenticated && state.auth.user?.role === 'CUSTOMER'
  );

  useEffect(() => {
    let cancelled = false;
    const guestProductIds = getGuestRecommendationContext().productIds;
    api
      .get('/recommendations/recently-viewed', {
        params: { limit, ...(guestProductIds.length ? { guestProductIds: guestProductIds.join(',') } : {}) },
      })
      .then((res) => {
        if (!cancelled) setProducts(normalize(res.data?.products));
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [limit, isCustomer]);

  if (products.length === 0) return null;
  return (
    <section className={className} data-testid="recently-viewed">
      <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-6">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
};
