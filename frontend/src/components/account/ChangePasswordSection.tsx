import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

interface ChangePasswordSectionProps {
  /** Optional heading; defaults to account.changePassword */
  title?: string;
  className?: string;
}

const ChangePasswordSection: React.FC<ChangePasswordSectionProps> = ({ title, className = '' }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('account.passwordMinLength'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.response?.data?.error || t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`card p-6 ${className}`.trim()}>
      <h3 className="text-lg font-semibold mb-4">{title ?? t('account.changePassword')}</h3>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            {t('account.passwordUpdated')}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-2">{t('account.currentPassword')}</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('account.newPassword')}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input-field w-full"
            minLength={8}
            required
          />
          <p className="text-xs text-gray-500 mt-1">{t('account.passwordMinLength')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">{t('auth.confirmPassword')}</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input-field w-full"
            minLength={8}
            required
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary disabled:opacity-50">
          {loading ? t('account.saving') : t('account.updatePassword')}
        </button>
      </form>
    </div>
  );
};

export default ChangePasswordSection;
