import { Router } from 'express';
import { 
  createReview, 
  updateReview, 
  deleteReview, 
  getAdminReviews, 
  deleteAdminReview 
} from '../controllers/reviews';
import { authenticate } from '../middleware/auth';

const router = Router();

// User routes
router.post('/', authenticate, createReview);
router.patch('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);

// Admin routes
router.get('/admin', authenticate, getAdminReviews);
router.delete('/admin/:id', authenticate, deleteAdminReview);

export default router;
