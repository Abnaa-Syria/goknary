import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export const REJECTION_REASON_MIN = 3;
export const REJECTION_REASON_MAX = 1000;

interface Props {
  /** Modal is open while a product name is set. */
  productName: string | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

const RejectProductModal: React.FC<Props> = ({ productName, submitting, onCancel, onConfirm }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (productName) setReason('');
  }, [productName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (trimmed.length < REJECTION_REASON_MIN) {
      toast.error(t('moderation.reasonRequired', 'Please explain why the product is rejected'));
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <AnimatePresence>
      {productName && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 z-10 text-start"
          >
            <h3 className="text-xl font-bold text-gray-900 mb-1">{t('moderation.rejectTitle', 'Reject product')}</h3>
            <p className="text-sm font-semibold text-gray-700 mb-2">{productName}</p>
            <p className="text-xs text-gray-500 mb-4">
              {t('moderation.rejectHelp', 'The vendor sees this reason on the product and can fix it and resubmit.')}
            </p>
            <form onSubmit={submit} className="space-y-4">
              <textarea
                rows={4}
                value={reason}
                maxLength={REJECTION_REASON_MAX}
                onChange={(e) => setReason(e.target.value)}
                required
                placeholder={t('moderation.reasonPlaceholder', 'e.g. Images are blurry, please upload clear photos of the product.')}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white text-sm"
              />
              <p className="text-[10px] text-gray-400 text-end">{reason.length}/{REJECTION_REASON_MAX}</p>
              <div className="flex gap-3">
                <button type="button" onClick={onCancel} className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 text-sm">
                  {t('common.cancel', 'Cancel')}
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                  {submitting ? t('common.processing', 'Processing...') : t('moderation.confirmReject', 'Reject product')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RejectProductModal;
