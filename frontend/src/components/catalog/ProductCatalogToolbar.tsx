import React, { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import CategoryTreeOptions from '../category/CategoryTreeOptions';
import { CategoryLike, flattenCategoryTree, getCategoryLabel } from '../../utils/categoryTree';
import {
  CATALOG_SORTS,
  CatalogFilterKey,
  CatalogFilters,
  PRODUCT_STATUSES,
  STOCK_FILTERS,
  countActiveFilters,
} from '../../lib/productCatalog';

export interface VendorOption {
  id: string;
  label: string;
}

interface Props {
  filters: CatalogFilters;
  available: CatalogFilterKey[];
  searchText: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  onChange: (changes: Partial<CatalogFilters>) => void;
  onClear: () => void;
  categories: CategoryLike[];
  vendors?: VendorOption[];
}

const selectClass =
  'w-full min-h-[44px] px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900';

/**
 * Search + filters for both catalogs. Which filters appear is configuration (`available`), not role
 * checks. On small screens the filters collapse behind a "Filters" button; active filters always show
 * as removable chips.
 */
const ProductCatalogToolbar: React.FC<Props> = ({
  filters,
  available,
  searchText,
  onSearchChange,
  searchPlaceholder,
  onChange,
  onClear,
  categories,
  vendors = [],
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [panelOpen, setPanelOpen] = useState(false);
  const baseId = useId();
  const id = (name: string) => `${baseId}-${name}`;
  const activeCount = countActiveFilters(filters);
  const filterCount = activeCount - (filters.q.trim() ? 1 : 0);
  const has = (key: CatalogFilterKey) => available.includes(key);

  const categoryLabel = (categoryId: string) => {
    const match = flattenCategoryTree(categories).find(({ category }) => category.id === categoryId);
    return match ? getCategoryLabel(match.category, isRTL) : t('catalog.filters.unknownCategory');
  };

  const chips: Array<{ key: keyof CatalogFilters; label: string }> = [];
  if (filters.q.trim()) chips.push({ key: 'q', label: t('catalog.chips.search', { value: filters.q.trim() }) });
  if (filters.vendorId) {
    const vendor = vendors.find((v) => v.id === filters.vendorId);
    chips.push({ key: 'vendorId', label: t('catalog.chips.vendor', { value: vendor?.label ?? t('catalog.filters.unknownVendor') }) });
  }
  if (filters.status) chips.push({ key: 'status', label: t('catalog.chips.status', { value: t(`catalog.statusOption.${filters.status}`) }) });
  if (filters.categoryId) chips.push({ key: 'categoryId', label: t('catalog.chips.category', { value: categoryLabel(filters.categoryId) }) });
  if (filters.stock) chips.push({ key: 'stock', label: t('catalog.chips.stock', { value: t(`catalog.inventory.${filters.stock}`) }) });
  if (filters.featured) chips.push({ key: 'featured', label: t(`catalog.chips.featured_${filters.featured}`) });

  return (
    <section aria-label={t('catalog.filters.region')} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={id('q')} className="sr-only">{t('catalog.filters.search')}</label>
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" aria-hidden="true" />
          <input
            id={id('q')}
            type="search"
            value={searchText}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            maxLength={100}
            autoComplete="off"
            className="w-full min-h-[44px] ps-10 pe-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white"
          />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((value) => !value)}
          aria-expanded={panelOpen}
          aria-controls={id('panel')}
          className="md:hidden inline-flex items-center gap-2 min-h-[44px] px-3 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          {t('catalog.filters.toggle')}
          {filterCount > 0 && (
            <span className="min-w-[20px] h-5 px-1 rounded-full bg-gray-900 text-white text-[11px] leading-5 text-center">{filterCount}</span>
          )}
        </button>
      </div>

      <div id={id('panel')} className={`${panelOpen ? 'grid' : 'hidden'} md:grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2`}>
        {has('vendorId') && (
          <div>
            <label htmlFor={id('vendor')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.vendor')}</label>
            <select id={id('vendor')} value={filters.vendorId} onChange={(e) => onChange({ vendorId: e.target.value })} className={selectClass}>
              <option value="">{t('catalog.filters.allVendors')}</option>
              {filters.vendorId && !vendors.some((v) => v.id === filters.vendorId) && (
                <option value={filters.vendorId}>{t('catalog.filters.unknownVendor')}</option>
              )}
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>{vendor.label}</option>
              ))}
            </select>
          </div>
        )}
        {has('status') && (
          <div>
            <label htmlFor={id('status')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.status')}</label>
            <select id={id('status')} value={filters.status} onChange={(e) => onChange({ status: e.target.value })} className={selectClass}>
              <option value="">{t('catalog.filters.allStatuses')}</option>
              {PRODUCT_STATUSES.map((status) => (
                <option key={status} value={status}>{t(`catalog.statusOption.${status}`)}</option>
              ))}
            </select>
          </div>
        )}
        {has('categoryId') && (
          <div>
            <label htmlFor={id('category')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.category')}</label>
            <select id={id('category')} value={filters.categoryId} onChange={(e) => onChange({ categoryId: e.target.value })} className={selectClass}>
              <option value="">{t('catalog.filters.allCategories')}</option>
              <CategoryTreeOptions tree={categories} />
            </select>
          </div>
        )}
        {has('stock') && (
          <div>
            <label htmlFor={id('stock')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.stock')}</label>
            <select id={id('stock')} value={filters.stock} onChange={(e) => onChange({ stock: e.target.value })} className={selectClass}>
              <option value="">{t('catalog.filters.allStock')}</option>
              {STOCK_FILTERS.map((stock) => (
                <option key={stock} value={stock}>{t(`catalog.inventory.${stock}`)}</option>
              ))}
            </select>
          </div>
        )}
        {has('featured') && (
          <div>
            <label htmlFor={id('featured')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.featured')}</label>
            <select id={id('featured')} value={filters.featured} onChange={(e) => onChange({ featured: e.target.value })} className={selectClass}>
              <option value="">{t('catalog.filters.allFeatured')}</option>
              <option value="true">{t('catalog.featured.yes')}</option>
              <option value="false">{t('catalog.featured.no')}</option>
            </select>
          </div>
        )}
        <div>
          <label htmlFor={id('sort')} className="block text-xs font-semibold text-gray-600 mb-1">{t('catalog.filters.sort')}</label>
          <select id={id('sort')} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value as CatalogFilters['sort'] })} className={selectClass}>
            {CATALOG_SORTS.map((sort) => (
              <option key={sort} value={sort}>{t(`catalog.sort.${sort}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-label={t('catalog.filters.active')}>
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => (chip.key === 'q' ? onSearchChange('') : onChange({ [chip.key]: '' }))}
              aria-label={t('catalog.chips.remove', { label: chip.label })}
              className="inline-flex items-center gap-1 min-h-[32px] px-3 rounded-full bg-gray-100 text-xs font-semibold text-gray-800 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
            >
              {chip.label}
              <X size={12} aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="min-h-[32px] px-2 text-xs font-semibold text-gray-700 underline underline-offset-2 hover:text-gray-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 rounded"
          >
            {t('catalog.filters.clear')}
          </button>
        </div>
      )}
    </section>
  );
};

export default ProductCatalogToolbar;
