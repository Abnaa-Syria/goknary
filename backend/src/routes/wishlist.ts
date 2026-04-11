import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  removeFromWishlistByProductId,
  checkWishlistStatus,
  getWishlistCount
} from '../controllers/wishlist';
import { authenticate } from '../middleware/auth';

const router = Router();

// All wishlist routes require authentication
router.use(authenticate);

router.get('/', getWishlist);
router.post('/', addToWishlist);
// M-10 Fix: specific routes MUST come before /:id wildcard
// otherwise Express matches /check/abc and /product/abc against /:id first
router.get('/count', getWishlistCount);
router.get('/check/:productId', checkWishlistStatus);
router.delete('/product/:productId', removeFromWishlistByProductId);
router.delete('/:id', removeFromWishlist);


export default router;

