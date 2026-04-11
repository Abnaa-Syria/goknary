import { Router } from 'express';
import { getProducts, getProductBySlug, getProductReviews, createProductReview } from '../controllers/products';
import { getRelatedProducts, getRecentProducts } from '../controllers/products-enhancements';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', getProducts);
router.get('/recent', getRecentProducts);
router.get('/:slug', getProductBySlug);
router.get('/:slug/related', getRelatedProducts);
router.get('/:slug/reviews', getProductReviews);
router.post('/:slug/reviews', authenticate, createProductReview);

export default router;

