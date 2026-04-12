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
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// ─── Product routes ───────────────────────────────────────────────────────────
// authorize: VENDOR (own products) | ADMIN (all) | STAFF (via permission)
// requirePermission: only enforced for STAFF — ADMIN bypasses, VENDOR uses authorize

router.get(
  '/',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('READ_PRODUCTS'),
  getVendorProducts
);

router.get(
  '/:id',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('READ_PRODUCTS'),
  getVendorProduct
);

router.post(
  '/',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('CREATE_PRODUCTS'),
  createVendorProduct
);

router.patch(
  '/:id',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('UPDATE_PRODUCTS'),
  updateVendorProduct
);

router.delete(
  '/:id',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('DELETE_PRODUCTS'),
  deleteVendorProduct
);

// ─── Variant routes ───────────────────────────────────────────────────────────

router.get(
  '/:productId/variants',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('READ_PRODUCTS'),
  getProductVariants
);

router.post(
  '/:productId/variants',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('CREATE_PRODUCTS'),
  createProductVariant
);

router.patch(
  '/:productId/variants/:variantId',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('UPDATE_PRODUCTS'),
  updateProductVariant
);

router.delete(
  '/:productId/variants/:variantId',
  authorize('VENDOR', 'ADMIN', 'STAFF'),
  requirePermission('DELETE_PRODUCTS'),
  deleteProductVariant
);

export default router;