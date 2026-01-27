import { Router } from 'express';
import { getVendorBySlug, getVendorProducts } from '../controllers/vendors';

const router = Router();

router.get('/:slug', getVendorBySlug);
router.get('/:slug/products', getVendorProducts);

export default router;

