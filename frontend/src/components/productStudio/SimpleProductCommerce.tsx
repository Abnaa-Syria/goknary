import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '../../lib/utils';
import { StudioField, StudioSection, describedBy, fieldClass } from './StudioSection';
import { FieldErrors, ProductFormState, getSimpleDiscountPrice } from './studioModel';

interface Props {
  form: ProductFormState;
  errors: FieldErrors;
  onChange: (patch: Partial<ProductFormState>) => void;
}

export const SimpleProductPricing: React.FC<Props> = ({ form, errors, onChange }) => {
  const { t } = useTranslation();
  const price = parseFloat(form.price);
  const finalPrice = getSimpleDiscountPrice(form);
  const saving = finalPrice != null && price > 0 ? price - finalPrice : null;

  return (
    <StudioSection
      id="studio-pricing"
      title={t('productStudio.pricing.title', 'Pricing')}
      subtitle={t('productStudio.pricing.subtitle', 'The customer price is calculated from the discount you choose.')}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StudioField
          id="studio-price"
          label={`${t('productStudio.pricing.basePrice', 'Base price')} (${t('common.currency', 'EGP')})`}
          required
          error={errors.price}
          hint={t('productStudio.pricing.basePriceHint', 'The price before any discount.')}
        >
          <input
            id="studio-price"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => onChange({ price: e.target.value })}
            className={fieldClass(!!errors.price)}
            aria-invalid={!!errors.price}
            aria-describedby={describedBy('studio-price', errors.price, 'hint')}
            placeholder="590"
          />
        </StudioField>

        <div>
          <span id="studio-discount-label" className="block text-sm font-semibold text-gray-800 mb-1">
            {t('productStudio.pricing.discount', 'Discount')}
          </span>
          <div className="flex gap-2" role="group" aria-labelledby="studio-discount-label">
            <select
              id="studio-discount-type"
              value={form.discountType}
              onChange={(e) => {
                const discountType = e.target.value as ProductFormState['discountType'];
                onChange(discountType ? { discountType } : { discountType: '', discountValue: '' });
              }}
              className="input-field w-auto"
              aria-label={t('productStudio.pricing.discountType', 'Discount type')}
            >
              <option value="">{t('productStudio.pricing.noDiscount', 'No discount')}</option>
              <option value="PERCENTAGE">{t('productStudio.pricing.percentage', 'Percentage (%)')}</option>
              <option value="FIXED">{t('productStudio.pricing.fixed', 'Fixed amount')}</option>
            </select>
            <input
              id="studio-discount-value"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={form.discountValue}
              disabled={!form.discountType}
              onChange={(e) => onChange({ discountValue: e.target.value })}
              className={fieldClass(!!errors.discountValue, 'min-w-0')}
              aria-label={t('productStudio.pricing.discountValue', 'Discount value')}
              aria-invalid={!!errors.discountValue}
              aria-describedby={describedBy('studio-discount-value', errors.discountValue)}
            />
          </div>
          {errors.discountValue
            ? <p id="studio-discount-value-error" className="text-xs text-red-600 mt-1 font-medium">{errors.discountValue}</p>
            : <p className="text-xs text-gray-500 mt-1">{t('productStudio.pricing.discountHint', 'Optional. A percentage or a fixed amount off the base price.')}</p>}
        </div>

        <div>
          <span className="block text-sm font-semibold text-gray-800 mb-1">{t('productStudio.pricing.finalPrice', 'Customer price')}</span>
          <output
            htmlFor="studio-price studio-discount-type studio-discount-value"
            className="flex items-baseline gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 min-h-[42px]"
            aria-live="polite"
          >
            {finalPrice != null ? (
              <>
                <span className="text-lg font-bold text-primary-700">{formatPrice(finalPrice)}</span>
                {saving != null && saving > 0 && (
                  <span className="text-xs text-green-700">{t('productStudio.pricing.saving', 'Saves {{amount}}', { amount: formatPrice(saving) })}</span>
                )}
              </>
            ) : price > 0 ? (
              <>
                <span className="text-lg font-bold text-gray-900">{formatPrice(price)}</span>
                <span className="text-xs text-gray-500">{t('productStudio.pricing.noDiscountShort', 'No discount')}</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">—</span>
            )}
          </output>
        </div>
      </div>
    </StudioSection>
  );
};

export const SimpleProductInventory: React.FC<Props> = ({ form, errors, onChange }) => {
  const { t } = useTranslation();
  return (
    <StudioSection id="studio-inventory" title={t('productStudio.inventory.title', 'Inventory')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StudioField
          id="studio-stock"
          label={t('productStudio.inventory.stock', 'Stock quantity')}
          required
          error={errors.stock}
          hint={t('productStudio.inventory.stockHint', 'Units available to sell now. 0 is allowed: the product shows as out of stock.')}
        >
          <input
            id="studio-stock"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={form.stock}
            onChange={(e) => onChange({ stock: e.target.value })}
            className={fieldClass(!!errors.stock)}
            aria-invalid={!!errors.stock}
            aria-describedby={describedBy('studio-stock', errors.stock, 'hint')}
          />
        </StudioField>
        <StudioField
          id="studio-low-stock"
          label={t('productStudio.inventory.lowStockThreshold', 'Low stock threshold')}
          hint={t('productStudio.inventory.lowStockHint', 'Used to decide when the product’s stock counts as low.')}
          error={errors.lowStockThreshold}
        >
          <input
            id="studio-low-stock"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={form.lowStockThreshold}
            onChange={(e) => onChange({ lowStockThreshold: e.target.value })}
            className={fieldClass(!!errors.lowStockThreshold)}
            aria-invalid={!!errors.lowStockThreshold}
            aria-describedby={describedBy('studio-low-stock', errors.lowStockThreshold, 'hint')}
          />
        </StudioField>
      </div>
    </StudioSection>
  );
};
