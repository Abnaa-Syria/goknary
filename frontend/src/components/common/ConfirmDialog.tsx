import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** In-app replacement for window.confirm: focus starts on Cancel, Escape and the backdrop cancel. */
const ConfirmDialog: React.FC<Props> = ({ open, title, message, confirmLabel, tone = 'default', busy, onConfirm, onCancel }) => {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const latest = useRef({ busy, onCancel });
  latest.current = { busy, onCancel };

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !latest.current.busy) latest.current.onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 text-start"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold text-gray-900">{title}</h2>
        <div id="confirm-dialog-message" className="mt-2 text-sm text-gray-600 space-y-2">{message}</div>
        <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 min-h-[44px] px-4 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 min-h-[44px] px-4 rounded-xl text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${
              tone === 'danger' ? 'bg-red-600 hover:bg-red-700 focus-visible:ring-red-600' : 'bg-gray-900 hover:bg-gray-800 focus-visible:ring-gray-900'
            }`}
          >
            {busy ? t('common.processing', 'Processing...') : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
