import { Router } from 'express';
import { getDashboardStats, getAdminOrderById } from '../controllers/admin';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboardStats);
router.get('/orders/:id', getAdminOrderById);

export default router;

