export interface ProductDiscountSource {
  price: number;
  discountPrice?: number | null;
  discountType?: string | null;
  discountValue?: number | null;
}

export interface DiscountFormFields {
  discountType: string;
  discountValue: string;
  discountPrice: string;
}

/** Map API product discount fields into edit-form state (handles discountPrice-only records). */
export function getProductDiscountFormFields(product: ProductDiscountSource): DiscountFormFields {
  const price = product.price;
  const type = product.discountType?.trim() || '';
  const value = product.discountValue;
  const finalPrice = product.discountPrice;

  if (type && value != null && value > 0) {
    return {
      discountType: type,
      discountValue: String(value),
      discountPrice: finalPrice != null ? String(finalPrice) : '',
    };
  }

  if (finalPrice != null && finalPrice < price) {
    const fixedAmount = Math.round((price - finalPrice) * 100) / 100;
    return {
      discountType: type || 'FIXED',
      discountValue: String(fixedAmount),
      discountPrice: String(finalPrice),
    };
  }

  if (type) {
    return {
      discountType: type,
      discountValue: value != null && value > 0 ? String(value) : '',
      discountPrice: finalPrice != null ? String(finalPrice) : '',
    };
  }

  return { discountType: '', discountValue: '', discountPrice: '' };
}

export function calculateDiscountPrice(
  price: number,
  discountType: string,
  discountValue: number
): string {
  if (!discountType || discountValue <= 0) return '';

  let finalP = price;
  if (discountType === 'PERCENTAGE') {
    finalP = price - (price * discountValue) / 100;
  } else if (discountType === 'FIXED') {
    finalP = price - discountValue;
  }

  return Math.max(0, finalP).toFixed(2);
}

export function buildDiscountPayload(form: {
  price: string;
  discountType: string;
  discountValue: string;
  discountPrice: string;
}): {
  discountType: string | null;
  discountValue: number | null;
  discountPrice: number | null;
} {
  const price = parseFloat(form.price);
  if (Number.isNaN(price) || price <= 0) {
    return { discountType: null, discountValue: null, discountPrice: null };
  }

  const type = form.discountType?.trim() || '';
  const value = form.discountValue ? parseFloat(form.discountValue) : NaN;
  const explicitFinal = form.discountPrice ? parseFloat(form.discountPrice) : NaN;

  if (type && !Number.isNaN(value) && value > 0) {
    return {
      discountType: type,
      discountValue: value,
      discountPrice: parseFloat(calculateDiscountPrice(price, type, value)),
    };
  }

  if (!Number.isNaN(explicitFinal) && explicitFinal < price) {
    return {
      discountType: type || 'FIXED',
      discountValue: Math.round((price - explicitFinal) * 100) / 100,
      discountPrice: explicitFinal,
    };
  }

  return { discountType: null, discountValue: null, discountPrice: null };
}
