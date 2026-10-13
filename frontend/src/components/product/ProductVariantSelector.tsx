import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import {
  CustomerVariant,
  OptionState,
  buildVariantMatrix,
  getLocalizedOptionName,
  getLocalizedOptionValue,
  getOptionState,
  resolveOptionChoice,
} from '../../lib/variantSelection';
import { getLocalizedVariantAttributes, getLocalizedVariantName, parseVariantAttributes } from '../../lib/variants';

interface Props {
  variants: CustomerVariant[];
  selected: CustomerVariant | null;
  onSelect: (variant: CustomerVariant) => void;
}

const chipClass = (selected: boolean, state: OptionState) => {
  const base = 'relative min-h-[44px] min-w-[3rem] px-3.5 py-2 rounded-lg border-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1';
  if (selected) return `${base} border-primary-500 bg-primary-50 text-primary-800`;
  if (state === 'unavailableWithSelection') return `${base} border-dashed border-gray-300 bg-white text-gray-400`;
  if (state === 'outOfStock') return `${base} border-gray-200 bg-gray-50 text-gray-500 line-through decoration-gray-400`;
  return `${base} border-gray-200 bg-white text-gray-800 hover:border-gray-400`;
};

const OptionChip: React.FC<{
  label: string;
  selected: boolean;
  state: OptionState;
  onClick: () => void;
}> = ({ label, selected, state, onClick }) => {
  const { t } = useTranslation();
  const note = state === 'outOfStock'
    ? t('variantOptions.outOfStock', 'Out of stock')
    : state === 'unavailableWithSelection'
      ? t('variantOptions.unavailableWithSelection', 'Unavailable with your current choices')
      : '';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={note || undefined}
      className={chipClass(selected, state)}
    >
      {selected && <FiCheck className="inline w-3.5 h-3.5 me-1 -mt-0.5" aria-hidden="true" />}
      {label}
      {note && <span className="sr-only"> ({note})</span>}
    </button>
  );
};

/**
 * Generic, attribute-driven option picker. Only real active variants can be selected: every click resolves to
 * an existing variant, and the displayed choices always mirror that variant.
 */
const ProductVariantSelector: React.FC<Props> = ({ variants, selected, onSelect }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const matrix = useMemo(() => buildVariantMatrix(variants), [variants]);
  const current = selected ? matrix.valuesByVariant.get(selected.id) ?? {} : {};

  const selectedName = getLocalizedVariantName(selected, isRTL);
  const selectedAttributes = selected
    ? getLocalizedVariantAttributes(parseVariantAttributes(selected.attributes), isRTL)
    : [];
  const hasUnavailableHint = matrix.mode === 'attributes' && matrix.groups.some((g) =>
    g.values.some((o) => getOptionState(matrix, variants, selected, g.key, o.key) === 'unavailableWithSelection'));

  return (
    <div className="mb-6 space-y-4">
      {matrix.mode === 'attributes' ? (
        matrix.groups.map((group) => {
          const groupLabel = getLocalizedOptionName(group, isRTL);
          const chosen = group.values.find((o) => o.key === current[group.key]);
          return (
            <fieldset key={group.key}>
              <legend className="text-sm text-gray-700 mb-2">
                <span className="font-semibold">{groupLabel}</span>
                {chosen && <span className="text-gray-500">: {getLocalizedOptionValue(chosen, isRTL)}</span>}
              </legend>
              <div className="flex flex-wrap gap-2">
                {group.values.map((option) => {
                  const state = getOptionState(matrix, variants, selected, group.key, option.key);
                  return (
                    <OptionChip
                      key={option.key}
                      label={getLocalizedOptionValue(option, isRTL)}
                      selected={current[group.key] === option.key}
                      state={state}
                      onClick={() => {
                        const next = resolveOptionChoice(matrix, variants, selected, group.key, option.key);
                        if (next) onSelect(next);
                      }}
                    />
                  );
                })}
              </div>
            </fieldset>
          );
        })
      ) : (
        <fieldset>
          <legend className="text-sm font-semibold text-gray-700 mb-2">
            {t('variantOptions.chooseOption', 'Choose an option')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <OptionChip
                key={variant.id}
                label={getLocalizedVariantName(variant, isRTL)}
                selected={selected?.id === variant.id}
                state={variant.stock > 0 ? 'available' : 'outOfStock'}
                onClick={() => onSelect(variant)}
              />
            ))}
          </div>
        </fieldset>
      )}

      {hasUnavailableHint && (
        <p className="text-xs text-gray-500">
          {t('variantOptions.dashedHint', 'Options with a dashed border are not available with your current choices; selecting one switches the other choices to an available combination.')}
        </p>
      )}

      {selected && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm" aria-live="polite">
          <p className="text-gray-600">
            {t('variantOptions.selectedOption', 'Selected option')}:{' '}
            <span className="font-semibold text-gray-900">{selectedName}</span>
          </p>
          {matrix.mode === 'list' && selectedAttributes.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {selectedAttributes.map((a) => `${a.name}: ${a.value}`).join(' · ')}
            </p>
          )}
          {selected.stock <= 0 && (
            <p className="text-xs font-semibold text-red-600 mt-0.5">
              {t('variantOptions.selectedOutOfStock', 'This option is currently out of stock. Choose another option to buy.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductVariantSelector;
