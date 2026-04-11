import { Router } from 'express';
import {
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
  updateVendorStatus
} from '../controllers/admin-vendors';
import { getAdminVendorProducts } from '../controllers/admin';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getVendors);
router.get('/:id', getVendorById);
router.patch('/:id/approve', approveVendor);
router.patch('/:id/reject', rejectVendor);
router.patch('/:id/suspend', suspendVendor);
router.patch('/:id/status', updateVendorStatus);

export default router;

