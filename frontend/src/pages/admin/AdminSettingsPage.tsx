import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  User, 
  Mail, 
  Lock, 
  Shield, 
  Save, 
  Loader2,
  Key
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { getCurrentUser } from '../../store/slices/authSlice';

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

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      await api.patch('/auth/profile', {
        name: profileData.name,
        email: profileData.email,
      });
      toast.success('Identity updated successfully');
      dispatch(getCurrentUser());
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update identity');
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
      toast.success('Password changed successfully');
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

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Account Settings</h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">Manage your administrative identity and security preferences</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
        {/* Card 1: Identity & Profile */}
        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <div className="p-6 border-b border-gray-50 bg-gray-50/50 flex items-center gap-3">
            <div className="p-2 bg-primary-100 text-primary-600 rounded-xl">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">General Information</h2>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">Your public administrative profile</p>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="Enter your name"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="name@goknary.com"
                    required
                  />
                </div>
              </div>
              
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 flex gap-3">
                <Shield className="text-blue-500 shrink-0" size={18} />
                <p className="text-xs text-blue-700 leading-relaxed font-medium">
                  <strong>Verification Notice:</strong> Changing your primary email will require a one-time verification code to ensure account integrity.
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
                <span>Save Identity Changes</span>
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
              <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">Maintain a strong access protection</p>
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
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  New Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ms-1 group-focus-within:text-primary-600 transition-colors">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
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

export default AdminSettingsPage;
