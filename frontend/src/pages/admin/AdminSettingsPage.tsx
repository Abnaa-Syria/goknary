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
  Settings,
  FileText,
  Cookie,
  Eye
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
    terms_of_service: '',
    terms_of_service_ar: '',
    privacy_policy: '',
    privacy_policy_ar: '',
    cookie_policy: '',
    cookie_policy_ar: '',
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Policy Editor states
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'cookies'>('terms');
  const [editorLang, setEditorLang] = useState<'en' | 'ar'>('en');

  // Reusable markdown renderer matching frontend styling
  const renderLivePreview = (md: string, rtl: boolean) => {
    if (!md) {
      return (
        <div className="text-gray-400 italic text-center py-12 text-sm">
          {rtl ? 'لا يوجد نص لعرضه. اكتب شيئاً للبدء.' : 'No content to preview. Type something to start.'}
        </div>
      );
    }
    const lines = md.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();

      // H1 (Title)
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={index} className="text-2xl font-extrabold text-gray-900 mt-2 mb-4 tracking-tight">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }

      // H2
      if (trimmed.startsWith('## ')) {
        return (
          <h2 
            key={index} 
            className="text-xl font-bold text-gray-900 mt-6 mb-3 border-b border-gray-100 pb-1"
          >
            {trimmed.replace('## ', '')}
          </h2>
        );
      }

      // H3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="text-lg font-semibold text-gray-800 mt-4 mb-2">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }

      // Divider
      if (trimmed === '---') {
        return <hr key={index} className="my-6 border-gray-200" />;
      }

      // Bullet List Items
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const contentStr = trimmed.substring(2);
        return (
          <li key={index} className="ms-6 list-disc text-gray-655 mb-1 leading-relaxed text-sm">
            {parseInlineFormatting(contentStr)}
          </li>
        );
      }

      // Numbered List Items
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const contentStr = numMatch[2];
        return (
          <li key={index} className="ms-6 list-decimal text-gray-655 mb-1 leading-relaxed text-sm">
            {parseInlineFormatting(contentStr)}
          </li>
        );
      }

      // Empty space
      if (trimmed === '') {
        return null;
      }

      // Regular Paragraph
      return (
        <p key={index} className="text-gray-655 leading-relaxed mb-3 text-sm">
          {parseInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-gray-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

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
        terms_of_service: response.data.terms_of_service || '',
        terms_of_service_ar: response.data.terms_of_service_ar || '',
        privacy_policy: response.data.privacy_policy || '',
        privacy_policy_ar: response.data.privacy_policy_ar || '',
        cookie_policy: response.data.cookie_policy || '',
        cookie_policy_ar: response.data.cookie_policy_ar || '',
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

      {/* Card 4: Legal Policies Document Editor */}
      <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow col-span-1 xl:col-span-2 mt-8">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-secondary-100 text-secondary-900 rounded-xl">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">إدارة الوثائق القانونية | Legal Policies</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">تعديل شروط الخدمة وسياسة الخصوصية وملفات الارتباط للمتجر</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setEditorLang(editorLang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-xs font-bold text-gray-700"
            >
              <Globe size={14} className="text-secondary-655" />
              <span>{editorLang === 'en' ? 'Arabic (العربية)' : 'English (الإنجليزية)'}</span>
            </button>
          </div>
        </div>

        {settingsLoading ? (
          <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="animate-spin text-secondary-655" size={20} />
            <span>{t('common.loading')}</span>
          </div>
        ) : (
          <div className="p-6 sm:p-8 space-y-6 text-start">
            {/* Tab Selectors */}
            <div className="flex border-b border-gray-100 pb-px">
              {[
                { id: 'terms', icon: FileText, label: 'Terms of Service', labelAr: 'شروط الخدمة' },
                { id: 'privacy', icon: Shield, label: 'Privacy Policy', labelAr: 'سياسة الخصوصية' },
                { id: 'cookies', icon: Cookie, label: 'Cookie Policy', labelAr: 'سياسة الكوكيز' }
              ].map(tab => {
                const TabIcon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-sm transition-all -mb-px ${
                      isActive 
                        ? 'border-secondary-800 text-secondary-800' 
                        : 'border-transparent text-gray-500 hover:text-gray-750 hover:border-gray-200'
                    }`}
                  >
                    <TabIcon size={16} />
                    <span>{editorLang === 'ar' ? tab.labelAr : tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Markdown Cheat Sheet Bar */}
            <div className="bg-gray-50 rounded-2xl border border-gray-200/50 p-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="font-extrabold text-secondary-700 uppercase tracking-wider border-e border-gray-200 pe-3">{editorLang === 'ar' ? 'أدوات التنسيق:' : 'Format Guide:'}</span>
              <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-755 font-bold"># {editorLang === 'ar' ? 'عنوان رئيسي' : 'Title'}</span>
              <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-755 font-bold">## {editorLang === 'ar' ? 'قسم فرعي' : 'Section'}</span>
              <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-755 font-bold">**{editorLang === 'ar' ? 'نص عريض' : 'bold'}**</span>
              <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-755 font-bold">* {editorLang === 'ar' ? 'قائمة نقطية' : 'list'}</span>
              <span className="font-mono bg-white px-2 py-1 border border-gray-200 rounded text-gray-755 font-bold">--- {editorLang === 'ar' ? 'خط فاصل' : 'divider'}</span>
            </div>

            {/* Side by Side Editor & Live Preview */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              {/* Textarea Input */}
              <div className="space-y-2 group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ms-1 group-focus-within:text-secondary-800 transition-colors">
                  {editorLang === 'ar' ? 'محتوى المستند (صيغة Markdown)' : 'Document Content (Markdown format)'}
                </label>
                <textarea
                  rows={16}
                  value={(() => {
                    if (activeTab === 'terms') return editorLang === 'ar' ? settings.terms_of_service_ar : settings.terms_of_service;
                    if (activeTab === 'privacy') return editorLang === 'ar' ? settings.privacy_policy_ar : settings.privacy_policy;
                    return editorLang === 'ar' ? settings.cookie_policy_ar : settings.cookie_policy;
                  })()}
                  onChange={(e) => {
                    const text = e.target.value;
                    const keyMap: any = {
                      'terms': editorLang === 'ar' ? 'terms_of_service_ar' : 'terms_of_service',
                      'privacy': editorLang === 'ar' ? 'privacy_policy_ar' : 'privacy_policy',
                      'cookies': editorLang === 'ar' ? 'cookie_policy_ar' : 'cookie_policy'
                    };
                    setSettings({ ...settings, [keyMap[activeTab]]: text });
                  }}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:bg-white transition-all font-mono leading-relaxed"
                  placeholder={editorLang === 'ar' ? 'اكتب محتوى الوثيقة هنا باستخدام صيغة Markdown...' : 'Write document content using Markdown format here...'}
                  dir={editorLang === 'ar' ? 'rtl' : 'ltr'}
                />
              </div>

              {/* Rendered Live Preview */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ms-1">
                  {editorLang === 'ar' ? 'معاينة مباشرة في المتجر (Live Preview)' : 'Live Storefront Preview'}
                </label>
                <div 
                  className="w-full h-[360px] xl:h-[390px] overflow-y-auto px-6 py-8 bg-white border border-gray-200 rounded-2xl relative shadow-inner overflow-x-hidden"
                  dir={editorLang === 'ar' ? 'rtl' : 'ltr'}
                >
                  {/* Top highlight bar to match public layout */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-secondary-500 to-secondary-900" />
                  
                  <div className="prose max-w-none text-start text-gray-800 text-sm">
                    {renderLivePreview(
                      (() => {
                        if (activeTab === 'terms') return editorLang === 'ar' ? settings.terms_of_service_ar : settings.terms_of_service;
                        if (activeTab === 'privacy') return editorLang === 'ar' ? settings.privacy_policy_ar : settings.privacy_policy;
                        return editorLang === 'ar' ? settings.cookie_policy_ar : settings.cookie_policy;
                      })(),
                      editorLang === 'ar'
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex justify-end pt-4 border-t border-gray-50">
              <button
                type="button"
                onClick={handleSettingsSubmit}
                disabled={settingsSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 bg-secondary-800 text-white font-bold rounded-2xl hover:bg-secondary-900 disabled:opacity-50 transition-all shadow-lg shadow-secondary-100"
              >
                {settingsSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                <span>{settingsSaving ? t('admin.settingsPage.savingSettings') : 'حفظ التعديلات القانونية | Save Policies'}</span>
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AdminSettingsPage;
