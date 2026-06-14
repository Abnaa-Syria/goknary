import { Router } from 'express';
import {
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
  updateVendorStatus,
  updateVendorCommission,
  settleVendorBalance
} from '../controllers/admin-vendors';
import { getAdminVendorProducts } from '../controllers/admin';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

router.get('/', requirePermission('READ_VENDORS'), getVendors);
router.get('/:id', requirePermission('READ_VENDORS'), getVendorById);
router.patch('/:id/approve', requirePermission('UPDATE_VENDORS'), approveVendor);
router.patch('/:id/reject', requirePermission('UPDATE_VENDORS'), rejectVendor);
router.patch('/:id/suspend', requirePermission('UPDATE_VENDORS'), suspendVendor);
router.patch('/:id/status', requirePermission('UPDATE_VENDORS'), updateVendorStatus);
router.patch('/:id/commission', requirePermission('UPDATE_VENDORS'), updateVendorCommission);
router.post('/:id/settle', requirePermission('UPDATE_VENDORS'), settleVendorBalance);

export default router;

