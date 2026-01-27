import { Router } from 'express';
import { getCategories, getCategoryBySlug } from '../controllers/categories';

const router = Router();

router.get('/', getCategories);
router.get('/:slug', getCategoryBySlug);

export default router;

