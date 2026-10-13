import React from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogFilters, CatalogSummary } from '../../lib/productCatalog';

export interface SummaryItem {
  key: keyof CatalogSummary;
  /** Status/stock filter applied when the card is pressed (`{}` = all products). Without it the card is a plain count. */
  filter?: Partial<CatalogFilters>;
  tone?: 'neutral' | 'warning' | 'danger' | 'success' | 'info';
}

const TONES = {
  neutral: 'text-gray-900',
  success: 'text-green-700',
  info: 'text-blue-700',
  warning: 'text-amber-700',
  danger: 'text-red-700',
} as const;

interface Props {
  summary: CatalogSummary | null;
  items: SummaryItem[];
  filters: CatalogFilters;
  onApply: (filter: Partial<CatalogFilters>) => void;
  /** Explains what the counts cover (they ignore the current search and filters). */
  scopeLabel: string;
}

/** A card is "on" when the status and stock filters are exactly the card's (the total card: neither set). */
const isApplied = (filter: Partial<CatalogFilters>, filters: CatalogFilters) =>
  (filter.status ?? '') === filters.status && (filter.stock ?? '') === filters.stock;

/** Real counts from the list endpoint (whole scope, not the current page); each card is a quick filter. */
const CatalogSummaryStrip: React.FC<Props> = ({ summary, items, filters, onApply, scopeLabel }) => {
  const { t, i18n } = useTranslation();
  if (!summary) return null;
  const number = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  return (
    <section aria-label={t('catalog.summary.region')}>
      <p className="sr-only">{scopeLabel}</p>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {items.map((item) => {
          const content = (
            <>
              <span className="block text-xs font-semibold text-gray-500">{t(`catalog.summary.${item.key}`)}</span>
              <span className={`block mt-1 text-2xl font-bold tabular-nums ${TONES[item.tone ?? 'neutral']}`}>
                {number.format(summary[item.key])}
              </span>
            </>
          );
          if (!item.filter) {
            return (
              <li key={item.key} className="rounded-2xl border border-gray-100 bg-white px-4 py-3">{content}</li>
            );
          }
          const filter = item.filter;
          const pressed = isApplied(filter, filters);
          return (
            <li key={item.key}>
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => onApply({ status: '', stock: '', ...filter })}
                className={`w-full h-full text-start rounded-2xl border px-4 py-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 ${
                  pressed ? 'border-gray-900 bg-gray-50' : 'border-gray-100 bg-white hover:border-gray-300'
                }`}
              >
                {content}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-1.5 text-[11px] text-gray-400" aria-hidden="true">{scopeLabel}</p>
    </section>
  );
};

export default CatalogSummaryStrip;
