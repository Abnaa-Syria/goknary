import React from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CatalogPagination as Pagination } from '../../lib/productCatalog';

interface Props {
  pagination: Pagination;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const CatalogPagination: React.FC<Props> = ({ pagination, onPageChange, disabled }) => {
  const { t, i18n } = useTranslation();
  const { page, totalPages, total, limit } = pagination;
  const number = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);
  const buttonClass =
    'inline-flex items-center gap-1 min-h-[44px] px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <nav aria-label={t('catalog.pagination.label')} className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3">
      <p className="text-sm text-gray-600" aria-live="polite">
        {t('catalog.pagination.range', { from: number.format(from), to: number.format(to), total: number.format(total) })}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft size={16} className="rtl:rotate-180" aria-hidden="true" />
            {t('common.previous', 'Previous')}
          </button>
          <span className="text-sm text-gray-700 tabular-nums px-1" aria-current="page">
            {t('catalog.pagination.page', { page: number.format(page), totalPages: number.format(totalPages) })}
          </span>
          <button type="button" className={buttonClass} disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>
            {t('common.next', 'Next')}
            <ChevronRight size={16} className="rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      )}
    </nav>
  );
};

export default CatalogPagination;
