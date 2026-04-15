import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { verifyEmail, resendRegistrationOTP, clearError } from '../store/slices/authSlice';

type VerifyLocationState = { userId?: string; phone?: string; email?: string };

const VERIFY_SESSION_KEY = 'goknary_pending_verify';

const readStoredVerify = (): VerifyLocationState => {
  try {
    const raw = sessionStorage.getItem(VERIFY_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as VerifyLocationState;
  } catch {
    return {};
  }
};

const VerifyEmailPage: React.FC = () => {
  const { t }    = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const stored = { ...readStoredVerify(), ...((location.state as VerifyLocationState) || {}) };
  const [userId] = useState(stored.userId || '');
  const [phone]  = useState(stored.phone  || stored.email || '');

  // 6 individual digit inputs
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => { if (!userId) navigate('/register', { replace: true }); }, [userId, navigate]);
  useEffect(() => { if (isAuthenticated) navigate('/', { replace: true }); }, [isAuthenticated, navigate]);
  useEffect(() => { return () => { dispatch(clearError()); }; }, [dispatch]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Handle digit input for each box
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next  = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
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
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { if (i < 6) next[i] = ch; });
    setDigits(next);
    const lastFilled = Math.min(pasted.length, 5);
    inputRefs.current[lastFilled]?.focus();
  };

  const otp       = digits.join('');
  const otpFilled = otp.length === 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpFilled) return;
    try {
      await dispatch(verifyEmail({ userId, otp })).unwrap();
      sessionStorage.removeItem(VERIFY_SESSION_KEY);
      navigate('/', { replace: true });
    } catch {
      // Redux holds error — shake the boxes
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (!userId || resendCooldown > 0) return;
    setResendStatus('sending');
    try {
      await dispatch(resendRegistrationOTP({ userId })).unwrap();
      setResendStatus('sent');
      setResendCooldown(60); // 60s cooldown
    } catch {
      setResendStatus('error');
    }
  };

  if (!userId) return null;

  // Mask the phone for display: +201*****678
  const maskedPhone = phone
    ? phone.length > 7
      ? `${phone.slice(0, 3)}${'*'.repeat(phone.length - 6)}${phone.slice(-3)}`
      : phone
    : '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-green-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-md w-full"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-2xl mb-4">
            <MessageCircle size={30} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('auth.verifyWhatsAppTitle', 'Verify Your WhatsApp')}
          </h1>
          <p className="mt-2 text-sm text-gray-500 max-w-xs mx-auto">
            We sent a <strong>6-digit code</strong> to your WhatsApp
            {maskedPhone && (
              <> at <span className="font-semibold text-gray-700">{maskedPhone}</span></>
            )}
            . Enter it below.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-3xl shadow-lg shadow-gray-200/60 p-8 border border-gray-100 space-y-6"
        >
          {error && (
            <motion.div
              key={error}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"
            >
              {error}
            </motion.div>
          )}
          {resendStatus === 'sent' && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm">
              ✅ A new code has been sent to your WhatsApp!
            </div>
          )}
          {resendStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              Failed to resend code. Please try again.
            </div>
          )}

          {/* 6-box OTP input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-center mb-4">
              {t('auth.verificationCode', 'Verification Code')}
            </label>
            <div className="flex gap-3 justify-center" onPaste={handlePaste}>
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
                  className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl transition-all outline-none
                    ${d ? 'border-green-500 bg-green-50 text-green-900' : 'border-gray-200 bg-gray-50 text-gray-900'}
                    focus:border-green-400 focus:ring-2 focus:ring-green-100 focus:bg-white`}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400 text-center">
              Code expires in {process.env.REACT_APP_OTP_EXPIRES_MINUTES || '10'} minutes
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !otpFilled}
            className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-all shadow-md shadow-green-200 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Verifying…
              </span>
            ) : t('auth.verifyAndContinue', 'Verify & Continue')}
          </button>

          {/* Resend */}
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Didn't receive a code?</p>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendStatus === 'sending' || resendCooldown > 0}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={14} className={resendStatus === 'sending' ? 'animate-spin' : ''} />
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : resendStatus === 'sending'
                ? 'Sending…'
                : t('auth.resendCode', 'Resend Code via WhatsApp')}
            </button>
          </div>

          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700">
              {t('auth.backToLogin', '← Back to Login')}
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default VerifyEmailPage;
