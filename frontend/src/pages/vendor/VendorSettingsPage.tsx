import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Store, 
  Image as ImageIcon, 
  FileText, 
  Shield, 
  Lock, 
  Save, 
  Loader2,
  Key,
  Globe,
  Camera,
  ScrollText
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { storeAuthTokens } from '../../lib/api';
import { useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';
import ImageUploader from '../../components/common/ImageUploader';
import { getRequestErrorMessage, uploadImages } from '../../utils/upload';
import { getImageUrl } from '../../utils/image';
import { POLICY_MAX_LENGTH, RETURN_WINDOW_MAX_DAYS, VendorPolicyFields } from '../../lib/vendorPolicies';

interface Vendor extends VendorPolicyFields {
  id: string;
  storeName: string;
  description?: string;
  logo?: string;
  banner?: string;
}

const POLICY_TEXT_FIELDS = [
  ['returnPolicy', 'Return Policy'],
  ['returnPolicyAr', 'Return Policy (Arabic)'],
  ['shippingPolicy', 'Shipping Policy'],
  ['shippingPolicyAr', 'Shipping Policy (Arabic)'],
  ['exchangePolicy', 'Exchange Policy'],
  ['exchangePolicyAr', 'Exchange Policy (Arabic)'],
] as const;

type PolicyTextField = (typeof POLICY_TEXT_FIELDS)[number][0];
type PolicyForm = Record<PolicyTextField, string> & { returnWindowDays: string };

const toPolicyForm = (v: VendorPolicyFields): PolicyForm => ({
  returnPolicy: v.returnPolicy || '',
  returnPolicyAr: v.returnPolicyAr || '',
  shippingPolicy: v.shippingPolicy || '',
  shippingPolicyAr: v.shippingPolicyAr || '',
  exchangePolicy: v.exchangePolicy || '',
  exchangePolicyAr: v.exchangePolicyAr || '',
  returnWindowDays: v.returnWindowDays === null || v.returnWindowDays === undefined ? '' : String(v.returnWindowDays),
});

const VendorSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  
  // Profile/Store Form State
  const [profileLoading, setProfileLoading] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    logo: [] as (File | string)[],
    banner: [] as (File | string)[],
  });

  // Policies Form State
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policyForm, setPolicyForm] = useState<PolicyForm>(toPolicyForm({}));
  const [policyErrors, setPolicyErrors] = useState<Partial<Record<keyof PolicyForm, string>>>({});

  // Password Form State
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchVendorProfile();
  }, []);

  const fetchVendorProfile = async (resetPolicies = true) => {
    try {
      const response = await api.get('/vendor/me');
      const vendorData = response.data.vendor;
      setVendor(vendorData);
      setFormData({
        storeName: vendorData.storeName || '',
        description: vendorData.description || '',
        logo: vendorData.logo ? [vendorData.logo] : [],
        banner: vendorData.banner ? [vendorData.banner] : [],
      });
      if (resetPolicies) setPolicyForm(toPolicyForm(vendorData));
    } catch (error: any) {
      toast.error(t('vendor.failedLoadProfile', 'Failed to load store profile'));
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName.trim()) {
      toast.error(t('vendor.storeNameRequired', 'Store name is required'));
      return;
    }

    setProfileLoading(true);
    try {
      // 1. Process images (Local Files -> URLs)
      const [logoUrl] = await uploadImages(formData.logo);
      const [bannerUrl] = await uploadImages(formData.banner);

      // 2. Submit to API
      await api.patch('/vendor/me', {
        storeName: formData.storeName,
        description: formData.description,
        logo: logoUrl || '',
        banner: bannerUrl || '',
      });
      toast.success(t('vendor.updateSuccess', 'Storefront updated successfully'));
      fetchVendorProfile(false);
      dispatch(getCurrentUser()); // Sync global user state if store info is linked
    } catch (error: any) {
      toast.error(getRequestErrorMessage(error, t('vendor.updateFailed', 'Failed to update storefront'), t('common.uploadFailed')));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePoliciesSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Partial<Record<keyof PolicyForm, string>> = {};
    for (const [field] of POLICY_TEXT_FIELDS) {
      if (policyForm[field].length > POLICY_MAX_LENGTH) {
        errors[field] = t('policies.policyTooLong', { max: POLICY_MAX_LENGTH, defaultValue: 'Each policy can be at most {{max}} characters' });
      }
    }
    const daysRaw = policyForm.returnWindowDays.trim();
    const days = daysRaw === '' ? null : Number(daysRaw);
    if (days !== null && (!/^\d+$/.test(daysRaw) || days > RETURN_WINDOW_MAX_DAYS)) {
      errors.returnWindowDays = t('policies.returnWindowInvalid', 'Return window must be a whole number between 0 and 365');
    }
    setPolicyErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setPoliciesLoading(true);
    try {
      // Only policy fields are sent, so branding fields on the server stay untouched.
      const payload: Record<string, string | number | null> = { returnWindowDays: days };
      for (const [field] of POLICY_TEXT_FIELDS) payload[field] = policyForm[field].trim() || null;
      const response = await api.patch('/vendor/me', payload);
      setVendor(response.data.vendor);
      setPolicyForm(toPolicyForm(response.data.vendor));
      toast.success(t('policies.saved', 'Store policies updated'));
    } catch (error: any) {
      const details = error.response?.data?.details;
      toast.error(details?.[0]?.message || error.response?.data?.error || t('policies.saveFailed', 'Failed to update store policies'));
    } finally {
      setPoliciesLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('vendor.passwordsDoNotMatch', 'New passwords do not match'));
      return;
    }

    setPasswordLoading(true);
    try {
      const { data } = await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      storeAuthTokens(data?.accessToken, data?.refreshToken);
      toast.success(t('vendor.credentialsUpdated', 'Security credentials updated'));
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('vendor.failedChangePassword', 'Failed to change password'));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!vendor && !profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
        <Loader2 className="animate-spin text-purple-600 mb-4" size={32} />
        <p className="text-gray-500 font-medium">{t('vendor.syncingSettings', 'Syncing store settings...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('vendor.storeSettings', 'Store Settings')}</h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">{t('vendor.settingsPage.subtitle', 'Customize your brand identity and secure your vendor dashboard access')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Card 1: Storefront Branding */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
              <Store size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('vendor.profileSettings', 'Brand Identity')}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('vendor.storeAppearanceDesc', 'Your store appearance on GoKnary')}</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
            <div className="space-y-5">
              {/* Store Name */}
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  {t('vendor.storeName', 'Store Name *')}
                </label>
                <div className="relative">
                  <Globe className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder={t('vendor.settingsPage.storeNamePlaceholder', 'e.g. Premium Tech Store')}
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  {t('vendor.storeDescription', 'Store Description')}
                </label>
                <div className="relative">
                  <FileText className="absolute start-4 top-4 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all min-h-[100px]"
                    placeholder={t('vendor.settingsPage.storeDescPlaceholder', "Describe your store's mission and products...")}
                  />
                </div>
              </div>

              {/* Logo & Banner Uploaders */}
              <div className="space-y-6">
                <ImageUploader
                  label={t('vendor.storeLogo', 'Store Logo')}
                  value={formData.logo}
                  onChange={(val) => setFormData({ ...formData, logo: val })}
                  multiple={false}
                  helperText={t('vendor.storeLogoHelp', 'Recommended: 512x512px SVG or PNG')}
                />
                
                <ImageUploader
                  label={t('vendor.storeBanner', 'Store Banner')}
                  value={formData.banner}
                  onChange={(val) => setFormData({ ...formData, banner: val })}
                  multiple={false}
                  helperText={t('vendor.storeBannerHelp', 'Recommended: 1920x400px high-resolution banner')}
                />
              </div>

              {/* Legacy Previews Removed in favor of ImageUploader local previews */}
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 disabled:opacity-50 transition-all shadow-lg shadow-purple-100"
              >
                {profileLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>{t('vendor.saveChanges', 'Save Storefront Changes')}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Card 2: Security & Password */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-red-100 text-red-600 rounded-xl">
              <Key size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('vendor.passwordChange', 'Security Credentials')}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('vendor.protectAccountDesc', 'Protect your seller account access')}</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-red-500 transition-colors">
                  {t('vendor.currentPassword', 'Current Password')}
                </label>
                <div className="relative">
                  <Lock className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100 my-4"></div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  {t('vendor.newPassword', 'New Password')}
                </label>
                <div className="relative">
                  <Shield className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder={t('vendor.settingsPage.newPassPlaceholder', 'Minimum 8 characters')}
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  {t('vendor.confirmPassword', 'Confirm New Password')}
                </label>
                <div className="relative">
                  <Shield className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder={t('vendor.settingsPage.confirmPassPlaceholder', 'Repeat new password')}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-red-600 text-white font-bold rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-lg shadow-red-200"
              >
                {passwordLoading ? <Loader2 className="animate-spin" size={20} /> : <Shield size={20} />}
                <span>{t('vendor.saveChanges', 'Update Access Credentials')}</span>
              </button>
            </div>
          </form>
        </section>

        {/* Card 3: Store Policies */}
        <section className="xl:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
              <ScrollText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('policies.storePolicies', 'Store Policies')}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('policies.storePoliciesDesc', 'Return, shipping and exchange terms shown to customers')}</p>
            </div>
          </div>

          <form onSubmit={handlePoliciesSubmit} className="p-8 space-y-6" noValidate>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {POLICY_TEXT_FIELDS.map(([field, fallback]) => (
                <div key={field} className="relative group">
                  <label htmlFor={`policy-${field}`} className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-blue-600 transition-colors">
                    {t(`policies.${field}`, fallback)}
                  </label>
                  <textarea
                    id={`policy-${field}`}
                    value={policyForm[field]}
                    onChange={(e) => setPolicyForm({ ...policyForm, [field]: e.target.value })}
                    rows={4}
                    maxLength={POLICY_MAX_LENGTH}
                    dir={field.endsWith('Ar') ? 'rtl' : 'ltr'}
                    className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${policyErrors[field] ? 'border-red-400' : 'border-gray-200'}`}
                    placeholder={t('policies.policyPlaceholder', 'Plain text. Line breaks are kept.')}
                  />
                  <div className="flex justify-between mt-1 px-1 text-[11px]">
                    <span className="text-red-500">{policyErrors[field]}</span>
                    <span className="text-gray-400">{policyForm[field].length}/{POLICY_MAX_LENGTH}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative group max-w-xs">
              <label htmlFor="policy-returnWindowDays" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-blue-600 transition-colors">
                {t('policies.returnWindowDays', 'Return Window (days)')}
              </label>
              <input
                id="policy-returnWindowDays"
                type="number"
                inputMode="numeric"
                min={0}
                max={RETURN_WINDOW_MAX_DAYS}
                step={1}
                value={policyForm.returnWindowDays}
                onChange={(e) => setPolicyForm({ ...policyForm, returnWindowDays: e.target.value })}
                className={`w-full px-4 py-3 bg-gray-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all ${policyErrors.returnWindowDays ? 'border-red-400' : 'border-gray-200'}`}
                placeholder="14"
              />
              <p className={`mt-1 px-1 text-[11px] ${policyErrors.returnWindowDays ? 'text-red-500' : 'text-gray-400'}`}>
                {policyErrors.returnWindowDays || t('policies.returnWindowHelp', 'Leave empty if you do not offer a fixed return period. Whole number from 0 to 365.')}
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={policiesLoading}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100"
              >
                {policiesLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>{t('policies.save', 'Save Policies')}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default VendorSettingsPage;

