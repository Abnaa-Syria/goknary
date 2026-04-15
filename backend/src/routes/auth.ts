import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  updateProfile,
  verifyEmail,
  resendOTP,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);    // NEW: OTP verification
router.post('/resend-otp', resendOTP);        // NEW: resend OTP code
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

// Protected routes (require valid JWT)
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

export default router;
