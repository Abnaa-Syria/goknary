import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { User, Mail, Lock, Phone, Eye, EyeOff, MessageCircle } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { register, clearError } from '../store/slices/authSlice';

const VERIFY_SESSION_KEY = 'goknary_pending_verify';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    name:            '',
    email:           '',
    phone:           '',
    password:        '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword]        = useState(false);
  const [showConfirm,  setShowConfirm]         = useState(false);
  const [validationError, setValidationError]  = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => { dispatch(clearError()); };
  }, [dispatch]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValidationError('');
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    // --- Client-side validation ---
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Passwords do not match.');
      return;
    }
    if (formData.password.length < 8) {
      setValidationError('Password must be at least 8 characters.');
      return;
    }
    // Basic E.164 check: starts with + followed by 8–15 digits
    const phoneE164 = /^\+[1-9]\d{7,14}$/.test(formData.phone);
    if (!phoneE164) {
      setValidationError('Enter your WhatsApp number in international format, e.g. +201012345678');
      return;
    }

    try {
      const result = await dispatch(
        register({
          name:     formData.name,
          email:    formData.email,
          phone:    formData.phone,
          password: formData.password,
        })
      ).unwrap();

      if (result.requiresVerification && result.userId) {
        sessionStorage.setItem(
          VERIFY_SESSION_KEY,
          JSON.stringify({ userId: result.userId, phone: formData.phone })
        );
        navigate('/verify-email', { state: { userId: result.userId, phone: formData.phone } });
        return;
      }

      navigate('/');
    } catch {
      // Error held in Redux state
    }
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-primary-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-100 rounded-2xl mb-4">
            <span className="text-2xl font-black text-primary-600">G</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('auth.createAccount', 'Create Account')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('auth.haveAccount', 'Already have an account?')}{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
              {t('auth.signIn', 'Sign in')}
            </Link>
          </p>
        </div>

        {/* WhatsApp notice */}
        <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-2xl mb-6">
          <MessageCircle size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">
            We'll send a <strong>6-digit code</strong> to your <strong>WhatsApp</strong> to verify your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-white rounded-3xl shadow-lg shadow-gray-200/60 p-8 border border-gray-100">
          {displayError && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
            >
              {displayError}
            </motion.div>
          )}

          {/* Full Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.name', 'Full Name')}
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="name"
                name="name"
                type="text"
                required
                value={formData.name}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="Ahmed Mohamed"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email', 'Email Address')}
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {/* WhatsApp Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              WhatsApp Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                placeholder="+201012345678"
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">Include country code, e.g. +20 for Egypt, +1 for USA</p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password', 'Password')}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.confirmPassword', 'Confirm Password')}
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200 disabled:opacity-60 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Sending WhatsApp Code…
              </span>
            ) : t('auth.createAccount', 'Create Account')}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default RegisterPage;
