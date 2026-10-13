import { Router } from 'express';
import { getOrders, getOrderById, createOrder, cancelOrder, returnOrder, getOrderStatusHistory } from '../controllers/orders';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// All order routes require authentication
router.use(authenticate);
router.use(authorize('CUSTOMER'));

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);
router.get('/:id/status-history', getOrderStatusHistory);
router.patch('/:id/cancel', cancelOrder);
router.patch('/:id/return', returnOrder);

export default router;

