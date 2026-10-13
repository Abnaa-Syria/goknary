import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Clock, EyeOff, FileEdit } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Tone = 'neutral' | 'info' | 'danger' | 'success';

const TONES: Record<Tone, string> = {
  neutral: 'bg-gray-50 border-gray-200 text-gray-800',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  danger: 'bg-red-50 border-red-200 text-red-900',
  success: 'bg-green-50 border-green-200 text-green-900',
};

const STATUS_CONFIG: Record<string, { tone: Tone; icon: LucideIcon; title: string; body: string }> = {
  DRAFT: { tone: 'neutral', icon: FileEdit, title: 'productPreview.draftTitle', body: 'productPreview.draftBody' },
  PENDING: { tone: 'info', icon: Clock, title: 'productPreview.pendingTitle', body: 'productPreview.pendingBody' },
  REJECTED: { tone: 'danger', icon: AlertTriangle, title: 'productPreview.rejectedTitle', body: 'productPreview.rejectedBody' },
  INACTIVE: { tone: 'neutral', icon: EyeOff, title: 'productPreview.inactiveTitle', body: 'productPreview.inactiveBody' },
  ACTIVE: { tone: 'success', icon: CheckCircle2, title: 'productPreview.liveTitle', body: 'productPreview.liveBody' },
  APPROVED: { tone: 'success', icon: CheckCircle2, title: 'productPreview.liveTitle', body: 'productPreview.liveBody' },
};

interface Props {
  status: string;
  rejectionReason?: string | null;
  /** Rendered under the explanation, e.g. "Edit product". */
  actions?: React.ReactNode;
}

/** States plainly that this is not the public storefront, and what the current status means for the seller. */
const ProductPreviewStatusBanner: React.FC<Props> = ({ status, rejectionReason, actions }) => {
  const { t } = useTranslation();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT;
  const Icon = config.icon;
  const live = status === 'ACTIVE' || status === 'APPROVED';

  return (
    <section aria-labelledby="preview-status-title" className={`rounded-2xl border p-4 sm:p-5 ${TONES[config.tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {live ? t('productPreview.modeLabel') : t('productPreview.notVisible')}
      </p>
      <div className="mt-2 flex items-start gap-3">
        <Icon size={22} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 id="preview-status-title" className="text-base sm:text-lg font-bold">
            {t(config.title)}
            <span className="sr-only"> — {t(`productPreview.status.${status}`, status)}</span>
          </h2>
          <p className="mt-1 text-sm opacity-90">{t(config.body)}</p>
          {status === 'REJECTED' && rejectionReason && (
            <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 text-red-900">
              <p className="text-sm font-bold">{t('productPreview.rejectionReason')}</p>
              <p dir="auto" className="mt-1 text-sm whitespace-pre-line break-words">{rejectionReason}</p>
            </div>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
};

export default ProductPreviewStatusBanner;
