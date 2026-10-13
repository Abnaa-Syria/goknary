import { calculateDiscountPercentage } from './utils';
import { CustomerVariant, getActiveVariants } from './variantSelection';

interface OfferProduct {
  price: number;
  discountPrice?: number | null;
  stock: number;
  variants?: CustomerVariant[] | null;
}

export interface ProductOffer {
  usableVariants: CustomerVariant[];
  usesVariants: boolean;
  price: number;
  discountPrice: number | null;
  stock: number;
  /** What the customer pays now. */
  displayPrice: number;
  /** Struck-through price, only when there is a discount. */
  originalPrice: number | null;
  discountPercentage: number;
}

/**
 * Variant products: the selected variant is the only source of price, discount and stock (no ranges).
 * Simple products: the product's own fields.
 */
export const getProductOffer = (product: OfferProduct, selectedVariant: CustomerVariant | null): ProductOffer => {
  const usableVariants = getActiveVariants(product.variants);
  const usesVariants = usableVariants.length > 0;
  const price = usesVariants ? selectedVariant?.price ?? 0 : product.price;
  const discountPrice = (usesVariants ? selectedVariant?.discountPrice : product.discountPrice) || null;
  const stock = usesVariants ? selectedVariant?.stock ?? 0 : product.stock;
  return {
    usableVariants,
    usesVariants,
    price,
    discountPrice,
    stock,
    displayPrice: discountPrice || price,
    originalPrice: discountPrice ? price : null,
    discountPercentage: discountPrice ? calculateDiscountPercentage(price, discountPrice) : 0,
  };
};
