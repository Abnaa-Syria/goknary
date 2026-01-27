import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  removeFromWishlistByProductId,
  checkWishlistStatus,
} from '../controllers/wishlist';
import { authenticate } from '../middleware/auth';

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/:id', removeFromWishlist);
router.delete('/product/:productId', removeFromWishlistByProductId);
router.get('/check/:productId', checkWishlistStatus);

export default router;

