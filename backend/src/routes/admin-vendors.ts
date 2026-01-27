import { Router } from 'express';
import {
  getVendors,
  getVendorById,
  approveVendor,
  rejectVendor,
  suspendVendor,
} from '../controllers/admin-vendors';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getVendors);
router.get('/:id', getVendorById);
router.patch('/:id/approve', approveVendor);
router.patch('/:id/reject', rejectVendor);
router.patch('/:id/suspend', suspendVendor);

export default router;

