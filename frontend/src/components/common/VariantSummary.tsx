import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  VariantAttribute,
  getLocalizedVariantAttributes,
  getLocalizedVariantName,
  parseVariantAttributes,
} from '../../lib/variants';

interface VariantSummaryProps {
  variant: {
    name?: string | null;
    nameAr?: string | null;
    attributes?: unknown;
    attributeList?: VariantAttribute[];
  } | null | undefined;
  sku?: string | null;
  className?: string;
}

/** Which option a cart line or order item refers to: localized option name plus its attributes. */
const VariantSummary: React.FC<VariantSummaryProps> = ({ variant, sku, className = 'text-xs text-gray-500' }) => {
  const { t, i18n } = useTranslation();
  if (!variant) return null;

  const isRTL = i18n.language === 'ar';
  const name = getLocalizedVariantName(variant, isRTL);
  const attributes = getLocalizedVariantAttributes(
    variant.attributeList ?? parseVariantAttributes(variant.attributes),
    isRTL
  );
  if (!name && attributes.length === 0 && !sku) return null;

  return (
    <div className={className}>
      {name && (
        <p>
          <span>{t('variantOptions.option', 'Option')}: </span>
          <span className="font-semibold text-gray-700">{name}</span>
        </p>
      )}
      {attributes.length > 0 && (
        <p>
          {attributes.map((a, index) => (
            <span key={`${a.name}-${index}`}>
              {index > 0 && <span aria-hidden="true"> · </span>}
              {a.name}: <span className="text-gray-700">{a.value}</span>
            </span>
          ))}
        </p>
      )}
      {sku && <p className="font-mono text-gray-400">{t('product.sku', 'SKU')}: {sku}</p>}
    </div>
  );
};

export default VariantSummary;
