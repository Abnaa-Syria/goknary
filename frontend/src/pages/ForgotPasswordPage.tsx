import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, Mail, MessageCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import api, { clearAuthSession } from '../lib/api';
import { useAppDispatch } from '../store/hooks';
import { tokensSyncedFromStorage } from '../store/slices/authSlice';

type Step = 'phone' | 'otp' | 'new-password' | 'success';
type Method = 'email' | 'whatsapp';

/**
 * Password reset, two methods:
 *   Email (default): Enter email → POST /auth/forgot-password { email } → link to /reset-password?token=...
 *   WhatsApp OTP:
 *     Step 1: Enter WhatsApp number → POST /auth/forgot-password  { phone }
 *     Step 2: Enter 6-digit OTP + new password → POST /auth/reset-password  { phone, otp, newPassword }
 */
const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [method,        setMethod]        = useState<Method>('email');
  const [email,         setEmail]         = useState('');
  const [emailSent,     setEmailSent]     = useState(false);
  const [step,          setStep]          = useState<Step>('phone');
  const [phone,         setPhone]         = useState('');
  const [digits,        setDigits]        = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword,   setNewPassword]   = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [message,       setMessage]       = useState<string | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [cooldown,      setCooldown]      = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError(null);
    setMessage(null);
  };

  // ── Email: request reset link ──────────────────────────────────────────────
  const handleRequestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError(t('auth.invalidEmail', 'Please enter a valid email address.'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email: normalized });
      setEmailSent(true);
    } catch (err: any) {
      setError(err.response?.data?.error || t('messages.errorOccurred', 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Step 1: request OTP ────────────────────────────────────────────────────
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const phoneE164 = /^\+[1-9]\d{7,14}$/.test(phone);
    if (!phoneE164) {
      setError('Enter your WhatsApp number in international format, e.g. +201012345678');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { phone });
      setMessage(res.data?.message || 'Code sent to WhatsApp!');
      setStep('otp');
      setCooldown(60);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err.response?.data?.error || t('messages.errorOccurred', 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (cooldown > 0) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { phone });
      setMessage('A new code has been sent to your WhatsApp!');
      setCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: verify OTP + set new password ─────────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const otp = digits.join('');
    if (otp.length !== 6) {
      setError('Please enter the full 6-digit code.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPass) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { phone, otp, newPassword });
      clearAuthSession();
      dispatch(tokensSyncedFromStorage({ accessToken: null, refreshToken: null }));
      setMessage(res.data?.message || 'Password reset successfully!');
      setStep('success');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid or expired code. Please try again.');
      setDigits(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
    } finally {
      setLoading(false);
    }
  };

  // ── Digit input helpers ────────────────────────────────────────────────────
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => { if (i < 6) next[i] = c; });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const otpComplete = digits.join('').length === 6;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-green-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          {method === 'email' ? (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
              <Mail size={28} className="text-primary-600" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
              <MessageCircle size={28} className="text-green-600" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {method === 'email'
              ? emailSent
                ? t('auth.resetEmailSentTitle', 'Check your email')
                : t('auth.forgotPasswordTitle', 'Reset Your Password')
              : step === 'phone'
              ? t('auth.forgotPasswordTitle', 'Reset Your Password')
              : step === 'success'
              ? '🎉 Password Reset!'
              : 'Enter Your Code'}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {method === 'email'
              ? emailSent
                ? t('auth.resetEmailSent')
                : t('auth.forgotPasswordHint')
              : step === 'phone'
              ? "Enter your WhatsApp number and we'll send you a verification code."
              : step === 'success'
              ? 'Your password has been successfully reset.'
              : `Enter the 6-digit code sent to your WhatsApp and choose a new password.`}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-lg shadow-gray-200/60 p-8 border border-gray-100">

          {/* Global error / message */}
          <AnimatePresence>
            {error && (
              <motion.div key="err" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </motion.div>
            )}
            {message && step !== 'success' && (
              <motion.div key="msg" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
                {message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Method choice (before anything was sent) ── */}
          {step === 'phone' && !emailSent && (
            <div role="tablist" className="grid grid-cols-2 gap-2 p-1 mb-5 bg-gray-100 rounded-xl text-sm font-medium">
              {(['email', 'whatsapp'] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => switchMethod(m)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all ${
                    method === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'email' ? <Mail size={15} /> : <MessageCircle size={15} />}
                  {m === 'email' ? t('auth.resetByEmail', 'Email') : t('auth.resetByWhatsApp', 'WhatsApp')}
                </button>
              ))}
            </div>
          )}

          {/* ── Email: request link ── */}
          {method === 'email' && !emailSent && (
            <form onSubmit={handleRequestEmail} className="space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  {t('auth.email', 'Email')}
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(null); }}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200 disabled:opacity-60">
                {loading ? t('auth.sendingResetLink', 'Sending…') : t('auth.sendResetLink', 'Send reset link')}
              </button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-primary-600 hover:underline font-medium">
                  {t('auth.backToLogin', '← Back to Login')}
                </Link>
              </p>
            </form>
          )}

          {/* ── Email: sent confirmation (same text whether or not the account exists) ── */}
          {method === 'email' && emailSent && (
            <div role="status" className="text-center space-y-4">
              <p className="text-sm text-gray-600">{t('auth.resetEmailSpamHint')}</p>
              <Link
                to="/login"
                className="inline-block w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all text-center shadow-md shadow-primary-200"
              >
                {t('auth.backToLogin', 'Back to sign in')}
              </Link>
            </div>
          )}

          {/* ── Step 1: Phone ── */}
          {method === 'whatsapp' && step === 'phone' && (
            <form onSubmit={handleRequestOTP} className="space-y-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  WhatsApp Number
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(null); }}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                    placeholder="+201012345678"
                    required
                  />
                </div>
                <p className="mt-1 text-xs text-gray-400">Include country code, e.g. +20 for Egypt</p>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-md shadow-green-200 disabled:opacity-60">
                {loading ? 'Sending Code…' : 'Send WhatsApp Code'}
              </button>
              <p className="text-center text-sm">
                <Link to="/login" className="text-primary-600 hover:underline font-medium">
                  {t('auth.backToLogin', '← Back to Login')}
                </Link>
              </p>
            </form>
          )}

          {/* ── Step 2: OTP + New Password ── */}
          {step === 'otp' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* 6-box OTP */}
              <div>
                <label className="block text-sm font-medium text-gray-700 text-center mb-3">
                  {t('auth.whatsappVerificationCode', 'WhatsApp Verification Code')}
                </label>
                <div className="flex gap-2 sm:gap-3 justify-center" dir="ltr" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-10 h-12 sm:w-14 sm:h-16 text-center text-xl sm:text-3xl font-extrabold border-2 rounded-xl sm:rounded-2xl transition-all duration-200 outline-none
                        ${d ? 'border-green-600 bg-green-50/50 text-green-900 shadow-sm shadow-green-100/50' : 'border-gray-200 bg-gray-50 text-gray-800'}
                        focus:border-green-500 focus:ring-4 focus:ring-green-100 focus:bg-white focus:shadow-md`}
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('account.newPassword', 'New Password')}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder={t('auth.newPassPlaceholder', 'Min. 8 characters')}
                    required
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('auth.confirmPassword', 'Confirm Password')}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder={t('auth.confirmPassPlaceholder', 'Repeat new password')}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !otpComplete}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200 disabled:opacity-60">
                {loading ? t('auth.resettingPassword', 'Resetting Password…') : t('auth.resetPassword', 'Reset Password')}
              </button>

              {/* Resend link */}
              <div className="text-center">
                <button type="button" onClick={handleResend} disabled={cooldown > 0 || loading}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : t('auth.resendCodeWhatsApp', 'Resend Code via WhatsApp')}
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3: Success ── */}
          {step === 'success' && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <p className="text-gray-600 text-sm">{message}</p>
              <Link
                to="/login"
                className="inline-block w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all text-center shadow-md shadow-primary-200"
              >
                Sign In with New Password
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;
