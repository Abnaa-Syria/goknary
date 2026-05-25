import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { useAppSelector } from '../../store/hooks';

interface VendorApplyPageProps {
  onApplied?: () => void;
}

const VendorApplyPage: React.FC<VendorApplyPageProps> = ({ onApplied }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, isInitialized, user } = useAppSelector((state) => state.auth);
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await api.post('/vendor/apply', formData);
      setSuccess(true);
      setTimeout(() => {
        if (onApplied) onApplied();
        else navigate('/');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || t('vendor.applyPage.failedSubmit', 'Failed to submit application'));
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while auth state initializes
  if (!isInitialized) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Not logged in — show login/register prompt
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center">
          <div className="card p-8">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-3">{t('vendor.applyPage.title', 'Become a Vendor')}</h1>
            <p className="text-gray-600 mb-6">
              {t('vendor.applyPage.loginRequired', 'You need to have an account and be logged in to apply as a vendor. Please log in or create an account first.')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/login"
                state={{ from: { pathname: '/become-vendor' } }}
                className="btn-primary px-6 py-3 text-center"
              >
                {t('auth.signIn', 'Sign In')}
              </Link>
              <Link
                to="/register"
                state={{ from: { pathname: '/become-vendor' } }}
                className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-colors text-center"
              >
                {t('auth.createAccount', 'Create Account')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Already a vendor
  if (user?.role === 'VENDOR') {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-lg mx-auto text-center card p-8">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-3">{t('vendor.applyPage.alreadyVendor', 'You are already a vendor!')}</h1>
          <p className="text-gray-600 mb-6">
            {t('vendor.applyPage.goToDashboard', 'Head to your vendor dashboard to manage your store.')}
          </p>
          <Link to="/vendor" className="btn-primary px-6 py-3">
            {t('vendor.dashboard', 'Vendor Dashboard')}
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto card p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-4">{t('vendor.applyPage.submittedTitle', 'Application Submitted!')}</h1>
          <p className="text-gray-600">
            {t('vendor.applyPage.submittedMessage', "Your vendor application has been submitted successfully. We'll review it and notify you once it's approved.")}
          </p>
        </div>
      </div>
    );
  }

  // Main form — authenticated customer
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{t('vendor.applyPage.title', 'Become a Vendor')}</h1>

        <div className="card p-6">
          <p className="text-gray-600 mb-6">
            {t('vendor.applyPage.description', "Apply to become a vendor and start selling your products on GoKnary. Fill out the form below and we'll review your application.")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                {t('vendor.settingsPage.storeName', 'Store Name')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                className="input-field"
                placeholder={t('vendor.settingsPage.storeNamePlaceholder', 'My Awesome Store')}
                required
              />
              <p className="text-xs text-gray-500 mt-1">{t('vendor.applyPage.storeNameHelp', "This will be your store's public name")}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('vendor.settingsPage.storeDescription', 'Store Description')}</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field"
                rows={4}
                placeholder={t('vendor.settingsPage.storeDescPlaceholder', 'Tell us about your store...')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? t('vendor.productForm.updating', 'Submitting...') : t('vendor.applyPage.submit', 'Submit Application')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorApplyPage;

