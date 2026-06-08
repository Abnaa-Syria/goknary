import { Router } from 'express';
import { getPublicSettings, getAdminSettings, updateSettings, getPolicy } from '../controllers/settings';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public settings route
router.get('/public', getPublicSettings);

// Public policies route
router.get('/policies/:key', getPolicy);

// Admin-only settings routes
router.get('/', authenticate, authorize('ADMIN', 'STAFF'), getAdminSettings);
router.put('/', authenticate, authorize('ADMIN', 'STAFF'), updateSettings);

export default router;
