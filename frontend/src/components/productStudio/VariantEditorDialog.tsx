import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Circle, CircleDot, ImagePlus, Loader2, Sparkles } from 'lucide-react';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { getRequestErrorMessage, uploadImages } from '../../utils/upload';
import StudioDialog from './StudioDialog';
import { StudioField, describedBy, fieldClass } from './StudioSection';
import VariantAttributeEditor from './VariantAttributeEditor';
import {
  FieldErrors,
  IMAGE_ALT_MAX_LENGTH,
  StudioVariant,
  VariantAttributeInput,
  VariantDraft,
  draftFromVariant,
  validateVariantDraft,
} from './studioModel';
import { findDuplicateCombination, getVariantAvailability, suggestVariantName } from './variantModel';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const FIELD_IDS: Record<string, string> = {
  name: 'studio-variant-name',
  sku: 'studio-variant-sku',
  price: 'studio-variant-price',
  discountPrice: 'studio-variant-discount',
  stock: 'studio-variant-stock',
  imageAlt: 'studio-variant-alt-ar',
};

export interface VariantSubmitResult {
  fieldErrors?: FieldErrors;
  message?: string;
}

interface Props {
  open: boolean;
  variant: StudioVariant | null;
  isFirst: boolean;
  persistence: 'local' | 'immediate';
  /** Other variants of the product, for the duplicate-combination warning. */
  existingVariants: StudioVariant[];
  /** Used when the variant price is left empty. */
  basePrice: number | null;
  onClose: () => void;
  /** Resolves with errors to keep the dialog open, or nothing on success. */
  onSubmit: (draft: VariantDraft) => Promise<VariantSubmitResult | void>;
}

const Group: React.FC<{ title: string; hint?: string; children: React.ReactNode }> = ({ title, hint, children }) => (
  <section className="space-y-3 border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
    <div>
      <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
    {children}
  </section>
);

const VariantEditorDialog: React.FC<Props> = ({ open, variant, isFirst, persistence, existingVariants, basePrice, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<VariantDraft>(() => draftFromVariant(variant, isFirst));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameArTouched, setNameArTouched] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const next = draftFromVariant(variant, isFirst);
    const suggestion = suggestVariantName(next.attributes);
    setDraft(next);
    setNameTouched(!!next.name && next.name !== suggestion.name);
    setNameArTouched(!!next.nameAr && next.nameAr !== suggestion.nameAr);
    setErrors({});
    setMessage('');
    setDuplicateConfirmed(false);
  }, [open, variant, isFirst]);

  const patch = (next: Partial<VariantDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  const suggestion = suggestVariantName(draft.attributes);
  const duplicate = useMemo(
    () => findDuplicateCombination(existingVariants, draft.attributes, variant?.clientKey),
    [existingVariants, draft.attributes, variant],
  );

  const setAttributes = (attributes: VariantAttributeInput[]) => {
    const next = suggestVariantName(attributes);
    setDraft((prev) => ({
      ...prev,
      attributes,
      ...(nameTouched ? {} : { name: next.name }),
      ...(nameArTouched ? {} : { nameAr: next.nameAr }),
    }));
    setDuplicateConfirmed(false);
  };

  const useSuggestedName = () => {
    patch({ name: suggestion.name, nameAr: suggestion.nameAr });
    setNameTouched(false);
    setNameArTouched(false);
  };

  const uploadImage = async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES) {
      setErrors((prev) => ({ ...prev, image: t('productStudio.media.badFile', 'Use a JPG, PNG or WebP image up to 10 MB.') }));
      return;
    }
    setUploading(true);
    setErrors((prev) => ({ ...prev, image: '' }));
    try {
      const [url] = await uploadImages([file]);
      patch({ image: url ?? null });
    } catch (error) {
      setErrors((prev) => ({ ...prev, image: getRequestErrorMessage(error, t('productStudio.media.uploadFailed', 'Upload failed')) }));
    } finally {
      setUploading(false);
    }
  };

  const focusFirstError = (found: FieldErrors) => {
    const first = Object.keys(found).map((key) => FIELD_IDS[key]).find(Boolean);
    if (first) requestAnimationFrame(() => document.getElementById(first)?.focus());
  };

  const submit = async () => {
    const resolved = { ...draft, sku: draft.sku.trim(), price: draft.price.trim() || (basePrice ? String(basePrice) : '') };
    const found = validateVariantDraft(resolved, t as any);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage(t('productStudio.variants.fixErrors', 'Fix the highlighted fields.'));
      focusFirstError(found);
      return;
    }
    if (duplicate && !duplicateConfirmed) {
      setDuplicateConfirmed(true);
      setMessage(t('productStudio.variants.duplicateConfirm', 'Another variant has the same attributes. Change them, or save again to keep both.'));
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const result = await onSubmit(resolved);
      if (result) {
        setErrors(result.fieldErrors ?? {});
        setMessage(result.message ?? '');
        if (result.fieldErrors) focusFirstError(result.fieldErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  const price = draft.price.trim() ? parseFloat(draft.price) : basePrice ?? NaN;
  const basePriceHint = basePrice
    ? t('productStudio.variants.basePriceFallback', 'Leave empty to use the product base price ({{price}}).', { price: formatPrice(basePrice) })
    : undefined;
  const discount = parseFloat(draft.discountPrice);
  const hasDiscount = price > 0 && discount > 0 && discount < price;
  const stock = /^\d+$/.test(draft.stock.trim()) ? parseInt(draft.stock, 10) : 0;
  const availability = getVariantAvailability({ status: draft.status, stock });
  const isSavedDefault = !!variant?.isDefault && !!variant?.status && persistence === 'immediate';
  const showSuggestion = !!suggestion.name && (draft.name !== suggestion.name || draft.nameAr !== suggestion.nameAr);

  const title = variant
    ? t('productStudio.variants.editTitle', 'Edit variant')
    : t('productStudio.variants.addTitle', 'Add variant');

  return (
    <StudioDialog
      open={open}
      onClose={saving ? () => undefined : onClose}
      title={title}
      description={persistence === 'immediate'
        ? t('productStudio.variants.dialogImmediate', 'Saving here updates the variant right away. You do not need to save the product afterwards.')
        : t('productStudio.variants.dialogLocal', 'The variant is added to the list and created when you save the product.')}
      size="xl"
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose} disabled={saving}>{t('common.cancel', 'Cancel')}</button>
          <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={submit} disabled={saving || uploading}>
            {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {persistence === 'immediate'
              ? t('productStudio.variants.saveNow', 'Save variant')
              : (variant ? t('productStudio.variants.updateLocal', 'Update variant') : t('productStudio.variants.addLocal', 'Add to list'))}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {message && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{message}</p>}

        <Group title={t('productStudio.variants.groupIdentity', 'Name and SKU')}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StudioField id="studio-variant-name" label={t('productStudio.variants.nameEn', 'Variant name (English)')} required error={errors.name}>
              <input
                id="studio-variant-name"
                dir="ltr"
                value={draft.name}
                onChange={(e) => { patch({ name: e.target.value }); setNameTouched(!!e.target.value); }}
                className={fieldClass(!!errors.name)}
                aria-invalid={!!errors.name}
                aria-describedby={describedBy('studio-variant-name', errors.name)}
                placeholder={t('productStudio.variants.namePlaceholder', 'e.g. 2 L / Black')}
              />
            </StudioField>
            <StudioField id="studio-variant-name-ar" label={t('productStudio.variants.nameAr', 'Variant name (Arabic)')}>
              <input
                id="studio-variant-name-ar"
                dir="rtl"
                value={draft.nameAr}
                onChange={(e) => { patch({ nameAr: e.target.value }); setNameArTouched(!!e.target.value); }}
                className={fieldClass()}
                placeholder="مثال: سعة 2 لتر / أسود"
              />
            </StudioField>
          </div>
          {showSuggestion && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
              <Sparkles size={13} className="text-primary-600" aria-hidden="true" />
              <span>
                {t('productStudio.variants.suggestedName', 'Suggested name')}: <span className="font-semibold" dir="ltr">{suggestion.name}</span>
                {suggestion.nameAr !== suggestion.name && <> · <span className="font-semibold" dir="rtl">{suggestion.nameAr}</span></>}
              </span>
              <button type="button" onClick={useSuggestedName} className="font-semibold text-primary-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                {t('productStudio.variants.useSuggestedName', 'Use suggested name')}
              </button>
            </div>
          )}
          <StudioField id="studio-variant-sku" label="SKU" error={errors.sku} hint={t('productStudio.variants.skuHint', 'Leave empty to generate a SKU automatically.')} className="md:w-1/2">
            <input
              id="studio-variant-sku"
              dir="ltr"
              value={draft.sku}
              onChange={(e) => patch({ sku: e.target.value })}
              onBlur={() => patch({ sku: draft.sku.trim() })}
              className={fieldClass(!!errors.sku, 'font-mono')}
              aria-invalid={!!errors.sku}
              aria-describedby={describedBy('studio-variant-sku', errors.sku, 'hint')}
              placeholder={t('productStudio.variants.skuPlaceholder', 'Optional')}
            />
          </StudioField>
        </Group>

        <Group title={t('productStudio.variants.groupAttributes', 'Attributes')}>
          <VariantAttributeEditor attributes={draft.attributes} error={errors.attributes} onChange={setAttributes} />
          {duplicate && (
            <p role="status" className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {t('productStudio.variants.duplicateWarning', 'Another variant already has the same attributes: {{name}}.', { name: duplicate.name })}
            </p>
          )}
        </Group>

        <Group title={t('productStudio.variants.groupPricing', 'Pricing')}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <StudioField id="studio-variant-price" label={`${t('productStudio.pricing.basePrice', 'Base price')} (${t('common.currency', 'EGP')})`} required={!basePrice} error={errors.price} hint={basePriceHint}>
              <input id="studio-variant-price" type="number" inputMode="decimal" min="0" step="0.01" value={draft.price} placeholder={basePrice ? String(basePrice) : undefined} onChange={(e) => patch({ price: e.target.value })} className={fieldClass(!!errors.price)} aria-invalid={!!errors.price} aria-describedby={describedBy('studio-variant-price', errors.price, basePriceHint)} />
            </StudioField>
            <StudioField id="studio-variant-discount" label={t('productStudio.variants.discountPrice', 'Discount price')} error={errors.discountPrice} hint={t('productStudio.variants.discountHint', 'Leave empty if there is no discount.')}>
              <input id="studio-variant-discount" type="number" inputMode="decimal" min="0" step="0.01" value={draft.discountPrice} onChange={(e) => patch({ discountPrice: e.target.value })} className={fieldClass(!!errors.discountPrice)} aria-invalid={!!errors.discountPrice} aria-describedby={describedBy('studio-variant-discount', errors.discountPrice, 'hint')} />
            </StudioField>
            <div>
              <span className="block text-sm font-semibold text-gray-800 mb-1">{t('productStudio.variants.customerPrice', 'Customer price')}</span>
              <output htmlFor="studio-variant-price studio-variant-discount" aria-live="polite" className="flex items-baseline gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 min-h-[42px]">
                {price > 0 ? (
                  <>
                    <span className="text-lg font-bold text-primary-700">{formatPrice(hasDiscount ? discount : price)}</span>
                    {hasDiscount && <span className="text-xs text-gray-400 line-through">{formatPrice(price)}</span>}
                  </>
                ) : <span className="text-sm text-gray-400">—</span>}
              </output>
            </div>
          </div>
        </Group>

        <Group title={t('productStudio.variants.groupInventory', 'Inventory and availability')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <StudioField id="studio-variant-stock" label={t('productStudio.inventory.stock', 'Stock quantity')} required error={errors.stock} hint={t('productStudio.variants.stockHint', '0 is allowed: the variant shows as out of stock.')}>
              <input id="studio-variant-stock" type="number" inputMode="numeric" min="0" step="1" value={draft.stock} onChange={(e) => patch({ stock: e.target.value })} className={fieldClass(!!errors.stock)} aria-invalid={!!errors.stock} aria-describedby={describedBy('studio-variant-stock', errors.stock, 'hint')} />
            </StudioField>
            <fieldset className="md:col-span-2">
              <legend className="block text-sm font-semibold text-gray-800 mb-1">{t('productStudio.variants.availability', 'Availability')}</legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([true, false] as const).map((active) => (
                  <label key={String(active)} className={`flex items-start gap-2 rounded-lg border p-2.5 text-sm cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${draft.status === active ? 'border-primary-500 bg-primary-50' : 'border-gray-200'}`}>
                    <input
                      type="radio"
                      name="studio-variant-status"
                      checked={draft.status === active}
                      onChange={() => patch({ status: active, isDefault: active && draft.isDefault })}
                      className="mt-0.5 accent-primary-600"
                    />
                    <span>
                      <span className="font-semibold text-gray-800">{active ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}</span>
                      <span className="block text-xs text-gray-500">
                        {active
                          ? t('productStudio.variants.activeHelp', 'Customers can choose this variant while it has stock.')
                          : t('productStudio.variants.inactiveHelp', 'Kept saved, but not available to buy and left out of the total stock.')}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 text-xs" aria-live="polite">
                {availability === 'available' && <span className="text-green-700">{t('productStudio.variants.stateAvailable', 'Available for sale.')}</span>}
                {availability === 'outOfStock' && <span className="text-amber-700">{t('productStudio.variants.stateOutOfStock', 'Out of stock, but still a valid option. It becomes available when you add stock.')}</span>}
                {availability === 'inactive' && <span className="text-gray-500">{t('productStudio.variants.stateInactive', 'Not available for sale.')}</span>}
              </p>
            </fieldset>
          </div>
        </Group>

        <Group title={t('productStudio.variants.groupDefault', 'Catalog default')}>
          <button
            type="button"
            aria-pressed={draft.status && draft.isDefault}
            aria-describedby="studio-variant-default-help"
            disabled={!draft.status || isSavedDefault}
            onClick={() => patch({ isDefault: !draft.isDefault })}
            className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm text-start disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${draft.status && draft.isDefault ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 text-gray-800'} ${!draft.status ? 'opacity-60' : ''}`}
          >
            {draft.status && draft.isDefault
              ? <CircleDot size={18} className="text-primary-600 shrink-0" aria-hidden="true" />
              : <Circle size={18} className="text-gray-400 shrink-0" aria-hidden="true" />}
            <span className="font-semibold">{t('productStudio.variants.makeDefault', "Make this the product's default option")}</span>
          </button>
          <p id="studio-variant-default-help" className="text-xs text-gray-500">
            {!draft.status
              ? t('productStudio.variants.inactiveNoDefault', 'Inactive variants cannot be the default.')
              : isSavedDefault
                ? t('productStudio.variants.isDefaultNote', 'This is the default option. To change it, choose another variant as the default.')
                : t('productStudio.variants.defaultHelp', 'The default option is shown first to customers and sets the price shown on catalog cards.')}
          </p>
        </Group>

        <Group title={t('productStudio.variants.groupMedia', 'Variant image')} hint={t('productStudio.variants.imageHint', 'Optional. Shown when a customer selects this variant. JPG, PNG or WebP, converted to WebP automatically.')}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            <div>
              <div className="relative aspect-square rounded-xl border border-dashed border-gray-300 bg-gray-50 overflow-hidden flex items-center justify-center">
                {draft.image ? (
                  <img src={getImageUrl(draft.image)} alt={draft.imageAlt || draft.name} className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus size={28} className="text-gray-300" aria-hidden="true" />
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center" role="status">
                    <Loader2 className="animate-spin" size={20} aria-label={t('productStudio.media.uploading', 'Uploading and optimizing…')} />
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="btn-outline text-xs px-3 py-1.5" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {draft.image ? t('productStudio.media.replace', 'Replace image') : t('productStudio.variants.uploadImage', 'Upload image')}
                </button>
                {draft.image && (
                  <button type="button" className="text-xs font-semibold text-red-600 hover:underline" onClick={() => patch({ image: null })}>
                    {t('productStudio.media.remove', 'Remove image')}
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="sr-only"
                tabIndex={-1}
                accept={ACCEPTED_TYPES.join(',')}
                aria-label={t('productStudio.variants.uploadImage', 'Upload image')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImage(file);
                  e.target.value = '';
                }}
              />
              {errors.image && <p role="alert" className="text-xs text-red-600 mt-1">{errors.image}</p>}
            </div>
            <div className="md:col-span-2 space-y-3">
              <StudioField id="studio-variant-alt-ar" label={t('productStudio.variants.imageAltAr', 'Image description (Arabic)')} error={errors.imageAlt} hint={t('productStudio.variants.altHint', 'Describe the image in a way that sets this variant apart.')}>
                <input id="studio-variant-alt-ar" dir="rtl" maxLength={IMAGE_ALT_MAX_LENGTH} value={draft.imageAltAr} onChange={(e) => patch({ imageAltAr: e.target.value })} className={fieldClass(!!errors.imageAlt)} disabled={!draft.image} placeholder="مثال: غلاية ستانلس ستيل سعة 2 لتر" aria-describedby={describedBy('studio-variant-alt-ar', errors.imageAlt, 'hint')} />
              </StudioField>
              <StudioField id="studio-variant-alt-en" label={t('productStudio.variants.imageAltEn', 'Image description (English)')}>
                <input id="studio-variant-alt-en" dir="ltr" maxLength={IMAGE_ALT_MAX_LENGTH} value={draft.imageAlt} onChange={(e) => patch({ imageAlt: e.target.value })} className={fieldClass()} disabled={!draft.image} placeholder="e.g. 2 L stainless steel kettle" />
              </StudioField>
              <p className="text-xs text-gray-500">
                {draft.image
                  ? t('productStudio.variants.altFallback', 'Without a description, the variant name is used.')
                  : t('productStudio.variants.altNeedsImage', 'Upload an image to add its description.')}
              </p>
            </div>
          </div>
        </Group>
      </div>
    </StudioDialog>
  );
};

export default VariantEditorDialog;
