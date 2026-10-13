import React from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, ShieldAlert, CheckCircle2, Clock, UserCheck, AlertTriangle } from 'lucide-react';
import { ProductHubProductOverview } from '../../types/productHub';

interface ProductModerationProps {
  product: ProductHubProductOverview;
  role: 'admin' | 'vendor';
}

export const ProductModeration: React.FC<ProductModerationProps> = ({ product, role }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Shield size={18} className="text-indigo-600" />
            <span>{t('productHub.moderation.title', 'Moderation & Governance')}</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productHub.moderation.subtitle', 'Review queue progression and catalog moderation log')}
          </p>
        </div>
      </div>

      {/* Prominent Rejection Banner if REJECTED */}
      {product.status === 'REJECTED' && (
        <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={18} className="text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                {t('productHub.moderation.rejectionHeader', 'Moderation Rejection Notice')}
              </h4>
              <p className="text-xs mt-1 font-medium">
                {product.rejectionReason || t('productHub.moderation.noReasonProvided', 'No specific reason provided by moderation staff.')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
          <span className="text-gray-400 font-medium">{t('productHub.moderation.statusLabel', 'Current Status')}</span>
          <div className="font-bold text-gray-900 mt-1 flex items-center gap-1.5">
            {product.status === 'APPROVED' || product.status === 'ACTIVE' ? (
              <CheckCircle2 size={14} className="text-emerald-600" />
            ) : product.status === 'PENDING' ? (
              <Clock size={14} className="text-amber-600" />
            ) : product.status === 'REJECTED' ? (
              <ShieldAlert size={14} className="text-rose-600" />
            ) : (
              <AlertTriangle size={14} className="text-gray-400" />
            )}
            <span>{product.status}</span>
          </div>
        </div>

        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
          <span className="text-gray-400 font-medium">{t('productHub.moderation.submittedAtLabel', 'Submitted At')}</span>
          <div className="font-semibold text-gray-800 mt-1">{formatDate(product.submittedAt)}</div>
        </div>

        <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
          <span className="text-gray-400 font-medium">{t('productHub.moderation.reviewedAtLabel', 'Reviewed At')}</span>
          <div className="font-semibold text-gray-800 mt-1">{formatDate(product.reviewedAt)}</div>
        </div>

        {/* Reviewer identity: Admin sees reviewer info; Vendor does NOT */}
        {role === 'admin' ? (
          <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
            <span className="text-gray-400 font-medium">{t('productHub.moderation.reviewedByLabel', 'Reviewed By')}</span>
            <div className="font-semibold text-gray-800 mt-1 flex items-center gap-1">
              <UserCheck size={13} className="text-blue-600" />
              <span className="truncate">{product.reviewerName || product.reviewedBy || '—'}</span>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50/50 rounded-xl p-3 border border-gray-100">
            <span className="text-gray-400 font-medium">{t('productHub.moderation.reviewChannel', 'Review Channel')}</span>
            <div className="font-semibold text-gray-800 mt-1">
              {t('productHub.moderation.marketplaceAdmin', 'Platform Moderation Team')}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
