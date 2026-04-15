import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, Lock, MessageCircle, Eye, EyeOff, RefreshCw } from 'lucide-react';
import api from '../lib/api';

type Step = 'phone' | 'otp' | 'new-password' | 'success';

/**
 * Password reset — WhatsApp OTP flow:
 *   Step 1: Enter WhatsApp number → POST /auth/forgot-password  { phone }
 *   Step 2: Enter 6-digit OTP + new password → POST /auth/reset-password  { phone, otp, newPassword }
 */
const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();

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
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <MessageCircle size={28} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {step === 'phone'
              ? t('auth.forgotPasswordTitle', 'Reset Your Password')
              : step === 'success'
              ? '🎉 Password Reset!'
              : 'Enter Your Code'}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {step === 'phone'
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

          {/* ── Step 1: Phone ── */}
          {step === 'phone' && (
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
                  WhatsApp Verification Code
                </label>
                <div className="flex gap-3 justify-center" onPaste={handlePaste}>
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => { inputRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleDigitChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      className={`w-11 h-13 text-center text-xl font-bold border-2 rounded-xl transition-all outline-none
                        ${d ? 'border-green-500 bg-green-50 text-green-900' : 'border-gray-200 bg-gray-50 text-gray-900'}
                        focus:border-green-400 focus:ring-2 focus:ring-green-100 focus:bg-white`}
                    />
                  ))}
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="Min. 8 characters"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={loading || !otpComplete}
                className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200 disabled:opacity-60">
                {loading ? 'Resetting Password…' : 'Reset Password'}
              </button>

              {/* Resend link */}
              <div className="text-center">
                <button type="button" onClick={handleResend} disabled={cooldown > 0 || loading}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors">
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
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
