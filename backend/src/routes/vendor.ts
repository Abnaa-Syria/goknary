import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { applyForVendor, getVendorProfile, updateVendorProfile } from '../controllers/vendor';

const router = Router();

// H-05 Fix: authenticate applied ONCE at router level — removed duplicate on /apply route
router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

router.post('/apply', applyForVendor);
router.get('/me', getVendorProfile);
router.patch('/me', updateVendorProfile);

export default router;
