import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, CircleDot, Loader2 } from 'lucide-react';
import { ProductStatusBadge } from '../vendor/ProductReviewStatus';

interface HeaderProps {
  title: string;
  subtitle: string;
  backLabel: string;
  onBack: () => void;
  status: string | null;
  sku?: string | null;
  vendorName?: string | null;
}

export const ProductStudioHeader: React.FC<HeaderProps> = ({ title, subtitle, backLabel, onBack, status, sku, vendorName }) => {
  const { t } = useTranslation();
  return (
    <header className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft size={18} className="rtl:rotate-180" aria-hidden="true" />
        </button>
        <div>
          <p className="text-xs font-semibold text-gray-500">{t('productStudio.name', 'Product Studio')}</p>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
        {status ? (
          <ProductStatusBadge status={status} />
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-gray-50 text-gray-600 border-gray-200">
            {t('productStudio.notSaved', 'Not saved yet')}
          </span>
        )}
        {vendorName && <span className="rounded-full bg-gray-100 px-2.5 py-0.5">{vendorName}</span>}
        {sku && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-mono" dir="ltr">SKU {sku}</span>}
      </div>
    </header>
  );
};

export interface SummaryItem {
  text: string;
  targetId?: string;
}

export const ProductValidationSummary: React.FC<{ title: string; items: SummaryItem[] }> = ({ title, items }) => {
  if (items.length === 0) return null;
  const focusTarget = (id?: string) => {
    if (!id) return;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (el as HTMLElement).focus?.({ preventScroll: true });
  };
  return (
    <div role="alert" tabIndex={-1} id="studio-validation-summary" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 focus:outline-none">
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle size={16} aria-hidden="true" /> {title}
      </p>
      <ul className="mt-2 space-y-1 list-disc ps-6">
        {items.map((item, index) => (
          <li key={`${item.text}-${index}`}>
            {item.targetId ? (
              <button type="button" onClick={() => focusTarget(item.targetId)} className="text-start underline decoration-red-300 hover:decoration-red-700">
                {item.text}
              </button>
            ) : item.text}
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface DockAction {
  id: string;
  label: string;
  tone: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
  disabled?: boolean;
}

interface DockProps {
  statusLine: string;
  detailLine?: string;
  dirty: boolean;
  busy: boolean;
  actions: DockAction[];
}

const TONES: Record<DockAction['tone'], string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white',
  secondary: 'bg-white border border-gray-300 hover:bg-gray-50 text-gray-800',
  danger: 'bg-white border border-red-300 hover:bg-red-50 text-red-700',
};

export const ProductActionDock: React.FC<DockProps> = ({ statusLine, detailLine, dirty, busy, actions }) => {
  const { t } = useTranslation();
  return (
    <div className="sticky bottom-0 z-30 -mx-1 mt-6">
      <div className="rounded-2xl border border-gray-200 bg-white/95 backdrop-blur shadow-[0_-6px_20px_rgba(0,0,0,0.06)] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0" aria-live="polite">
          {busy ? (
            <Loader2 size={16} className="animate-spin text-primary-600 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <CircleDot size={16} className={`mt-0.5 shrink-0 ${dirty ? 'text-amber-500' : 'text-green-600'}`} aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {busy ? t('productStudio.dock.saving', 'Saving…') : dirty ? t('productStudio.dock.unsaved', 'Unsaved product changes') : statusLine}
            </p>
            {detailLine && <p className="text-xs text-gray-500 truncate">{detailLine}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={busy || action.disabled}
              className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 ${TONES[action.tone]}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
