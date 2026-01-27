import { Router } from 'express';
import { getVendorOrders, getVendorOrder, updateOrderStatus } from '../controllers/vendor-orders';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

router.get('/', getVendorOrders);
router.get('/:id', getVendorOrder);
router.patch('/:id/status', updateOrderStatus);

export default router;

