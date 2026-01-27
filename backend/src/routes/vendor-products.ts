import { Router } from 'express';
import {
  getVendorProducts,
  getVendorProduct,
  createVendorProduct,
  updateVendorProduct,
  deleteVendorProduct,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
} from '../controllers/vendor-products';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('VENDOR', 'ADMIN'));

// Product routes
router.get('/', getVendorProducts);
router.get('/:id', getVendorProduct);
router.post('/', createVendorProduct);
router.patch('/:id', updateVendorProduct);
router.delete('/:id', deleteVendorProduct);

// Product Variants routes
router.get('/:productId/variants', getProductVariants);
router.post('/:productId/variants', createProductVariant);
router.patch('/:productId/variants/:variantId', updateProductVariant);
router.delete('/:productId/variants/:variantId', deleteProductVariant);

export default router;

