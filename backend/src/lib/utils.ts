import { Prisma } from '@prisma/client';

export const slugify = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

export const generateSKU = (categoryId: string, productId: string): string => {
  const categoryCode = categoryId.substring(0, 3).toUpperCase();
  const productCode = productId.substring(productId.length - 6).toUpperCase();
  return `${categoryCode}-${productCode}`;
};

export const calculateDiscountPercentage = (price: number, discountPrice: number): number => {
  if (!discountPrice || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
};

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-EG', {
    style: 'currency',
    currency: 'EGP',
  }).format(price);
};

