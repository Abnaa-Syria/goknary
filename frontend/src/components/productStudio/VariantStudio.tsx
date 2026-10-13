import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Boxes, CircleDollarSign, CloudCheck, Layers, Plus, Search, Wand2 } from 'lucide-react';
import { formatPrice } from '../../lib/utils';
import { StudioVariant, getVariantSummary } from './studioModel';
import { EMPTY_VARIANT_FILTERS, VariantFilters, filterVariants, hasActiveFilters } from './variantModel';
import { VariantCards, VariantTable } from './VariantList';

/** The search/filter bar appears once the list is long enough to need it. */
const TOOLBAR_MIN_VARIANTS = 5;

interface Props {
  variants: StudioVariant[];
  /** create: kept locally until the product is created; edit: every action is saved immediately. */
  persistence: 'local' | 'immediate';
  busyKey: string | null;
  productName: { name: string; nameAr: string };
  error?: string;
  variantErrors?: Record<number, string>;
  onAdd: () => void;
  onGenerate: () => void;
  onEdit: (variant: StudioVariant) => void;
  onSetDefault: (variant: StudioVariant) => void;
  onToggleStatus: (variant: StudioVariant) => void;
  onDelete: (variant: StudioVariant) => void;
}

const VariantStudio: React.FC<Props> = ({
  variants, persistence, busyKey, productName, error, variantErrors = {}, onAdd, onGenerate, onEdit, onSetDefault, onToggleStatus, onDelete,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [filters, setFilters] = useState<VariantFilters>(EMPTY_VARIANT_FILTERS);
  const { defaultVariant, activeCount, totalStock } = getVariantSummary(variants);
  const outOfStockActive = variants.filter((v) => v.status && v.stock <= 0).length;
  const visible = filterVariants(variants, filters);
  const label = (v: StudioVariant) => (isRTL && v.nameAr ? v.nameAr : v.name);
  const listProps = {
    variants: visible,
    busyKey,
    productName,
    errorFor: (v: StudioVariant) => variantErrors[variants.indexOf(v)],
    onEdit,
    onSetDefault,
    onToggleStatus,
    onDelete,
  };

  const creationButtons = (
    <>
      <button type="button" onClick={onAdd} disabled={!!busyKey} className="btn-primary inline-flex items-center gap-1.5">
        <Plus size={16} aria-hidden="true" /> {t('productStudio.variants.addManual', 'Add variant manually')}
      </button>
      <button type="button" onClick={onGenerate} disabled={!!busyKey} className="btn-outline inline-flex items-center gap-1.5">
        <Wand2 size={16} aria-hidden="true" /> {t('productStudio.variants.generate', 'Create several variants')}
      </button>
    </>
  );

  return (
    <section id="studio-variants" tabIndex={-1} aria-labelledby="studio-variants-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden scroll-mt-24 focus:outline-none">
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <h2 id="studio-variants-title" className="text-lg font-bold text-gray-900">{t('productStudio.variants.title', 'Variants')}</h2>
            <p className="text-sm text-gray-500">{t('productStudio.variants.subtitle', 'Each variant is an option the customer can choose, with its own price and stock.')}</p>
          </div>
          {variants.length > 0 && <div className="flex flex-wrap gap-2">{creationButtons}</div>}
        </div>

        <p className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${persistence === 'immediate' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-900'}`}>
          {persistence === 'immediate'
            ? <CloudCheck size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            : <Layers size={14} className="mt-0.5 shrink-0" aria-hidden="true" />}
          {persistence === 'immediate'
            ? t('productStudio.variants.immediate', 'Variant changes are saved right away. You do not need to press "Save changes" for them.')
            : t('productStudio.variants.local', 'These variants are not saved yet. They are created together with the product when you save it.')}
        </p>

        {variants.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-live="polite">
            <div className="flex items-start gap-3 rounded-xl bg-primary-50 border border-primary-100 p-3">
              <CircleDollarSign size={22} className="text-primary-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-xs text-gray-600">{t('productStudio.variants.catalogPrice', 'Catalog price')}</p>
                {defaultVariant ? (
                  <>
                    <p className="text-lg font-bold text-gray-900">
                      {formatPrice(defaultVariant.discountPrice || defaultVariant.price)}
                      {defaultVariant.discountPrice ? <span className="ms-2 text-sm font-normal text-gray-400 line-through">{formatPrice(defaultVariant.price)}</span> : null}
                    </p>
                    <p className="text-xs text-gray-600 truncate">{t('productStudio.variants.follows', 'Follows the default option: {{name}}', { name: label(defaultVariant) })}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">{t('productStudio.variants.noActive', 'Activate a variant to set the price shown in the store.')}</p>
                )}
                <p className="text-[11px] text-gray-500 mt-0.5">{t('productStudio.variants.catalogPriceHint', 'The price shown in the store follows the default option.')}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
              <Boxes size={22} className="text-gray-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs text-gray-600">{t('productStudio.variants.totalStock', 'Total active stock')}</p>
                <p className="text-lg font-bold text-gray-900">{t('productStudio.variants.units', '{{count}} units', { count: totalStock })}</p>
                <p className="text-xs text-gray-600">
                  {t('productStudio.variants.activeCount', '{{count}} active of {{total}}', { count: activeCount, total: variants.length })}
                  {outOfStockActive > 0 && <> · <span className="text-amber-700">{t('productStudio.variants.outOfStockCount', '{{count}} out of stock', { count: outOfStockActive })}</span></>}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">{t('productStudio.variants.totalStockHint', 'Product stock = the total stock of its active variants.')}</p>
              </div>
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600 font-medium">{error}</p>}

        {variants.length >= TOOLBAR_MIN_VARIANTS && (
          <div className="flex flex-wrap items-center gap-2" role="search" aria-label={t('productStudio.variants.filtersLabel', 'Search and filter variants')}>
            <div className="relative flex-1 min-w-[12rem]">
              <Search size={15} className="absolute top-1/2 -translate-y-1/2 start-3 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                value={filters.query}
                onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
                className="input-field w-full ps-9 text-sm"
                placeholder={t('productStudio.variants.searchPlaceholder', 'Search by name, SKU or value')}
                aria-label={t('productStudio.variants.searchPlaceholder', 'Search by name, SKU or value')}
              />
            </div>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as VariantFilters['status'] }))}
              className="input-field w-auto text-sm"
              aria-label={t('productStudio.variants.filterStatus', 'Availability')}
            >
              <option value="all">{t('productStudio.variants.filterAllStatus', 'Active and inactive')}</option>
              <option value="active">{t('common.active', 'Active')}</option>
              <option value="inactive">{t('common.inactive', 'Inactive')}</option>
            </select>
            <select
              value={filters.stock}
              onChange={(e) => setFilters((f) => ({ ...f, stock: e.target.value as VariantFilters['stock'] }))}
              className="input-field w-auto text-sm"
              aria-label={t('productStudio.variants.filterStock', 'Stock')}
            >
              <option value="all">{t('productStudio.variants.filterAllStock', 'Any stock')}</option>
              <option value="inStock">{t('productStudio.variants.inStock', 'In stock')}</option>
              <option value="outOfStock">{t('productStudio.variants.outOfStock', 'Out of stock')}</option>
            </select>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={filters.defaultOnly} onChange={(e) => setFilters((f) => ({ ...f, defaultOnly: e.target.checked }))} className="w-4 h-4 accent-primary-600" />
              {t('productStudio.variants.filterDefault', 'Default only')}
            </label>
            <p className="text-xs text-gray-500 w-full" aria-live="polite">
              {t('productStudio.variants.showing', 'Showing {{shown}} of {{total}}', { shown: visible.length, total: variants.length })}
              {hasActiveFilters(filters) && (
                <button type="button" onClick={() => setFilters(EMPTY_VARIANT_FILTERS)} className="ms-2 font-semibold text-primary-700 hover:underline">
                  {t('productStudio.variants.clearFilters', 'Clear filters')}
                </button>
              )}
            </p>
          </div>
        )}
      </div>

      {variants.length === 0 ? (
        <div className="mx-5 mb-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center space-y-3">
          <Layers size={28} className="mx-auto text-gray-300" aria-hidden="true" />
          <p className="font-semibold text-gray-800">{t('productStudio.variants.emptyTitle', 'You have not added any variants yet.')}</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {t('productStudio.variants.emptyText', 'Add a variant manually, or create several variants at once from a set of attributes.')}
          </p>
          <div className="flex flex-wrap justify-center gap-2">{creationButtons}</div>
        </div>
      ) : visible.length === 0 ? (
        <p className="mx-5 mb-5 text-sm text-gray-500 text-center py-6 bg-gray-50 rounded-xl">
          {t('productStudio.variants.noMatches', 'No variants match these filters.')}
        </p>
      ) : (
        <>
          <VariantTable {...listProps} />
          <VariantCards {...listProps} />
        </>
      )}
    </section>
  );
};

export default VariantStudio;
