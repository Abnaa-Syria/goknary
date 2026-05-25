import { Router } from 'express';
import {
  getVendorWallet,
  getVendorPayouts,
  createPayoutRequest,
  getAdminPayouts,
  updatePayoutStatus,
} from '../controllers/payouts';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(authenticate);

// Vendor endpoints
router.get('/wallet', authorize('VENDOR'), getVendorWallet);
router.get('/vendor', authorize('VENDOR'), getVendorPayouts);
router.post('/vendor', authorize('VENDOR'), createPayoutRequest);

// Admin/Staff endpoints
router.get('/admin', authorize('ADMIN', 'STAFF'), getAdminPayouts);
router.patch('/admin/:id', authorize('ADMIN', 'STAFF'), updatePayoutStatus);

export default router;
