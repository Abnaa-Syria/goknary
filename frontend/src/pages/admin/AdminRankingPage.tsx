import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Eye, Info, Loader2, Lock, RefreshCw, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector } from '../../store/hooks';
import { hasPermission } from '../../utils/permissions';
import RankingWeightControl from '../../components/admin/ranking/RankingWeightControl';
import RankingPreviewTable from '../../components/admin/ranking/RankingPreviewTable';
import RankingScoreBreakdown from '../../components/admin/ranking/RankingScoreBreakdown';
import RankingRecomputeStatus, { RecomputeState } from '../../components/admin/ranking/RankingRecomputeStatus';
import { PreviewProduct, PreviewResponse, RankingConfig, RecomputeSummary, sumWeights, Weights } from '../../components/admin/ranking/types';

const RUNNING_POLL_MS = 5000;

const sameWeights = (keys: string[], a: Weights, b: Weights) => keys.every((key) => (Number(a[key]) || 0) === (Number(b[key]) || 0));

const MetaItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-center gap-1.5 text-xs">
    <span className="text-gray-500">{label}</span>
    <span className="font-semibold text-gray-900">{value}</span>
  </div>
);

const AdminRankingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const canEdit = hasPermission(user, 'UPDATE_SETTINGS');

  const [config, setConfig] = useState<RankingConfig | null>(null);
  const [weights, setWeights] = useState<Weights>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [selected, setSelected] = useState<PreviewProduct | null>(null);
  const [recomputeRequired, setRecomputeRequired] = useState(false);
  const [recompute, setRecompute] = useState<RecomputeState>({ kind: 'idle' });
  const recomputeInFlight = useRef(false);
  const autoPreviewDone = useRef(false);
  const previewRequestId = useRef(0);

  const fetchConfig = useCallback(async () => {
    const res = await api.get<RankingConfig>('/admin/ranking-config');
    setConfig(res.data);
    return res.data;
  }, []);

  const initialLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await fetchConfig();
      setWeights(data.weights);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchConfig]);

  /** Refreshes server state without discarding unsaved edits. */
  const refresh = useCallback(async () => {
    try {
      await fetchConfig();
    } catch {
      // The next poll or action retries; the page keeps the last known state.
    }
  }, [fetchConfig]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const keys = useMemo(() => config?.keys ?? [], [config]);
  const savedWeights = useMemo(() => config?.weights ?? {}, [config]);
  const total = useMemo(() => sumWeights(keys, weights), [keys, weights]);
  const dirty = !!config && !sameWeights(keys, weights, savedWeights);
  const atDefaults = !!config && sameWeights(keys, weights, config.defaults);
  const invalid = total <= 0;
  const serverRunning = !!config?.recompute.running;
  const isRunning = recompute.kind === 'running' || serverRunning;
  const previewStale = !!preview && !sameWeights(keys, weights, preview.weights);
  const previewUsesSaved = !!preview && sameWeights(keys, preview.weights, preview.currentWeights ?? {});

  useEffect(() => {
    if (!serverRunning || recompute.kind === 'running') return;
    const id = window.setInterval(refresh, RUNNING_POLL_MS);
    return () => window.clearInterval(id);
  }, [serverRunning, recompute.kind, refresh]);

  const setWeight = (key: string, raw: string) => {
    if (!canEdit) return;
    const value = Math.round(Math.min(config?.maxWeight ?? 100, Math.max(0, Number(raw) || 0)));
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const runPreview = useCallback(
    async (proposed: Weights) => {
      const requestId = ++previewRequestId.current;
      setPreviewing(true);
      setPreviewError(false);
      setSelected(null);
      try {
        const res = await api.post<PreviewResponse>('/admin/ranking/preview', { weights: proposed });
        if (requestId !== previewRequestId.current) return;
        setPreview({ ...res.data, products: Array.isArray(res.data.products) ? res.data.products : [] });
      } catch {
        if (requestId !== previewRequestId.current) return;
        setPreview(null);
        setPreviewError(true);
        toast.error(t('admin.ranking.previewFailed', 'Preview failed'));
      } finally {
        if (requestId === previewRequestId.current) setPreviewing(false);
      }
    },
    [t]
  );

  useEffect(() => {
    if (!config || autoPreviewDone.current) return;
    autoPreviewDone.current = true;
    if (sumWeights(config.keys, config.weights) > 0) runPreview(config.weights);
  }, [config, runPreview]);

  const save = async () => {
    if (!canEdit || invalid || !dirty) return;
    setSaving(true);
    try {
      const res = await api.put('/admin/ranking-config', { weights });
      toast.success(t('admin.ranking.saved', 'Ranking weights saved'));
      setRecomputeRequired(res.data?.recomputeRequired !== false);
      setRecompute({ kind: 'idle' });
      const data = await fetchConfig().catch(() => null);
      if (data) setWeights(data.weights);
    } catch (err: any) {
      toast.error(
        err?.response?.status === 400
          ? t('admin.ranking.invalidWeights', 'These weights are not valid. Each must be 0–{{max}} and at least one above 0.', { max: config?.maxWeight ?? 100 })
          : t('admin.ranking.saveFailed', 'Failed to save ranking weights')
      );
    } finally {
      setSaving(false);
    }
  };

  const runRecompute = async () => {
    if (!canEdit || recomputeInFlight.current || serverRunning) return;
    recomputeInFlight.current = true;
    setRecompute({ kind: 'running' });
    try {
      const res = await api.post('/admin/ranking/recompute');
      const summary: RecomputeSummary = res.data.summary;
      setRecompute({ kind: 'done', summary });
      setRecomputeRequired(false);
    } catch (err: any) {
      const summary: RecomputeSummary | undefined = err?.response?.data?.summary;
      if (summary) {
        setRecompute({ kind: 'done', summary });
      } else if (err?.response?.status === 409) {
        setRecompute({ kind: 'error', message: t('admin.ranking.alreadyRunning', 'A recalculation is already running. Try again shortly.') });
      } else {
        setRecompute({ kind: 'error', message: t('admin.ranking.recomputeFailedHint', 'The ranking could not be recalculated. The previous scores are still live.') });
      }
    } finally {
      recomputeInFlight.current = false;
      await refresh();
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(i18n.language, { dateStyle: 'medium', timeStyle: 'short' });
  };

  if (loading) {
    return (
      <div className="space-y-8 pb-12 animate-pulse">
        <div className="h-16 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 gap-3">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <p className="text-gray-700 font-medium">{t('admin.ranking.loadFailed', 'Failed to load ranking settings')}</p>
        <button
          type="button"
          onClick={initialLoad}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
        >
          <RefreshCw size={16} /> {t('admin.ranking.retry', 'Retry')}
        </button>
      </div>
    );
  }

  const lastRun = config.recompute.lastRun;
  const intervalMinutes = Number(config.recompute.intervalMinutes) || 0;
  const lastRunTone =
    lastRun?.status === 'success' ? 'bg-emerald-50 text-emerald-700' : lastRun?.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
  const sourceLabel =
    config.source === 'saved'
      ? t('admin.ranking.sourceSaved', 'Saved configuration')
      : config.source === 'invalid'
        ? t('admin.ranking.sourceInvalid', 'Default weights (stored value invalid)')
        : t('admin.ranking.sourceDefault', 'Default weights');

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{t('admin.ranking.title', 'Marketplace Ranking')}</h1>
            {!canEdit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-full">
                <Lock size={12} /> {t('admin.ranking.viewOnly', 'View-only')}
              </span>
            )}
          </div>
          <p className="text-gray-500 mt-1 text-sm">{t('admin.ranking.pageSubtitle', 'Control how the Recommended order weighs each product signal.')}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mt-3">
            <MetaItem label={t('admin.ranking.scoreRange', 'Score range')} value={<span dir="ltr">0–100</span>} />
            <MetaItem label={t('admin.ranking.lookback', 'Lookback')} value={t('admin.ranking.days', '{{count}} days', { count: config.lookbackDays })} />
            <MetaItem
              label={t('admin.ranking.autoRecompute', 'Auto recompute')}
              value={intervalMinutes > 0 ? t('admin.ranking.everyMinutes', 'Every {{count}} min', { count: intervalMinutes }) : t('admin.ranking.off', 'Off')}
            />
            <MetaItem label={t('admin.ranking.lastRecompute', 'Last recompute')} value={lastRun ? formatDate(lastRun.finishedAt) : t('admin.ranking.neverRun', 'Never')} />
          </div>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={runRecompute}
            disabled={isRunning}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            {isRunning ? t('admin.ranking.recomputing', 'Recalculating…') : t('admin.ranking.recompute', 'Recompute ranking')}
          </button>
        )}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white px-5 py-3 rounded-2xl border border-gray-100 shadow-sm text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-gray-500">{t('admin.ranking.configSource', 'Configuration')}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.source === 'invalid' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-700'}`}>
            {sourceLabel}
          </span>
          <span className="hidden sm:inline text-gray-200">|</span>
          <span className="text-gray-500">{t('admin.ranking.lastRunStatus', 'Last run')}</span>
          {serverRunning ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
              <Loader2 size={12} className="animate-spin" /> {t('admin.ranking.statusRunning', 'Running')}
            </span>
          ) : lastRun ? (
            <>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lastRunTone}`}>{t(`admin.ranking.status.${lastRun.status}`, lastRun.status)}</span>
              <span className="text-xs text-gray-500">
                {t('admin.ranking.lastRunCounts', '{{products}} products, {{vendors}} vendors updated', {
                  products: lastRun.productsUpdated,
                  vendors: lastRun.vendorsUpdated,
                })}
              </span>
            </>
          ) : (
            <span className="text-xs text-gray-500">{t('admin.ranking.neverRun', 'Never')}</span>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Info size={14} className="text-blue-600 flex-shrink-0" />
          {t('admin.ranking.searchNote', 'Marketplace Ranking controls general Recommended ordering. Search results still prioritize text relevance.')}
        </p>
      </div>

      {config.source === 'invalid' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <span>{t('admin.ranking.invalidStored', 'The stored ranking weights are invalid, so the defaults are in use. Save valid weights to fix this.')}</span>
        </div>
      )}

      <RankingRecomputeStatus
        state={serverRunning && recompute.kind !== 'running' ? { kind: 'running' } : recompute}
        recomputeRequired={recomputeRequired}
        intervalMinutes={intervalMinutes}
        canRecompute={canEdit && !isRunning}
        onRecompute={runRecompute}
      />

      <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('admin.ranking.weights', 'Ranking weights')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('admin.ranking.normalizedHint', 'Weights are relative: each signal counts by its share of the total.')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-primary-50 border border-primary-200 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-600" />
                {t('admin.ranking.unsaved', 'Unsaved ranking changes')}
              </span>
            )}
            <button
              type="button"
              onClick={() => setWeights(config.defaults)}
              disabled={!canEdit || atDefaults}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RotateCcw size={16} /> {t('admin.ranking.reset', 'Reset to defaults')}
            </button>
            <button
              type="button"
              onClick={() => runPreview(weights)}
              disabled={previewing || invalid}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewing ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />} {t('admin.ranking.preview', 'Preview')}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canEdit || saving || invalid || !dirty}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} {t('admin.ranking.save', 'Save')}
            </button>
          </div>
        </div>

        {invalid && (
          <p className="mt-4 text-sm text-red-600 flex items-center gap-2">
            <AlertTriangle size={16} /> {t('admin.ranking.atLeastOne', 'At least one weight must be above 0.')}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          {keys.map((key) => (
            <RankingWeightControl
              key={key}
              signal={key}
              value={Number(weights[key]) || 0}
              savedValue={Number(savedWeights[key]) || 0}
              total={total}
              max={config.maxWeight}
              disabled={!canEdit}
              onChange={(raw) => setWeight(key, raw)}
            />
          ))}
        </div>
      </section>

      <section className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('admin.ranking.previewTitle', 'Top products preview')}</h2>
            <p className="text-sm text-gray-500 mt-1">{t('admin.ranking.previewHint', 'Preview never saves. It compares stored scores with scores under the current and proposed weights.')}</p>
          </div>
          {preview && !previewing && (
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {t('admin.ranking.productsConsidered', '{{count}} products considered', { count: preview.productsConsidered })}
            </span>
          )}
        </div>

        {previewStale && !previewing && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-600">
            <span>{t('admin.ranking.previewStale', 'Weights changed since this preview.')}</span>
            <button type="button" onClick={() => runPreview(weights)} disabled={invalid} className="text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50">
              {t('admin.ranking.updatePreview', 'Update preview')}
            </button>
          </div>
        )}

        {previewUsesSaved && !previewStale && !previewing && (
          <p className="flex items-start gap-2 mb-4 px-4 py-2.5 rounded-xl bg-blue-50/50 border border-blue-100 text-sm text-gray-600">
            <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            {t('admin.ranking.previewUsesSaved', 'This preview uses the saved weights, so current and preview scores match. Change the weights and press Preview to compare.')}
          </p>
        )}

        {previewError && !previewing ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-gray-600">{t('admin.ranking.previewFailed', 'Preview failed')}</p>
            <button type="button" onClick={() => runPreview(weights)} disabled={invalid} className="text-sm font-semibold text-blue-700 hover:text-blue-800 disabled:opacity-50">
              {t('admin.ranking.retry', 'Retry')}
            </button>
          </div>
        ) : !preview && !previewing ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-gray-500">{t('admin.ranking.previewEmptyPrompt', 'Run a preview to see how the top products would rank.')}</p>
          </div>
        ) : (
          <RankingPreviewTable products={preview?.products ?? null} loading={previewing} onDetails={setSelected} />
        )}
      </section>

      <RankingScoreBreakdown product={selected} keys={keys} weights={preview?.weights ?? weights} onClose={() => setSelected(null)} />
    </div>
  );
};

export default AdminRankingPage;
