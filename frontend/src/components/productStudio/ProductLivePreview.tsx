import React from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { calculateDiscountPercentage, formatPrice } from '../../lib/utils';
import { IMAGE_PLACEHOLDER } from '../../utils/image';
import { VariantAttributeInput } from './studioModel';

interface Props {
  name: string;
  nameAr: string;
  imageSrc: string | null;
  imageAlt: string;
  brandName: string | null;
  categoryName: string | null;
  vendorName: string | null;
  price: number | null;
  discountPrice: number | null;
  stock: number;
  defaultVariant: { name: string; nameAr: string; stock: number; attributes: VariantAttributeInput[] } | null;
  isVariantProduct: boolean;
}

/** Card-shaped summary of what customers will see; it has no working storefront controls. */
const ProductLivePreview: React.FC<Props> = ({
  name, nameAr, imageSrc, imageAlt, brandName, categoryName, vendorName, price, discountPrice, stock, defaultVariant, isVariantProduct,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const title = (isRTL ? nameAr || name : name || nameAr) || t('productStudio.preview.untitled', 'Product name');
  const hasDiscount = price != null && discountPrice != null && discountPrice > 0 && discountPrice < price;
  const percent = hasDiscount ? calculateDiscountPercentage(price as number, discountPrice as number) : 0;

  return (
    <section aria-labelledby="studio-preview-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 id="studio-preview-title" className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Eye size={16} className="text-primary-600" aria-hidden="true" />
          {t('productStudio.preview.title', 'Live preview')}
        </h2>
        <span className="text-[11px] text-gray-500">{t('productStudio.preview.unsavedNote', 'Shows the current form, saved or not')}</span>
      </div>

      <div className="rounded-xl border border-gray-100 overflow-hidden">
        <div className="relative aspect-square bg-gray-100">
          <img src={imageSrc || IMAGE_PLACEHOLDER} alt={imageSrc ? imageAlt : ''} className="w-full h-full object-cover" />
          <div className="absolute top-2 start-2 flex flex-col gap-1">
            {stock <= 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-md">{t('product.outOfStock', 'Out of stock')}</span>
            )}
            {percent > 0 && <span className="bg-accent-500 text-white text-xs font-bold px-2 py-0.5 rounded-md">-{percent}%</span>}
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          {(brandName || categoryName) && (
            <p className="text-xs text-gray-500 truncate">{[brandName, categoryName].filter(Boolean).join(' · ')}</p>
          )}
          <p className="font-medium text-sm text-gray-900 line-clamp-2 break-words">{title}</p>
          {price != null && price > 0 ? (
            <p className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-secondary-900">{formatPrice(hasDiscount ? (discountPrice as number) : price)}</span>
              {hasDiscount && <span className="text-sm text-gray-400 line-through">{formatPrice(price)}</span>}
            </p>
          ) : (
            <p className="text-sm text-gray-400">{t('productStudio.preview.noPrice', 'Price not set yet')}</p>
          )}
          <p className={`text-xs font-semibold ${stock > 0 ? 'text-green-700' : 'text-red-600'}`}>
            {stock > 0
              ? t('productStudio.preview.inStock', 'In stock ({{count}})', { count: stock })
              : t('product.outOfStock', 'Out of stock')}
          </p>
          {vendorName && <p className="text-xs text-gray-500 border-t border-gray-100 pt-1.5">{t('product.vendor', 'Vendor')}: {vendorName}</p>}
        </div>
      </div>

      {isVariantProduct && (
        <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-1.5" aria-live="polite">
          <p className="font-semibold text-gray-700">{t('productStudio.preview.selectedOption', 'Selected option')}</p>
          {defaultVariant ? (
            <>
              <p className="text-sm font-semibold text-gray-900">{(isRTL && defaultVariant.nameAr) || defaultVariant.name}</p>
              <dl className="space-y-0.5">
                {defaultVariant.attributes
                  .filter((a) => a.name && a.value)
                  .map((a, i) => (
                    <div key={`${a.name}-${i}`} className="flex gap-1">
                      <dt className="text-gray-500">{(isRTL && a.nameAr) || a.name}:</dt>
                      <dd className="text-gray-800">{(isRTL && a.valueAr) || a.value}</dd>
                    </div>
                  ))}
              </dl>
              <p className={defaultVariant.stock > 0 ? 'text-green-700' : 'text-amber-700'}>
                {defaultVariant.stock > 0
                  ? t('productStudio.preview.optionInStock', 'This option is in stock ({{count}})', { count: defaultVariant.stock })
                  : t('productStudio.preview.optionOutOfStock', 'This option is out of stock')}
              </p>
              <p className="text-gray-500">{t('productStudio.preview.defaultVariant', 'Customers see this option first; change the default to change it.')}</p>
            </>
          ) : (
            <p className="text-gray-500">{t('productStudio.variants.noActive', 'Activate a variant to set the price shown in the store.')}</p>
          )}
        </div>
      )}
    </section>
  );
};

export default ProductLivePreview;
