import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { RecomputeSummary } from './types';

export type RecomputeState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; summary: RecomputeSummary }
  | { kind: 'error'; message: string };

interface Props {
  state: RecomputeState;
  recomputeRequired: boolean;
  intervalMinutes: number;
  canRecompute: boolean;
  onRecompute: () => void;
}

const RecomputeButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex-shrink-0"
  >
    <RefreshCw size={16} /> {label}
  </button>
);

const RankingRecomputeStatus: React.FC<Props> = ({ state, recomputeRequired, intervalMinutes, canRecompute, onRecompute }) => {
  const { t } = useTranslation();
  const autoNote =
    intervalMinutes > 0
      ? t('admin.ranking.autoNote', 'Scores are also recalculated automatically every {{minutes}} minutes.', { minutes: intervalMinutes })
      : t('admin.ranking.autoNoteOff', 'Automatic recalculation is off, so scores only change when recomputed manually.');

  if (state.kind === 'running') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-5 py-4" role="status" aria-live="polite">
        <Loader2 size={20} className="animate-spin text-blue-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-gray-900">{t('admin.ranking.running', 'Recalculating marketplace ranking…')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('admin.ranking.runningHint', 'This can take a moment. Current scores stay live until it finishes.')}</p>
        </div>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4" role="alert">
        <XCircle size={20} className="text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{t('admin.ranking.failedTitle', 'Recalculation failed')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{state.message}</p>
        </div>
        {canRecompute && <RecomputeButton label={t('admin.ranking.retry', 'Retry')} onClick={onRecompute} />}
      </div>
    );
  }

  if (state.kind === 'done') {
    const { summary } = state;
    const counts = t('admin.ranking.summaryCounts', '{{products}} of {{productsTotal}} products and {{vendors}} of {{vendorsTotal}} vendors updated in {{seconds}}s.', {
      products: summary.productsUpdated,
      productsTotal: summary.productsProcessed,
      vendors: summary.vendorsUpdated,
      vendorsTotal: summary.vendorsProcessed,
      seconds: (summary.durationMs / 1000).toFixed(1),
    });

    if (summary.status === 'success') {
      return (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-5 py-4" role="status">
          <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-gray-900">{t('admin.ranking.successTitle', 'Ranking recalculated')}</p>
            <p className="text-xs text-gray-600 mt-0.5">{counts}</p>
          </div>
        </div>
      );
    }

    if (summary.status === 'partial') {
      return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4" role="status">
          <AlertTriangle size={20} className="text-amber-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">{t('admin.ranking.partialTitle', 'Ranking partly recalculated')}</p>
            <p className="text-xs text-gray-600 mt-0.5">
              {counts} {t('admin.ranking.partialHint', 'Products that were not updated keep their previous scores.')}
            </p>
          </div>
          {canRecompute && <RecomputeButton label={t('admin.ranking.retry', 'Retry')} onClick={onRecompute} />}
        </div>
      );
    }

    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-red-100 bg-red-50/60 px-5 py-4" role="alert">
        <XCircle size={20} className="text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{t('admin.ranking.failedTitle', 'Recalculation failed')}</p>
          <p className="text-xs text-gray-600 mt-0.5">{t('admin.ranking.failedKept', 'No scores were changed; the previous ranking is still live.')}</p>
        </div>
        {canRecompute && <RecomputeButton label={t('admin.ranking.retry', 'Retry')} onClick={onRecompute} />}
      </div>
    );
  }

  if (recomputeRequired) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-primary-200 bg-primary-50/60 px-5 py-4" role="status">
        <Info size={20} className="text-primary-800 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">
            {t('admin.ranking.savedNeedsRecompute', 'Configuration saved. Ranking scores need recalculation to apply the new weights.')}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{autoNote}</p>
        </div>
        {canRecompute && <RecomputeButton label={t('admin.ranking.recompute', 'Recompute ranking')} onClick={onRecompute} />}
      </div>
    );
  }

  return null;
};

export default RankingRecomputeStatus;
