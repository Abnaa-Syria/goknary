import { Router } from 'express';
import {
  createRefundRequest,
  getRefundRequests,
  getRefundRequestById,
  updateVendorRefundStatus,
  updateAdminRefundStatus,
} from '../controllers/refunds';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Protect all refund routes
router.use(authenticate);

// Customers can create, view and read individual refunds
router.post('/', authorize('CUSTOMER'), createRefundRequest);
router.get('/', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), getRefundRequests);
router.get('/:id', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), getRefundRequestById);

// Vendor and Admin specific actions
router.patch('/:id/vendor', authorize('VENDOR'), updateVendorRefundStatus);
router.patch('/:id/admin', authorize('ADMIN', 'STAFF'), updateAdminRefundStatus);

export default router;
