export const calculateDiscountPercentage = (price: number, discountPrice: number): number => {
  if (!discountPrice || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
};

export const formatPrice = (price: number | string | null | undefined): string => {
  const numericPrice = Number(price);
  const safePrice = Number.isFinite(numericPrice) ? numericPrice : 0;

  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(safePrice);
};

