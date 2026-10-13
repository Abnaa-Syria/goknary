import { Router } from 'express';
import {
  getVendorWallet,
  getVendorPayouts,
  createPayoutRequest,
  getAdminPayouts,
  updatePayoutStatus,
} from '../controllers/payouts';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

// Protect all routes
router.use(authenticate);

// Vendor endpoints
router.get('/wallet', authorize('VENDOR'), getVendorWallet);
router.get('/vendor', authorize('VENDOR'), getVendorPayouts);
router.post('/vendor', authorize('VENDOR'), createPayoutRequest);

// Admin/Staff endpoints
router.get('/admin', authorize('ADMIN', 'STAFF'), requirePermission('READ_PAYOUTS'), getAdminPayouts);
router.patch('/admin/:id', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_PAYOUTS'), updatePayoutStatus);

export default router;
