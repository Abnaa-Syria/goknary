import { Router } from 'express';
import { getVendorAnalytics, getVendorProductAnalytics } from '../controllers/vendor-analytics';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

router.get('/', getVendorAnalytics);
router.get('/products', getVendorProductAnalytics);

export default router;

