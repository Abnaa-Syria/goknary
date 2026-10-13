import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, Plus } from 'lucide-react';
import { formatPrice } from '../../lib/utils';
import StudioDialog from './StudioDialog';
import { StudioField, describedBy, fieldClass } from './StudioSection';
import VariantGeneratorAttribute from './VariantGeneratorAttribute';
import { StudioVariant } from './studioModel';
import {
  GENERATOR_CONFIRM_THRESHOLD,
  GeneratorDimension,
  countCombinations,
  emptyDimension,
  generateCombinations,
  planGeneratedVariants,
  usableDimensions,
} from './variantModel';

const PREVIEW_LIMIT = 12;

interface Props {
  open: boolean;
  persistence: 'local' | 'immediate';
  existingVariants: StudioVariant[];
  /** Used when the shared price is left empty. */
  basePrice: number | null;
  /** Saved-mode progress while variants are being created one by one. */
  progress: { done: number; total: number } | null;
  onClose: () => void;
  onGenerate: (variants: StudioVariant[]) => Promise<void>;
}

const VariantGeneratorDialog: React.FC<Props> = ({ open, persistence, existingVariants, basePrice, progress, onClose, onGenerate }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [dimensions, setDimensions] = useState<GeneratorDimension[]>([emptyDimension()]);
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [confirmedLarge, setConfirmedLarge] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = progress !== null;

  useEffect(() => {
    if (open) {
      setDimensions([emptyDimension()]);
      setPrice('');
      setStock('0');
      setConfirmedLarge(false);
      setErrors({});
    }
  }, [open]);

  const count = countCombinations(dimensions);
  const large = count > GENERATOR_CONFIRM_THRESHOLD;
  // Combinations are only materialised for reasonable counts or after the user confirms a large run.
  const plan = useMemo(() => {
    if (count === 0 || (large && !confirmedLarge)) return null;
    return planGeneratedVariants(generateCombinations(dimensions), existingVariants, { price: 0, stock: 0 });
  }, [count, large, confirmedLarge, dimensions, existingVariants]);
  const toCreate = plan ? plan.variants.length : count;

  const updateDimension = (index: number, next: GeneratorDimension) => {
    setDimensions((prev) => prev.map((d, i) => (i === index ? next : d)));
    setConfirmedLarge(false);
  };

  const submit = async () => {
    const found: Record<string, string> = {};
    dimensions.forEach((d) => {
      const hasValues = d.values.length > 0;
      if (!d.name.trim() && hasValues) found[d.key] = t('productStudio.generator.errors.name', 'Enter the attribute name in English.');
      else if (d.name.trim() && !hasValues) found[d.key] = t('productStudio.generator.errors.values', 'Add at least one value.');
    });
    if (usableDimensions(dimensions).length === 0) found.general = t('productStudio.generator.errors.none', 'Add at least one attribute with a name and values.');
    const sharedPrice = price.trim() ? parseFloat(price) : basePrice ?? NaN;
    if (!(sharedPrice > 0)) found.price = t('productStudio.errors.pricePositive', 'Price must be greater than 0.');
    if (!/^\d+$/.test(stock.trim())) found.stock = t('productStudio.errors.stockInteger', 'Stock must be a whole number of 0 or more.');
    setErrors(found);
    if (Object.keys(found).length || !plan || plan.variants.length === 0) return;
    const shared = { price: sharedPrice, stock: parseInt(stock, 10) };
    await onGenerate(plan.variants.map((v) => ({ ...v, price: shared.price, stock: shared.stock })));
  };

  const label = (v: StudioVariant) => (isRTL && v.nameAr ? v.nameAr : v.name);

  return (
    <StudioDialog
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={t('productStudio.generator.title', 'Create several variants')}
      description={t('productStudio.generator.intro', 'Define the attributes and their values, and every possible combination is prepared for you. You can edit each variant afterwards.')}
      size="xl"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel', 'Cancel')}</button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={submit}
            disabled={busy || count === 0 || (large && !confirmedLarge) || toCreate === 0}
          >
            {busy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {busy
              ? t('productStudio.generator.progress', 'Creating {{done}} of {{total}}…', { done: progress?.done ?? 0, total: progress?.total ?? 0 })
              : t('productStudio.generator.submit', 'Create {{count}} variants', { count: toCreate })}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.general && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{errors.general}</p>}

        {dimensions.map((dimension, index) => (
          <VariantGeneratorAttribute
            key={dimension.key}
            index={index}
            dimension={dimension}
            error={errors[dimension.key]}
            canRemove={dimensions.length > 1}
            onChange={(next) => updateDimension(index, next)}
            onRemove={() => {
              setDimensions((prev) => prev.filter((d) => d.key !== dimension.key));
              setConfirmedLarge(false);
            }}
          />
        ))}
        <button
          type="button"
          onClick={() => setDimensions((prev) => [...prev, emptyDimension()])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        >
          <Plus size={14} aria-hidden="true" /> {t('productStudio.generator.addAttribute', 'Add another attribute')}
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl bg-gray-50 p-3">
          <StudioField
            id="studio-gen-price"
            label={`${t('productStudio.generator.price', 'Price for each variant')} (${t('common.currency', 'EGP')})`}
            required={!basePrice}
            error={errors.price}
            hint={basePrice
              ? t('productStudio.generator.priceFallbackHint', 'Leave empty to use the product base price ({{price}}). You can change each variant afterwards.', { price: formatPrice(basePrice) })
              : t('productStudio.generator.priceHint', 'You can change the price of each variant afterwards.')}
          >
            <input id="studio-gen-price" type="number" inputMode="decimal" min="0" step="0.01" value={price} placeholder={basePrice ? String(basePrice) : undefined} onChange={(e) => setPrice(e.target.value)} className={fieldClass(!!errors.price)} aria-invalid={!!errors.price} aria-describedby={describedBy('studio-gen-price', errors.price, 'hint')} />
          </StudioField>
          <StudioField id="studio-gen-stock" label={t('productStudio.generator.stock', 'Stock for each variant')} required error={errors.stock} hint={t('productStudio.generator.stockHint', 'Usually 0; set the real stock per variant afterwards.')}>
            <input id="studio-gen-stock" type="number" inputMode="numeric" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className={fieldClass(!!errors.stock)} aria-invalid={!!errors.stock} aria-describedby={describedBy('studio-gen-stock', errors.stock, 'hint')} />
          </StudioField>
        </div>

        <section aria-labelledby="studio-gen-preview-title" className="rounded-xl border border-gray-200 p-3 space-y-2" aria-live="polite">
          <h3 id="studio-gen-preview-title" className="text-sm font-bold text-gray-900">
            {count === 0
              ? t('productStudio.generator.previewEmpty', 'Add attribute values to see the variants that will be created.')
              : t('productStudio.generator.previewCount', '{{count}} variants will be created.', { count: toCreate })}
          </h3>
          {plan && plan.skipped > 0 && (
            <p className="text-xs text-amber-700">
              {t('productStudio.generator.skipped', '{{count}} combinations already exist in this product and will be skipped.', { count: plan.skipped })}
            </p>
          )}
          {large && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="space-y-1.5">
                <p>{t('productStudio.generator.largeWarning', 'This creates {{count}} variants. Make sure every combination is really sold; you will need to set stock for each one.', { count })}</p>
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" checked={confirmedLarge} onChange={(e) => setConfirmedLarge(e.target.checked)} className="w-4 h-4 accent-primary-600" />
                  {t('productStudio.generator.largeConfirm', 'Yes, prepare {{count}} variants', { count })}
                </label>
              </div>
            </div>
          )}
          {plan && plan.variants.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-700 list-disc ps-5">
              {plan.variants.slice(0, PREVIEW_LIMIT).map((v) => <li key={v.clientKey}>{label(v)}</li>)}
            </ul>
          )}
          {plan && plan.variants.length > PREVIEW_LIMIT && (
            <p className="text-xs text-gray-500">{t('productStudio.generator.more', 'and {{count}} more', { count: plan.variants.length - PREVIEW_LIMIT })}</p>
          )}
          {plan && plan.variants.length > 0 && (
            <p className="text-[11px] text-gray-500">
              {persistence === 'immediate'
                ? t('productStudio.generator.immediateNote', 'Each variant is saved to the product as it is created. Names, SKUs and images can be edited afterwards.')
                : t('productStudio.generator.localNote', 'The variants are added to the list and created when you save the product.')}
            </p>
          )}
        </section>
      </div>
    </StudioDialog>
  );
};

export default VariantGeneratorDialog;
