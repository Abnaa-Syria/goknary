import { Router } from 'express';
import { register, login, refreshToken, logout, getMe, updateProfile } from '../controllers/auth';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);

export default router;

