import React from 'react';
import { useTranslation } from 'react-i18next';
import { getImageUrl } from '../../utils/image';
import {
  REFUND_METHOD_LABELS,
  REFUND_STATUS_LABELS,
  REFUND_STATUS_STYLES,
  RETURN_REASON_LABELS,
  RefundHistoryEntry,
  RefundStatus,
  toCurrentRefundStatus,
} from '../../lib/refunds';

export const RefundStatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => {
  const { t } = useTranslation();
  const current = toCurrentRefundStatus(status);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${REFUND_STATUS_STYLES[current] ?? 'bg-gray-50 text-gray-700 border-gray-200'} ${className}`}>
      {t(`returns.status.${current}`, REFUND_STATUS_LABELS[current] ?? current)}
    </span>
  );
};

export const useRefundLabels = () => {
  const { t } = useTranslation();
  return {
    status: (status: RefundStatus) => t(`returns.status.${status}`, REFUND_STATUS_LABELS[status] ?? status),
    reason: (reason: string) =>
      reason in RETURN_REASON_LABELS
        ? t(`returns.reasons.${reason}`, RETURN_REASON_LABELS[reason as keyof typeof RETURN_REASON_LABELS])
        : reason === 'PAYMENT_AFTER_CANCELLATION'
          ? t('returns.paymentAfterCancellation', 'Payment received after the order was cancelled')
          : reason,
    method: (method: string | null | undefined) =>
      method ? t(`returns.methods.${method}`, REFUND_METHOD_LABELS[method] ?? method) : '—',
  };
};

export const RefundTimeline: React.FC<{ history: RefundHistoryEntry[]; showActor?: boolean }> = ({ history, showActor = true }) => {
  const { t, i18n } = useTranslation();
  const labels = useRefundLabels();
  if (history.length === 0) {
    return <p className="text-xs text-gray-400">{t('returns.noHistory', 'No status changes recorded yet.')}</p>;
  }
  return (
    <ol className="space-y-3">
      {history.map((entry, index) => (
        <li key={entry.id} className="flex gap-3 relative">
          {index < history.length - 1 && <span className="absolute top-4 start-[5px] bottom-[-14px] w-[2px] bg-gray-100" />}
          <span className="mt-1.5 w-3 h-3 rounded-full bg-secondary-600 ring-4 ring-secondary-50 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-bold text-gray-800">
              {labels.status(entry.toStatus)}
              {showActor && entry.actorRole && (
                <span className="ms-2 font-medium text-gray-400">· {t(`returns.actors.${entry.actorRole}`, entry.actorRole)}</span>
              )}
            </p>
            {entry.notes && <p className="text-gray-500 mt-0.5 whitespace-pre-line">{entry.notes}</p>}
            <p className="text-[10px] text-gray-400 mt-0.5">
              {new Date(entry.createdAt).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
};

export const RefundEvidence: React.FC<{ images: string[] }> = ({ images }) => {
  const { t } = useTranslation();
  if (images.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider mb-1.5">{t('returns.evidence', 'Proof images')}</p>
      <div className="flex flex-wrap gap-2">
        {images.map((src) => (
          <a key={src} href={getImageUrl(src)} target="_blank" rel="noopener noreferrer">
            <img src={getImageUrl(src)} alt="" className="w-16 h-16 rounded-xl object-cover border border-gray-100 hover:opacity-80" />
          </a>
        ))}
      </div>
    </div>
  );
};
