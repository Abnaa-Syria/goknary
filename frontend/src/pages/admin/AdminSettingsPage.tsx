import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Save, 
  Loader2,
  Key,
  Phone,
  Globe,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';
import { fetchPublicSettings } from '../../store/slices/settingsSlice';

const AdminSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  // Profile Form State
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });

  // Password Form State
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Settings states
  const [settings, setSettings] = useState({
    free_shipping_threshold: '500',
    support_phone: '',
    facebook_url: '',
    instagram_url: '',
    linkedin_url: '',
    twitter_url: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      });
    }
    fetchSettings();
  }, [user]);

  const fetchSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings({
        free_shipping_threshold: response.data.freeShippingThreshold?.toString() || '500',
        support_phone: response.data.supportPhone || '',
        facebook_url: response.data.facebookUrl || '',
        instagram_url: response.data.instagramUrl || '',
        linkedin_url: response.data.linkedinUrl || '',
        twitter_url: response.data.twitterUrl || '',
      });
    } catch (error) {
      toast.error(t('admin.settingsPage.settingsLoadFailed'));
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success(t('admin.settingsPage.settingsUpdateSuccess'));
      dispatch(fetchPublicSettings()); // Update Redux state dynamically for Header/Footer/etc.
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.settingsPage.settingsUpdateFailed'));
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await api.patch('/auth/profile', {
        name: profileData.name,
        email: profileData.email,
      });
      toast.success(t('admin.settingsPage.profileUpdateSuccess'));
      dispatch(getCurrentUser());
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.settingsPage.profileUpdateFailed'));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('admin.settingsPage.passwordMismatch'));
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success(t('admin.settingsPage.passwordChangeSuccess'));
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.settingsPage.passwordChangeFailed'));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('admin.settingsPage.title')}</h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">{t('admin.settingsPage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Card 1: Identity & Profile */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-primary-100 text-primary-600 rounded-xl">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('admin.settingsPage.generalInfo')}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('admin.settingsPage.generalInfoDesc')}</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.fullName')}
                </label>
                <div className="relative">
                  <User className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder={t('admin.settingsPage.fullNamePlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.email')}
                </label>
                <div className="relative">
                  <Mail className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="name@goknary.com"
                    required
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3">
                <Shield className="text-blue-500 shrink-0" size={18} />
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  {t('admin.settingsPage.emailNotice')}
                </p>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-lg shadow-gray-200"
              >
                {profileLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>{t('admin.settingsPage.saveChanges')}</span>
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
              <h2 className="text-lg font-bold text-gray-900">{t('admin.settingsPage.security')}</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('admin.settingsPage.securityDesc')}</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-red-500 transition-colors">
                  {t('admin.settingsPage.currentPassword')}
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
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.newPassword')}
                </label>
                <div className="relative">
                  <Shield className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder={t('admin.settingsPage.newPasswordPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.confirmPassword')}
                </label>
                <div className="relative">
                  <Shield className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder={t('admin.settingsPage.confirmPasswordPlaceholder')}
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
                <span>{t('admin.settingsPage.updatePassword')}</span>
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Card 3: Platform Global Settings */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
          <div className="p-2 bg-primary-100 text-primary-600 rounded-xl">
            <Settings size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('admin.settingsPage.globalTitle')}</h2>
            <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{t('admin.settingsPage.globalSubtitle')}</p>
          </div>
        </div>

        {settingsLoading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-primary-600" size={20} />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          <form onSubmit={handleSettingsSubmit} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Free Shipping Threshold */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.freeShippingThreshold')}
                </label>
                <input
                  type="number"
                  min="0"
                  value={settings.free_shipping_threshold}
                  onChange={e => setSettings({ ...settings, free_shipping_threshold: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-mono font-bold"
                  required
                />
              </div>

              {/* Support Phone */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.supportPhone')}
                </label>
                <div className="relative">
                  <Phone className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={settings.support_phone}
                    onChange={e => setSettings({ ...settings, support_phone: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-medium"
                    placeholder="+20 100 000 0000"
                  />
                </div>
              </div>

              {/* Facebook URL */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.facebookUrl')}
                </label>
                <div className="relative">
                  <Globe className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="url"
                    value={settings.facebook_url}
                    onChange={e => setSettings({ ...settings, facebook_url: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="https://facebook.com/page"
                  />
                </div>
              </div>

              {/* Instagram URL */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.instagramUrl')}
                </label>
                <div className="relative">
                  <Globe className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="url"
                    value={settings.instagram_url}
                    onChange={e => setSettings({ ...settings, instagram_url: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="https://instagram.com/profile"
                  />
                </div>
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.linkedinUrl')}
                </label>
                <div className="relative">
                  <Globe className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="url"
                    value={settings.linkedin_url}
                    onChange={e => setSettings({ ...settings, linkedin_url: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="https://linkedin.com/company"
                  />
                </div>
              </div>

              {/* Twitter URL */}
              <div className="space-y-1.5 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  {t('admin.settingsPage.twitterUrl')}
                </label>
                <div className="relative">
                  <Globe className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="url"
                    value={settings.twitter_url}
                    onChange={e => setSettings({ ...settings, twitter_url: e.target.value })}
                    className="w-full ps-12 pe-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="https://twitter.com/profile"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={settingsSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-primary-600 text-white font-bold rounded-2xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-lg shadow-primary-100"
              >
                {settingsSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>{settingsSaving ? t('admin.settingsPage.savingSettings') : t('admin.settingsPage.saveSettings')}</span>
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
};

export default AdminSettingsPage;
