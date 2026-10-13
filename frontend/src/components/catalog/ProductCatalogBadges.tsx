import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Layers, XCircle } from 'lucide-react';
import { CatalogProduct, getInventoryState } from '../../lib/productCatalog';

const INVENTORY_STYLES = {
  in_stock: { className: 'text-green-700 bg-green-50 border-green-200', Icon: CheckCircle2 },
  low_stock: { className: 'text-amber-800 bg-amber-50 border-amber-200', Icon: AlertTriangle },
  out_of_stock: { className: 'text-red-700 bg-red-50 border-red-200', Icon: XCircle },
} as const;

/** Stock state in words and an icon (never color alone), with the quantity. */
export const ProductInventoryBadge: React.FC<{ product: CatalogProduct }> = ({ product }) => {
  const { t } = useTranslation();
  const state = getInventoryState(product);
  const { className, Icon } = INVENTORY_STYLES[state];
  const derived = product.variantCount > 0;
  return (
    <div className="flex flex-col items-start gap-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${className}`}>
        <Icon size={12} aria-hidden="true" />
        {t(`catalog.inventory.${state}`)}
      </span>
      <span className="text-xs text-gray-600 tabular-nums">
        {t('catalog.inventory.units', { count: product.stock })}
        {derived && (
          <span className="inline-flex items-center gap-1 ms-1 text-gray-500" title={t('catalog.inventory.derivedHint')}>
            <Layers size={11} aria-hidden="true" />
            <span className="sr-only">{t('catalog.inventory.derivedHint')}</span>
            <span aria-hidden="true">{t('catalog.inventory.derivedShort')}</span>
          </span>
        )}
      </span>
    </div>
  );
};

interface VariantCountProps {
  product: CatalogProduct;
  /** When set, the count links to the product's variants in Product Studio. */
  onOpen?: () => void;
}

export const ProductVariantCount: React.FC<VariantCountProps> = ({ product, onOpen }) => {
  const { t } = useTranslation();
  if (!product.variantCount) {
    return (
      <span className="text-gray-400">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t('catalog.variants.none')}</span>
      </span>
    );
  }
  const label = t('catalog.variants.count', { count: product.variantCount });
  const content = (
    <>
      <Layers size={13} aria-hidden="true" />
      {label}
    </>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex items-center gap-1 min-h-[32px] text-xs font-semibold text-gray-800 underline decoration-dotted underline-offset-2 hover:text-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
      aria-label={t('catalog.variants.open', { count: product.variantCount })}
    >
      {content}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-800">{content}</span>
  );
};

const REASON_PREVIEW_LENGTH = 90;

/** Rejection reason inline: a short preview with an expand toggle, so nobody has to open the editor to read it. */
export const ProductRejectionReason: React.FC<{ reason?: string | null; id: string }> = ({ reason, id }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const text = reason?.trim();
  if (!text) return null;
  const long = text.length > REASON_PREVIEW_LENGTH;
  const shown = expanded || !long ? text : `${text.slice(0, REASON_PREVIEW_LENGTH).trimEnd()}…`;
  return (
    <div className="mt-1.5 max-w-xs rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
      <span className="font-semibold">{t('moderation.rejectionReason', 'Rejection reason')}: </span>
      <span id={`reason-${id}`} className="whitespace-pre-line break-words">{shown}</span>
      {long && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`reason-${id}`}
          className="ms-1 inline-flex items-center min-h-[28px] px-1 font-semibold underline focus:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded"
        >
          {expanded ? t('catalog.reason.less') : t('catalog.reason.view')}
        </button>
      )}
    </div>
  );
};
