import { Router } from 'express';
import { getVendorBySlug, getVendorProducts, getVendors } from '../controllers/vendors';

const router = Router();

router.get('/', getVendors);
router.get('/:slug', getVendorBySlug);
router.get('/:slug/products', getVendorProducts);

export default router;

