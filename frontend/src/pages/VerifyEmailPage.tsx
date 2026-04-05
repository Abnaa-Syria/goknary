import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { verifyEmail, resendRegistrationOTP, clearError } from '../store/slices/authSlice';

type VerifyLocationState = { userId?: string; email?: string };

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
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, loading, error } = useAppSelector((state) => state.auth);

  const merged = { ...readStoredVerify(), ...((location.state as VerifyLocationState) || {}) };
  const [userId] = useState(merged.userId || '');
  const [email] = useState(merged.email || '');
  const [otp, setOtp] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  useEffect(() => {
    if (!userId) {
      navigate('/register', { replace: true });
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    return () => {
      dispatch(clearError());
    };
  }, [dispatch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = otp.replace(/\D/g, '').slice(0, 6);
    if (digits.length !== 6) {
      return;
    }
    try {
      await dispatch(verifyEmail({ userId, otp: digits })).unwrap();
      sessionStorage.removeItem(VERIFY_SESSION_KEY);
      navigate('/', { replace: true });
    } catch {
      // Redux holds error
    }
  };

  const handleResend = async () => {
    if (!userId) return;
    setResendStatus('sending');
    try {
      await dispatch(resendRegistrationOTP({ userId })).unwrap();
      setResendStatus('sent');
    } catch {
      setResendStatus('error');
    }
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">{t('auth.verifyEmailTitle')}</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.verifyEmailHint')}
            {email ? (
              <>
                {' '}
                <span className="font-medium text-gray-800">{email}</span>
              </>
            ) : null}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
          )}
          {resendStatus === 'sent' && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              {t('auth.verifyCodeResent')}
            </div>
          )}
          {resendStatus === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {t('auth.verifyResendFailed')}
            </div>
          )}

          <div>
            <label htmlFor="otp" className="block text-sm font-medium text-gray-700 text-center mb-2">
              {t('auth.verificationCode')}
            </label>
            <input
              id="otp"
              name="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 input-field text-center text-2xl tracking-[0.4em] font-mono"
              placeholder="000000"
            />
            <p className="mt-2 text-xs text-gray-500 text-center">{t('auth.verifyCodeExpiry')}</p>
          </div>

          <button
            type="submit"
            disabled={loading || otp.replace(/\D/g, '').length !== 6}
            className="w-full btn-primary disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.verifyAndContinue')}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={resendStatus === 'sending'}
              className="text-sm font-medium text-primary-500 hover:text-primary-600 disabled:opacity-50"
            >
              {resendStatus === 'sending' ? t('common.loading') : t('auth.resendCode')}
            </button>
          </div>

          <p className="text-center text-sm text-gray-600">
            <Link to="/login" className="font-medium text-primary-500 hover:text-primary-600">
              {t('auth.backToLogin')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
