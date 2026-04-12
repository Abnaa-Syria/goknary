import { Router } from 'express';
import { 
  createReview, 
  updateReview, 
  deleteReview, 
  getAdminReviews, 
  deleteAdminReview 
} from '../controllers/reviews';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();

// User routes
router.post('/', authenticate, createReview);
router.patch('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);

// Admin routes
router.get('/admin', authenticate, requirePermission('READ_REVIEWS'), getAdminReviews);
router.delete('/admin/:id', authenticate, requirePermission('DELETE_REVIEWS'), deleteAdminReview);

export default router;
