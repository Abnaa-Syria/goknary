import { Router } from 'express';
import { 
  createReview, 
  updateReview, 
  deleteReview, 
  getAdminReviews, 
  deleteAdminReview 
} from '../controllers/reviews';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

// User routes
router.post('/', authenticate, authorize('CUSTOMER'), createReview);
router.patch('/:id', authenticate, authorize('CUSTOMER'), updateReview);
router.delete('/:id', authenticate, authorize('CUSTOMER'), deleteReview);

// Admin routes
router.get('/admin', authenticate, requirePermission('READ_REVIEWS'), getAdminReviews);
router.delete('/admin/:id', authenticate, requirePermission('DELETE_REVIEWS'), deleteAdminReview);

export default router;
