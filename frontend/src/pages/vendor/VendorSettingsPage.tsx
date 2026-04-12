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
  Camera
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';
import ImageUploader from '../../components/common/ImageUploader';
import { uploadImages } from '../../utils/upload';
import { getImageUrl } from '../../utils/image';

interface Vendor {
  id: string;
  storeName: string;
  description?: string;
  logo?: string;
  banner?: string;
}

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

  const fetchVendorProfile = async () => {
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
    } catch (error: any) {
      toast.error('Failed to load store profile');
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.storeName.trim()) {
      toast.error('Store name is required');
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
      toast.success('Storefront updated successfully');
      fetchVendorProfile();
      dispatch(getCurrentUser()); // Sync global user state if store info is linked
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update storefront');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      toast.success('Security credentials updated');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!vendor && !profileLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-3xl border border-gray-100 shadow-sm animate-pulse">
        <Loader2 className="animate-spin text-purple-600 mb-4" size={32} />
        <p className="text-gray-500 font-medium">Syncing store settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Store Settings</h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">Customize your brand identity and secure your vendor dashboard access</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Card 1: Storefront Branding */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-purple-100 text-purple-600 rounded-xl">
              <Store size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Brand Identity</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">Your store appearance on GoKnary</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
            <div className="space-y-5">
              {/* Store Name */}
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  Store Name *
                </label>
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder="e.g. Premium Tech Store"
                    required
                  />
                </div>
              </div>

              {/* Description */}
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  Store Description
                </label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all min-h-[100px]"
                    placeholder="Describe your store's mission and products..."
                  />
                </div>
              </div>

              {/* Logo & Banner Uploaders */}
              <div className="space-y-6">
                <ImageUploader
                  label="Store Logo"
                  value={formData.logo}
                  onChange={(val) => setFormData({ ...formData, logo: val })}
                  multiple={false}
                  helperText="Recommended: 512x512px SVG or PNG"
                />
                
                <ImageUploader
                  label="Store Banner"
                  value={formData.banner}
                  onChange={(val) => setFormData({ ...formData, banner: val })}
                  multiple={false}
                  helperText="Recommended: 1920x400px high-resolution banner"
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
                <span>Save Storefront Changes</span>
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
              <h2 className="text-lg font-bold text-gray-900">Security Credentials</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">Protect your seller account access</p>
            </div>
          </div>

          <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-red-500 transition-colors">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-500 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              <div className="h-px bg-gray-100 my-4"></div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  New Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-purple-600 transition-colors">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                    placeholder="Repeat new password"
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
                <span>Update Access Credentials</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};

export default VendorSettingsPage;

