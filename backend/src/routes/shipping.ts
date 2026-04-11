import { Router } from 'express';
import { getActiveRates, getAllRates, createRate, updateRate, deleteRate } from '../controllers/shipping';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public route for checkout
router.get('/active', getActiveRates);

// Admin routes
router.get('/', authenticate, authorize('ADMIN'), getAllRates);
router.post('/', authenticate, authorize('ADMIN'), createRate);
router.patch('/:id', authenticate, authorize('ADMIN'), updateRate);
router.delete('/:id', authenticate, authorize('ADMIN'), deleteRate);

export default router;
