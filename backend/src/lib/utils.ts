import { Prisma } from '@prisma/client';

export const slugify = (text: string): string => {
  let slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]+/gu, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');

  if (!slug) {
    slug = Math.random().toString(36).substring(2, 10);
  }
  return slug;
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

