import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, X } from 'lucide-react';
import { GeneratorDimension, generatorValue } from './variantModel';

const EXAMPLES = [
  { name: 'Storage', nameAr: 'السعة التخزينية', value: '128 GB', valueAr: '١٢٨ جيجابايت' },
  { name: 'Material', nameAr: 'الخامة', value: 'Glass', valueAr: 'زجاج' },
  { name: 'Flavor', nameAr: 'النكهة', value: 'Vanilla', valueAr: 'فانيليا' },
  { name: 'Connector', nameAr: 'نوع الموصل', value: 'USB-C', valueAr: 'USB-C' },
];

interface Props {
  index: number;
  dimension: GeneratorDimension;
  error?: string;
  canRemove: boolean;
  onChange: (dimension: GeneratorDimension) => void;
  onRemove: () => void;
}

const normalize = (text: string) => text.trim().toLowerCase();

const VariantGeneratorAttribute: React.FC<Props> = ({ index, dimension, error, canRemove, onChange, onRemove }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [valueAr, setValueAr] = useState('');
  const [notice, setNotice] = useState('');
  const valueRef = useRef<HTMLInputElement>(null);
  const example = EXAMPLES[index % EXAMPLES.length];
  const n = index + 1;
  const idBase = `studio-gen-${dimension.key}`;

  /** Adds the typed value; "S, M, L" (English only) adds several values at once. */
  const addValue = () => {
    const raw = value.trim();
    if (!raw) {
      valueRef.current?.focus();
      return;
    }
    const parts = !valueAr.trim() && raw.includes(',') ? raw.split(',').map((p) => p.trim()).filter(Boolean) : [raw];
    const existing = new Set(dimension.values.map((v) => normalize(v.value)));
    const fresh = parts.filter((p) => {
      if (existing.has(normalize(p))) return false;
      existing.add(normalize(p));
      return true;
    });
    setNotice(fresh.length < parts.length ? t('productStudio.generator.valueExists', 'Values that are already in the list were skipped.') : '');
    if (fresh.length) {
      onChange({
        ...dimension,
        values: [...dimension.values, ...fresh.map((p) => generatorValue(p, parts.length === 1 ? valueAr : ''))],
      });
    }
    setValue('');
    setValueAr('');
    valueRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addValue();
    }
  };

  return (
    <fieldset className="rounded-xl border border-gray-200 p-3 space-y-3" aria-describedby={error ? `${idBase}-error` : undefined}>
      <div className="flex items-center justify-between">
        <legend className="text-sm font-bold text-gray-900">{t('productStudio.generator.attributeN', 'Attribute {{n}}', { n })}</legend>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={t('productStudio.generator.removeAttribute', 'Remove attribute {{n}}', { n })}
            title={t('productStudio.generator.removeAttribute', 'Remove attribute {{n}}', { n })}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${idBase}-name`} className="block text-xs font-semibold text-gray-700 mb-1">
            {t('productStudio.generator.nameEn', 'Attribute name (English)')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span>
          </label>
          <input id={`${idBase}-name`} dir="ltr" value={dimension.name} onChange={(e) => onChange({ ...dimension, name: e.target.value })} className="input-field w-full text-sm" placeholder={example.name} />
        </div>
        <div>
          <label htmlFor={`${idBase}-name-ar`} className="block text-xs font-semibold text-gray-700 mb-1">{t('productStudio.generator.nameAr', 'Attribute name (Arabic)')}</label>
          <input id={`${idBase}-name-ar`} dir="rtl" value={dimension.nameAr} onChange={(e) => onChange({ ...dimension, nameAr: e.target.value })} className="input-field w-full text-sm" placeholder={example.nameAr} />
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-700 mb-1" id={`${idBase}-values`}>{t('productStudio.generator.values', 'Values')}</p>
        {dimension.values.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5 mb-2" aria-labelledby={`${idBase}-values`}>
            {dimension.values.map((v) => {
              const label = v.valueAr && v.valueAr !== v.value ? `${v.value} / ${v.valueAr}` : v.value;
              return (
                <li key={v.key} className="inline-flex items-center gap-1 rounded-full bg-gray-100 ps-2.5 pe-1 py-0.5 text-xs text-gray-800">
                  <span>{label}</span>
                  <button
                    type="button"
                    onClick={() => onChange({ ...dimension, values: dimension.values.filter((x) => x.key !== v.key) })}
                    className="p-0.5 rounded-full text-gray-500 hover:bg-gray-200 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    aria-label={t('productStudio.generator.removeValue', 'Remove value {{value}}', { value: label })}
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-xs text-gray-400 mb-2">{t('productStudio.generator.noValues', 'No values yet.')}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
          <input
            ref={valueRef}
            dir="ltr"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            className="input-field w-full text-sm"
            aria-label={t('productStudio.generator.valueEn', 'New value (English) for attribute {{n}}', { n })}
            placeholder={example.value}
          />
          <input
            dir="rtl"
            value={valueAr}
            onChange={(e) => setValueAr(e.target.value)}
            onKeyDown={onKeyDown}
            className="input-field w-full text-sm"
            aria-label={t('productStudio.generator.valueAr', 'New value (Arabic) for attribute {{n}}', { n })}
            placeholder={example.valueAr}
          />
          <button type="button" onClick={addValue} className="btn-outline inline-flex items-center justify-center gap-1 text-sm px-3">
            <Plus size={14} aria-hidden="true" /> {t('productStudio.generator.addValue', 'Add value')}
          </button>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">{t('productStudio.generator.valueHint', 'Press Enter to add. Separate several English values with commas.')}</p>
        {notice && <p className="mt-1 text-xs text-amber-700" role="status">{notice}</p>}
      </div>
      {error && <p id={`${idBase}-error`} className="text-xs text-red-600 font-medium">{error}</p>}
    </fieldset>
  );
};

export default VariantGeneratorAttribute;
