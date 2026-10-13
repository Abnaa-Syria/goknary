import React from 'react';
import { useTranslation } from 'react-i18next';
import { Layers, Tag } from 'lucide-react';
import { ProductType } from './studioModel';

interface Props {
  value: ProductType;
  onChange: (type: ProductType) => void;
  /** Why a type cannot be chosen right now (e.g. existing variants would be lost). */
  lockedReason?: Partial<Record<ProductType, string>>;
  note?: string;
}

const ProductTypeSelector: React.FC<Props> = ({ value, onChange, lockedReason = {}, note }) => {
  const { t } = useTranslation();
  const options: Array<{ type: ProductType; title: string; text: string; example: string; Icon: typeof Tag }> = [
    {
      type: 'SIMPLE',
      title: t('productStudio.type.simple', 'Simple product'),
      text: t('productStudio.type.simpleHelp', 'One price and one stock quantity, with no different selling options.'),
      example: t('productStudio.type.simpleExample', 'e.g. a 1200 W blender sold in one version'),
      Icon: Tag,
    },
    {
      type: 'VARIANTS',
      title: t('productStudio.type.variants', 'Product with variants'),
      text: t('productStudio.type.variantsHelp', 'Use it when the product differs by capacity, color, size, material, pack, length or any other option.'),
      example: t('productStudio.type.variantsExample', 'e.g. a phone in 128 GB and 256 GB, or a juice in packs of 6 and 12'),
      Icon: Layers,
    },
  ];

  return (
    <fieldset className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <legend className="sr-only">{t('productStudio.type.title', 'Product type')}</legend>
      <p className="text-lg font-bold text-gray-900 mb-3" aria-hidden="true">{t('productStudio.type.title', 'Product type')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map(({ type, title, text, example, Icon }) => {
          const locked = lockedReason[type];
          const selected = value === type;
          return (
            <label
              key={type}
              className={`relative flex gap-3 rounded-xl border p-4 transition-colors ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500' : 'border-gray-200 hover:border-gray-300'} focus-within:ring-2 focus-within:ring-primary-500`}
            >
              <input
                type="radio"
                name="studio-product-type"
                value={type}
                checked={selected}
                disabled={!!locked}
                onChange={() => onChange(type)}
                className="mt-1 accent-primary-600"
                aria-describedby={`studio-type-${type}-help`}
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-semibold text-gray-900">
                  <Icon size={16} className="text-primary-600" aria-hidden="true" /> {title}
                </span>
                <span id={`studio-type-${type}-help`} className="block text-xs text-gray-600 mt-1">
                  {locked || text}
                </span>
                {!locked && <span className="block text-[11px] text-gray-500 mt-1 italic">{example}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {note && <p className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">{note}</p>}
    </fieldset>
  );
};

export default ProductTypeSelector;
