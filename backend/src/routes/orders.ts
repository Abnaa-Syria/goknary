import { Router } from 'express';
import { createOrder, getOrders, getOrderById } from '../controllers/orders';
import { authenticate } from '../middleware/auth';

const router = Router();

// All order routes require authentication
router.use(authenticate);

router.post('/', createOrder);
router.get('/', getOrders);
router.get('/:id', getOrderById);

export default router;

