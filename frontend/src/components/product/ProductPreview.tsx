import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import ProductDetailView from './ProductDetailView';
import NoIndex from '../common/NoIndex';
import { SEO } from '../common/SEO';
import { CustomerVariant, getActiveVariants, pickInitialVariant } from '../../lib/variantSelection';
import { getProductOffer } from '../../lib/productOffer';
import type { PreviewProduct } from '../../hooks/useProductPreview';

/**
 * The real customer product presentation (gallery, generic variant selector, price, stock, policies,
 * description) with every commerce action replaced by an explanation. Used by the admin and vendor previews.
 */
const ProductPreview: React.FC<{ product: PreviewProduct }> = ({ product }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const [selectedVariant, setSelectedVariant] = useState<CustomerVariant | null>(null);

  // Same rule as the store: open on the active default even when it is out of stock.
  useEffect(() => {
    setSelectedVariant(pickInitialVariant(getActiveVariants(product.variants as CustomerVariant[] | undefined)));
  }, [product]);

  const offer = getProductOffer(product as any, selectedVariant);
  const name = (isArabic && product.nameAr) || product.name;

  const purchaseArea = (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
      <Lock size={18} className="mt-0.5 flex-shrink-0 text-gray-500" aria-hidden="true" />
      <div>
        <p className="text-sm font-semibold text-gray-900">{t('productPreview.purchaseDisabledTitle')}</p>
        <p className="mt-1 text-sm text-gray-600">{t('productPreview.purchaseDisabledBody')}</p>
      </div>
    </div>
  );

  return (
    <>
      <NoIndex />
      <SEO title={t('productPreview.documentTitle', { name })} />
      <ProductDetailView
        product={product}
        offer={offer}
        selectedVariant={selectedVariant}
        onSelectVariant={setSelectedVariant}
        mode="preview"
        purchaseArea={purchaseArea}
      />
    </>
  );
};

export default ProductPreview;
