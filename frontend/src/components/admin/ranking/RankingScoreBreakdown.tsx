import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { getImageUrl } from '../../../utils/image';
import { productDisplayName, ScoreChange } from './RankingPreviewTable';
import { formatScore, PreviewProduct, SIGNAL_HELP, SIGNAL_ICONS, SIGNAL_LABELS, sumWeights, Weights } from './types';

interface Props {
  product: PreviewProduct | null;
  keys: string[];
  weights: Weights;
  onClose: () => void;
}

const RankingScoreBreakdown: React.FC<Props> = ({ product, keys, weights, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const total = sumWeights(keys, weights);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, onClose]);

  const offscreen = isRtl ? '-100%' : '100%';

  return (
    <AnimatePresence>
      {product && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="ranking-breakdown-title">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            className="absolute top-0 bottom-0 end-0 w-full max-w-md bg-white shadow-2xl border-s border-gray-100 flex flex-col"
            initial={{ x: offscreen }}
            animate={{ x: 0 }}
            exit={{ x: offscreen }}
            transition={{ type: 'tween', duration: 0.2 }}
          >
            <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
              <div className="flex items-center gap-3 min-w-0">
                <img src={getImageUrl(product.image)} alt="" className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0" />
                <div className="min-w-0">
                  <h2 id="ranking-breakdown-title" className="font-bold text-gray-900 truncate">
                    {productDisplayName(product, i18n.language)}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">
                    {product.vendor?.storeName ?? '—'} · {t('admin.ranking.rankLabel', 'Rank #{{rank}}', { rank: product.rank })}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.close', 'Close')}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: t('admin.ranking.storedScore', 'Stored score'), value: product.storedScore, strong: false },
                  { label: t('admin.ranking.currentScore', 'Current score'), value: product.currentWeightsScore, strong: false },
                  { label: t('admin.ranking.previewScore', 'Preview score'), value: product.previewScore, strong: true },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border p-3 ${item.strong ? 'border-blue-100 bg-blue-50/50' : 'border-gray-100'}`}>
                    <p className="text-[11px] font-medium text-gray-500">{item.label}</p>
                    <p className={`text-lg font-bold tabular-nums ${item.strong ? 'text-blue-700' : 'text-gray-900'}`}>{formatScore(item.value)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{t('admin.ranking.changeVsCurrent', 'Change vs. current weights')}</span>
                <ScoreChange delta={product.previewScore - product.currentWeightsScore} />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-900">{t('admin.ranking.contributions', 'Score contributions')}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{t('admin.ranking.contributionsHint', 'Points each signal adds to the preview score.')}</p>
                <ul className="mt-4 space-y-4">
                  {keys.map((key) => {
                    const Icon = SIGNAL_ICONS[key];
                    const weight = Number(weights[key]) || 0;
                    const maxPoints = total > 0 ? (weight / total) * 100 : 0;
                    const points = product.contributions?.[key] ?? 0;
                    const fill = Math.max(0, Math.min(1, product.signals?.[key] ?? 0)) * 100;
                    const isFeatured = key === 'featured';
                    const showHelp = key === 'featured' || key === 'vendorQuality';
                    return (
                      <li key={key}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex items-center gap-2 text-gray-700 font-medium">
                            {Icon && <Icon size={14} className={isFeatured ? 'text-primary-700' : 'text-gray-400'} />}
                            {t(`admin.ranking.signals.${key}`, SIGNAL_LABELS[key] ?? key)}
                          </span>
                          {weight > 0 ? (
                            <span className="tabular-nums text-gray-900 font-semibold" dir="ltr">
                              {formatScore(points)}
                              <span className="text-gray-400 font-normal"> / {formatScore(maxPoints)}</span>
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">{t('admin.ranking.notCounted', 'Not counted')}</span>
                          )}
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${weight === 0 ? 'bg-gray-300' : isFeatured ? 'bg-primary-500' : 'bg-blue-600'}`}
                            style={{ width: `${weight > 0 ? fill : 0}%` }}
                          />
                        </div>
                        {showHelp && <p className="text-[11px] text-gray-500 mt-1">{t(`admin.ranking.signalHelp.${key}`, SIGNAL_HELP[key])}</p>}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3 text-sm">
                <span className="font-semibold text-gray-700">{t('admin.ranking.previewTotal', 'Preview score')}</span>
                <span className="font-bold text-gray-900 tabular-nums" dir="ltr">
                  {formatScore(product.previewScore)} / 100
                </span>
              </div>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RankingScoreBreakdown;
