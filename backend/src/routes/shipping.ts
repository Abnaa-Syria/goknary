import { Router } from 'express';
import { getActiveRates, getAllRates, createRate, updateRate, deleteRate } from '../controllers/shipping';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

// Public route for checkout
router.get('/active', getActiveRates);

// Admin routes
router.get('/', authenticate, authorize('ADMIN', 'STAFF'), requirePermission('READ_SHIPPING'), getAllRates);
router.post('/', authenticate, authorize('ADMIN', 'STAFF'), requirePermission('CREATE_SHIPPING'), createRate);
router.patch('/:id', authenticate, authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_SHIPPING'), updateRate);
router.delete('/:id', authenticate, authorize('ADMIN', 'STAFF'), requirePermission('DELETE_SHIPPING'), deleteRate);

export default router;
