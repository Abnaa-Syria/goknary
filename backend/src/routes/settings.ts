import { Router } from 'express';
import { getPublicSettings, getAdminSettings, updateSettings } from '../controllers/settings';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public settings route
router.get('/public', getPublicSettings);

// Admin-only settings routes
router.get('/', authenticate, authorize('ADMIN', 'STAFF'), getAdminSettings);
router.put('/', authenticate, authorize('ADMIN', 'STAFF'), updateSettings);

export default router;
