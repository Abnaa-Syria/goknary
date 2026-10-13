import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { formatPrice } from '../../lib/utils';
import Breadcrumbs from '../common/Breadcrumbs';
import { HIGH_FETCH_PRIORITY, IMAGE_PLACEHOLDER, getImageUrl } from '../../utils/image';
import { getProductImageAlt, getVariantImageAlt } from '../../utils/imageAlt';
import ProductPolicySummary from '../vendor/ProductPolicySummary';
import ProductVariantSelector from './ProductVariantSelector';
import type { Product } from '../../store/slices/productSlice';
import type { CustomerVariant } from '../../lib/variantSelection';
import type { ProductOffer } from '../../lib/productOffer';

export type ProductDetailMode = 'store' | 'preview';

interface Props {
  product: Product;
  offer: ProductOffer;
  selectedVariant: CustomerVariant | null;
  onSelectVariant: (variant: CustomerVariant) => void;
  /** `preview` renders the same content, with links to public pages shown as plain text. */
  mode: ProductDetailMode;
  /** Rating summary under the title (store only; previews of unpublished products have no reviews). */
  ratingSlot?: React.ReactNode;
  /** Quantity and purchase buttons in the store, an explanation in preview. */
  purchaseArea: React.ReactNode;
}

/** The customer product presentation shared by the storefront page and the authenticated previews. */
const ProductDetailView: React.FC<Props> = ({ product, offer, selectedVariant, onSelectVariant, mode, ratingSlot, purchaseArea }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const linksEnabled = mode === 'store';
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [imageZoom, setImageZoom] = useState(false);

  // A newly selected option (or product) starts on its own lead image.
  useEffect(() => {
    setSelectedImageIndex(0);
  }, [product.id, selectedVariant?.id]);

  const localized = (entity: { name?: string; nameAr?: string | null } | null | undefined) =>
    entity ? (isRTL && entity.nameAr ? entity.nameAr : entity.name ?? '') : '';
  const categoryName = (c: { name?: string; nameAr?: string | null } | null | undefined) =>
    c ? localized(c) : t('category.defaultName', isRTL ? 'الفئة' : 'Category');
  const vendorName = isRTL && product.vendor?.storeNameAr ? product.vendor.storeNameAr : product.vendor?.storeName;
  const productName = localized(product);

  const { usableVariants, usesVariants, stock, displayPrice, originalPrice, discountPercentage } = offer;

  const images: string[] = Array.isArray(product.images) ? product.images : [];
  // The selected variant's own image leads the gallery; the product images stay browsable after it.
  const variantImage = selectedVariant?.image && !images.includes(selectedVariant.image) ? selectedVariant.image : null;
  const galleryItems: { url: string; variant: boolean }[] = [
    ...(variantImage ? [{ url: variantImage, variant: true }] : []),
    ...images.map((url) => ({ url, variant: !!selectedVariant?.image && url === selectedVariant.image })),
  ];
  if (!variantImage && selectedVariant?.image) {
    const index = galleryItems.findIndex((item) => item.url === selectedVariant.image);
    if (index > 0) galleryItems.unshift(...galleryItems.splice(index, 1));
  }
  const imageAltFor = (item: { url: string; variant: boolean }) =>
    item.variant ? getVariantImageAlt(selectedVariant, product, isRTL) : getProductImageAlt(product, item.url, isRTL);
  const activeImage = galleryItems[selectedImageIndex] ?? galleryItems[0] ?? null;
  const mainImage = activeImage?.url || IMAGE_PLACEHOLDER;
  const mainImageAlt = activeImage ? imageAltFor(activeImage) : getProductImageAlt(product, null, isRTL);

  const categoryAncestors: any[] = (product.category as any)?.ancestors ?? [];
  const breadcrumbItems = [
    ...categoryAncestors.map((ancestor) => ({
      label: categoryName(ancestor),
      to: linksEnabled ? `/category/${ancestor.slug}` : undefined,
    })),
    {
      label: categoryName(product.category),
      to: linksEnabled && product.category ? `/category/${product.category.slug}` : undefined,
    },
    { label: productName },
  ];

  const description = isRTL && product.descriptionAr ? product.descriptionAr : product.description;

  return (
    <>
      <Breadcrumbs items={breadcrumbItems} homeLink={linksEnabled} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-12 mb-8 sm:mb-12 lg:mb-16">
        {/* Image Gallery */}
        <div className="relative">
          <div
            className="relative mb-4 aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200 group cursor-zoom-in"
            onMouseEnter={() => setImageZoom(true)}
            onMouseLeave={() => setImageZoom(false)}
          >
            <img
              src={getImageUrl(mainImage)}
              alt={mainImageAlt}
              {...HIGH_FETCH_PRIORITY}
              className={`w-full h-full object-cover transition-transform duration-300 ${imageZoom ? 'scale-150' : 'scale-100'}`}
              onError={(e) => {
                (e.target as HTMLImageElement).src = IMAGE_PLACEHOLDER;
              }}
            />
            {discountPercentage > 0 && (
              <span className="absolute top-4 start-4 bg-accent-500 text-white text-sm font-bold px-3 py-1.5 rounded-lg shadow-lg z-10">
                {t('product.discountPercent', '{{percent}}% OFF', { percent: discountPercentage })}
              </span>
            )}
          </div>

          {galleryItems.length > 1 && (
            <div className="grid grid-cols-4 lg:grid-cols-5 gap-3">
              {galleryItems.slice(0, 5).map((item, index) => (
                <button
                  key={`${item.url}-${index}`}
                  type="button"
                  onClick={() => setSelectedImageIndex(index)}
                  aria-pressed={selectedImageIndex === index}
                  aria-label={imageAltFor(item)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedImageIndex === index
                      ? 'border-primary-500 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <img src={getImageUrl(item.url)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Info */}
        <div>
          <div className="mb-4">
            {product.brand && (linksEnabled ? (
              <Link to={`/category/${product.category?.slug}`} className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                {localized(product.brand)}
              </Link>
            ) : (
              <span className="text-primary-600 text-sm font-medium">{localized(product.brand)}</span>
            ))}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mt-2 mb-4">{productName}</h1>
            {ratingSlot}
          </div>

          {usesVariants && (
            <ProductVariantSelector variants={usableVariants} selected={selectedVariant} onSelect={onSelectVariant} />
          )}

          {/* Price Block */}
          <div className="mb-6 p-4 sm:p-6 bg-gradient-to-br from-gray-50 to-primary-50 rounded-xl border border-gray-200">
            <div className="flex flex-wrap items-baseline gap-2 sm:gap-4 mb-4">
              <span className="text-3xl sm:text-4xl font-bold text-secondary-900">{formatPrice(displayPrice)}</span>
              {originalPrice && (
                <>
                  <span className="text-xl sm:text-2xl text-gray-400 line-through">{formatPrice(originalPrice)}</span>
                  <span className="bg-green-500 text-white text-xs sm:text-sm font-bold px-2 sm:px-3 py-1 rounded-lg">
                    {t('variantOptions.save', 'Save {{amount}}', { amount: formatPrice(originalPrice - displayPrice) })}
                  </span>
                </>
              )}
            </div>
            {stock > 0 ? (
              <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                <FiCheck className="w-4 h-4" />
                <span>
                  {t('product.inStock')} ({stock})
                </span>
              </div>
            ) : (
              <div className="text-red-600 text-sm font-medium">
                {usesVariants ? t('variantOptions.outOfStock', 'Out of stock') : t('product.outOfStock')}
              </div>
            )}
          </div>

          <div className="mb-8">{purchaseArea}</div>

          {/* Delivery & Services Info */}
          <div className="space-y-4 mb-8 p-4 sm:p-6 bg-white border border-gray-200 rounded-xl">
            <ProductPolicySummary vendor={product.vendor} />
            <div className="flex items-start space-x-3">
              <FiCheck className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-gray-900 mb-1">{isRTL ? 'دفع آمن' : 'Secure Payment'}</h4>
                <p className="text-sm text-gray-600">
                  {isRTL ? 'بيانات الدفع الخاصة بك آمنة ومشفّرة.' : 'Your payment information is safe and secure.'}
                </p>
              </div>
            </div>
          </div>

          {/* Seller Info */}
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{isRTL ? 'البائع' : 'Sold by'}</p>
                {linksEnabled ? (
                  <Link to={`/store/${product.vendor.slug}`} className="text-primary-600 hover:text-primary-700 font-semibold text-lg">
                    {vendorName}
                  </Link>
                ) : (
                  <span className="text-primary-600 font-semibold text-lg">{vendorName}</span>
                )}
              </div>
              {linksEnabled && (
                <Link
                  to={`/store/${product.vendor.slug}`}
                  className="px-4 py-2 border border-primary-500 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm font-medium"
                >
                  {isRTL ? 'زيارة المتجر' : 'Visit Store'}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {(product.description || product.descriptionAr) && (
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('product.description')}</h2>
          <div className="prose max-w-none p-6 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{description}</p>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductDetailView;
