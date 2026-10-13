import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';
import { VariantAttributeInput, emptyAttribute } from './studioModel';

/** Category-agnostic examples, rotated per row so no single industry is implied. */
const EXAMPLES = [
  { name: 'Storage', nameAr: 'السعة التخزينية', value: '256 GB', valueAr: '٢٥٦ جيجابايت' },
  { name: 'Capacity', nameAr: 'السعة', value: '2 L', valueAr: '٢ لتر' },
  { name: 'Pack Size', nameAr: 'حجم العبوة', value: '6 Pieces', valueAr: '٦ قطع' },
  { name: 'Material', nameAr: 'الخامة', value: 'Stainless Steel', valueAr: 'ستانلس ستيل' },
  { name: 'Length', nameAr: 'الطول', value: '2 Meter', valueAr: '٢ متر' },
];

interface Props {
  attributes: VariantAttributeInput[];
  error?: string;
  onChange: (attributes: VariantAttributeInput[]) => void;
}

const VariantAttributeEditor: React.FC<Props> = ({ attributes, error, onChange }) => {
  const { t } = useTranslation();
  const listRef = useRef<HTMLOListElement>(null);
  const update = (index: number, patch: Partial<VariantAttributeInput>) =>
    onChange(attributes.map((attr, i) => (i === index ? { ...attr, ...patch } : attr)));

  const focusRow = (index: number) =>
    requestAnimationFrame(() => listRef.current?.querySelector<HTMLInputElement>(`[data-attr-row="${index}"]`)?.focus());

  const addRow = () => {
    onChange([...attributes, emptyAttribute()]);
    focusRow(attributes.length);
  };

  /** Enter on a value field of the last complete row adds the next row instead of submitting anything. */
  const onValueKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const row = attributes[index];
    if (index === attributes.length - 1 && row.name.trim() && row.value.trim()) addRow();
    else if (index < attributes.length - 1) focusRow(index + 1);
  };

  return (
    <fieldset aria-describedby={error ? 'studio-variant-attributes-error' : 'studio-variant-attributes-hint'}>
      <legend className="text-sm font-semibold text-gray-800">
        {t('productStudio.variants.attributes', 'Attributes')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span>
      </legend>
      <p id="studio-variant-attributes-hint" className="text-xs text-gray-500 mb-2">
        {t('productStudio.variants.attributesHint', 'Use attributes to show how this option differs from the others, e.g. Capacity: 2 L or Material: Glass.')}
      </p>
      <div className="hidden lg:grid grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-2 px-3 text-[11px] font-semibold text-gray-500">
        <span>{t('productStudio.variants.attrNameEnHeader', 'Attribute (English)')}</span>
        <span>{t('productStudio.variants.attrNameArHeader', 'Attribute (Arabic)')}</span>
        <span>{t('productStudio.variants.attrValueEnHeader', 'Value (English)')}</span>
        <span>{t('productStudio.variants.attrValueArHeader', 'Value (Arabic)')}</span>
        <span />
      </div>
      <ol ref={listRef} className="space-y-2 mt-1">
        {attributes.map((attr, index) => {
          const example = EXAMPLES[index % EXAMPLES.length];
          const n = index + 1;
          return (
            <li key={index} className="rounded-xl border border-gray-200 bg-gray-50 p-2.5">
              <div className="grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_2rem] gap-2 items-center">
                <input
                  data-attr-row={index}
                  dir="ltr"
                  value={attr.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                  className="input-field w-full text-sm"
                  aria-label={t('productStudio.variants.attrNameEn', 'Attribute name (English) {{n}}', { n })}
                  placeholder={example.name}
                />
                <input
                  dir="rtl"
                  value={attr.nameAr}
                  onChange={(e) => update(index, { nameAr: e.target.value })}
                  className="input-field w-full text-sm"
                  aria-label={t('productStudio.variants.attrNameAr', 'Attribute name (Arabic) {{n}}', { n })}
                  placeholder={example.nameAr}
                />
                <input
                  dir="ltr"
                  value={attr.value}
                  onChange={(e) => update(index, { value: e.target.value })}
                  onKeyDown={onValueKeyDown(index)}
                  className="input-field w-full text-sm"
                  aria-label={t('productStudio.variants.attrValueEn', 'Attribute value (English) {{n}}', { n })}
                  placeholder={example.value}
                />
                <input
                  dir="rtl"
                  value={attr.valueAr}
                  onChange={(e) => update(index, { valueAr: e.target.value })}
                  onKeyDown={onValueKeyDown(index)}
                  className="input-field w-full text-sm"
                  aria-label={t('productStudio.variants.attrValueAr', 'Attribute value (Arabic) {{n}}', { n })}
                  placeholder={example.valueAr}
                />
                <button
                  type="button"
                  onClick={() => onChange(attributes.length > 1 ? attributes.filter((_, i) => i !== index) : [emptyAttribute()])}
                  className="justify-self-end p-1.5 rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  aria-label={t('productStudio.variants.removeAttribute', 'Remove attribute {{n}}', { n })}
                  title={t('productStudio.variants.removeAttribute', 'Remove attribute {{n}}', { n })}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ol>
      {error && <p id="studio-variant-attributes-error" role="alert" className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
      <button
        type="button"
        onClick={addRow}
        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
      >
        <Plus size={14} aria-hidden="true" /> {t('productStudio.variants.addAttribute', 'Add attribute')}
      </button>
      <p className="mt-1 text-[11px] text-gray-400">{t('productStudio.variants.enterHint', 'Tip: press Enter in a value field to add the next attribute.')}</p>
    </fieldset>
  );
};

export default VariantAttributeEditor;
