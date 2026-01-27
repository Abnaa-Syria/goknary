import { Router } from 'express';
import { getProducts, getProductBySlug, getProductReviews, createProductReview } from '../controllers/products';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/', getProducts);
router.get('/:slug', getProductBySlug);
router.get('/:slug/reviews', getProductReviews);
router.post('/:slug/reviews', authenticate, createProductReview);

export default router;

