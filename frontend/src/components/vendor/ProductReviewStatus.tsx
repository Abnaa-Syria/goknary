import React from 'react';
import { useTranslation } from 'react-i18next';
import { PRODUCT_STATUS_LABELS, PRODUCT_STATUS_STYLES } from '../../utils/product';

export const ProductStatusBadge: React.FC<{ status: string; className?: string }> = ({ status, className = '' }) => {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${PRODUCT_STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'} ${className}`}>
      {t(`moderation.status.${status}`, PRODUCT_STATUS_LABELS[status] ?? status)}
    </span>
  );
};

const STATUS_HINTS: Record<string, string> = {
  DRAFT: 'Only you can see this draft. Submit it for review when it is ready.',
  PENDING: 'GoKnary is reviewing this product. You can still edit it; it stays in the review queue.',
  APPROVED: 'Published. Your edits go live immediately without another review.',
  ACTIVE: 'Published. Your edits go live immediately without another review.',
  REJECTED: 'Fix the points below, then resubmit the product for review.',
  INACTIVE: 'Hidden from the store.',
};

interface Props {
  status: string;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
}

const ProductReviewStatus: React.FC<Props> = ({ status, rejectionReason, submittedAt, reviewedAt }) => {
  const { t, i18n } = useTranslation();
  const formatDate = (value: string) => new Date(value).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-US');
  return (
    <div className={`rounded-lg border p-3 text-sm ${status === 'REJECTED' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-gray-700">{t('moderation.reviewStatus', 'Review status')}:</span>
        <ProductStatusBadge status={status} />
        {status === 'PENDING' && submittedAt && (
          <span className="text-xs text-gray-500">{t('moderation.submittedOn', 'Submitted {{date}}', { date: formatDate(submittedAt) })}</span>
        )}
        {status === 'REJECTED' && reviewedAt && (
          <span className="text-xs text-gray-500">{t('moderation.reviewedOn', 'Reviewed {{date}}', { date: formatDate(reviewedAt) })}</span>
        )}
      </div>
      <p className="text-xs text-gray-600 mt-1">{t(`moderation.hint.${status}`, STATUS_HINTS[status] ?? '')}</p>
      {status === 'REJECTED' && rejectionReason && (
        <p className="mt-2 text-sm text-red-700 whitespace-pre-line">
          <span className="font-semibold">{t('moderation.rejectionReason', 'Rejection reason')}:</span> {rejectionReason}
        </p>
      )}
    </div>
  );
};

export default ProductReviewStatus;
