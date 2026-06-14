import { Router } from 'express';
import { getProducts, getProductBySlug, getProductReviews, createProductReview } from '../controllers/products';
import { getRelatedProducts, getRecentProducts } from '../controllers/products-enhancements';
import { authenticate } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 requests per windowMs
  message: { error: 'Too many search requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.get('/', searchLimiter, getProducts);
router.get('/recent', getRecentProducts);
router.get('/:slug', getProductBySlug);
router.get('/:slug/related', getRelatedProducts);
router.get('/:slug/reviews', getProductReviews);
router.post('/:slug/reviews', authenticate, createProductReview);

export default router;

