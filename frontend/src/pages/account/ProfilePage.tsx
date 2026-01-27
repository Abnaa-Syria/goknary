import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';
import api from '../../lib/api';

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      await api.patch('/auth/profile', formData);
      setSuccess(true);
      dispatch(getCurrentUser());
    } catch (error: any) {
      alert(error.response?.data?.error || t('messages.errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('account.profileSettings')}</h2>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">{t('account.email')}</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="input-field bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">{t('account.emailCannotChange')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('account.fullName')}</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input-field"
              placeholder={t('account.enterFullName')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t('account.phoneNumber')}</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="input-field"
              placeholder="+201234567890"
            />
          </div>

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {t('account.profileUpdated')}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50"
          >
            {loading ? t('account.saving') : t('account.saveChanges')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;

