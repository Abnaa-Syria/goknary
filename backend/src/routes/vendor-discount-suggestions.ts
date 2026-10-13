import { Router } from 'express';
import { decideVendorSuggestion, getVendorSuggestions } from '../controllers/discount-suggestions';
import { authenticate, authorize } from '../middleware/auth';

// Vendors see and decide their own suggestions only; platform staff use /api/admin/discount-suggestions.
const router = Router();

router.use(authenticate);
router.use(authorize('VENDOR'));

router.get('/', getVendorSuggestions);
router.patch('/:id', decideVendorSuggestion);

export default router;
