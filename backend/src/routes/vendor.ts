import { Router } from 'express';
import { getVendorProfile, updateVendorProfile, applyForVendor } from '../controllers/vendor';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public route
router.post('/apply', authenticate, applyForVendor);

// Protected vendor routes
router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

router.get('/me', getVendorProfile);
router.patch('/me', updateVendorProfile);

export default router;

