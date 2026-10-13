import React from 'react';
import { useTranslation } from 'react-i18next';
import { SIGNAL_HELP, SIGNAL_ICONS, SIGNAL_LABELS, weightShare } from './types';

interface Props {
  signal: string;
  value: number;
  savedValue: number;
  total: number;
  max: number;
  disabled: boolean;
  onChange: (raw: string) => void;
}

const RankingWeightControl: React.FC<Props> = ({ signal, value, savedValue, total, max, disabled, onChange }) => {
  const { t } = useTranslation();
  const Icon = SIGNAL_ICONS[signal];
  const share = weightShare(value, total);
  const changed = value !== savedValue;
  const label = t(`admin.ranking.signals.${signal}`, SIGNAL_LABELS[signal] ?? signal);
  const isFeatured = signal === 'featured';

  return (
    <div className={`rounded-xl border p-4 transition-colors ${changed ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {Icon && (
            <span
              className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isFeatured ? 'bg-primary-50 text-primary-800' : 'bg-gray-50 text-blue-600'
              }`}
            >
              <Icon size={18} />
            </span>
          )}
          <div className="min-w-0">
            <label htmlFor={`weight-${signal}`} className="block text-sm font-semibold text-gray-900">
              {label}
            </label>
            <p className="text-xs text-gray-500 mt-0.5">{t(`admin.ranking.signalHelp.${signal}`, SIGNAL_HELP[signal] ?? '')}</p>
          </div>
        </div>
        <input
          id={`weight-${signal}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500 flex-shrink-0"
        />
      </div>

      <input
        type="range"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="w-full mt-4 accent-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
      />

      <div className="flex items-center justify-between gap-3 mt-2 text-xs">
        <span className="text-gray-500">{t('admin.ranking.influence', 'Relative influence')}</span>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full ${isFeatured ? 'bg-primary-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(100, share)}%` }} />
          </div>
          <span className="font-semibold text-gray-900 tabular-nums w-12 text-end" dir="ltr">
            {share}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default RankingWeightControl;
