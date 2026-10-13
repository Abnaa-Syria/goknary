import { 
  getDashboardStats, 
  getAdminOrderById, 
  getAdminOrders,
  getUsers, 
  updateUser, 
  createUser,
  forceResetPassword,
  getPendingAdminProducts,
  updateProductStatus,
  approveProduct,
  rejectProduct,
  getAdminProductPreview,
  deleteProduct,
  updateAdminOrderStatus,
  createPlatformProduct,
  settlePlatform,
  getSearchAnalytics
} from '../controllers/admin';
import {
  createCoupon,
  getAdminCoupons,
  updateAdminCoupon,
  deleteAdminCoupon
} from '../controllers/admin-coupons';
import {
  getRankingConfig,
  updateRankingConfig,
  recomputeRanking,
  previewRanking
} from '../controllers/admin-ranking';
import { getAdminProducts, getAdminProductHub, setProductFeatured } from '../controllers/admin-products';
import {
  getAdminSuggestions,
  decideAdminSuggestion,
  generateAdminSuggestions
} from '../controllers/discount-suggestions';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

import { Router } from 'express';

const router = Router();

// All admin routes require authentication + ADMIN or STAFF role
router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

// Dashboard
router.get('/dashboard', requirePermission('READ_DASHBOARD'), getDashboardStats);
router.get('/search-analytics', requirePermission('READ_DASHBOARD'), getSearchAnalytics);
router.post('/platform/settle', requirePermission('MANAGE_ROLES'), settlePlatform);

// Orders
router.get('/orders', requirePermission('READ_ORDERS'), getAdminOrders);
router.get('/orders/:id', requirePermission('READ_ORDERS'), getAdminOrderById);
router.patch('/orders/:id/status', requirePermission('UPDATE_ORDERS'), updateAdminOrderStatus);

// User Management
router.get('/users', requirePermission('READ_USERS'), getUsers);
router.post('/users', requirePermission('CREATE_USERS'), createUser);
router.patch('/users/:id', requirePermission('UPDATE_USERS'), updateUser);
router.patch('/users/:id/password', requirePermission('UPDATE_USERS'), forceResetPassword);

// Catalog Governance (General)
router.get('/products', requirePermission('READ_PRODUCTS'), getAdminProducts);
router.get('/products/:id/hub', requirePermission('READ_PRODUCTS'), getAdminProductHub);
router.patch('/products/:id/featured', requirePermission('UPDATE_PRODUCTS'), setProductFeatured);
router.get('/products/pending', requirePermission('READ_PRODUCTS'), getPendingAdminProducts);
router.get('/products/:id/preview', requirePermission('READ_PRODUCTS'), getAdminProductPreview);
router.post('/products/:id/approve', requirePermission('UPDATE_PRODUCTS'), approveProduct);
router.post('/products/:id/reject', requirePermission('UPDATE_PRODUCTS'), rejectProduct);
router.patch('/products/:id/status', requirePermission('UPDATE_PRODUCTS'), updateProductStatus);
router.post('/products/platform', requirePermission('CREATE_PRODUCTS'), createPlatformProduct);
router.delete('/products/:id', requirePermission('DELETE_PRODUCTS'), deleteProduct);

// Coupon Governance
router.post('/coupons', requirePermission('CREATE_COUPONS'), createCoupon);
router.get('/coupons', requirePermission('READ_COUPONS'), getAdminCoupons);
router.patch('/coupons/:id', requirePermission('UPDATE_COUPONS'), updateAdminCoupon);
router.delete('/coupons/:id', requirePermission('DELETE_COUPONS'), deleteAdminCoupon);

// Marketplace Ranking (F4)
router.get('/ranking-config', requirePermission('READ_SETTINGS'), getRankingConfig);
router.put('/ranking-config', requirePermission('UPDATE_SETTINGS'), updateRankingConfig);
router.post('/ranking/preview', requirePermission('READ_SETTINGS'), previewRanking);
router.post('/ranking/recompute', requirePermission('UPDATE_SETTINGS'), recomputeRanking);

// Discount Suggestions (F2) — approving one changes product pricing, so it needs UPDATE_PRODUCTS.
router.get('/discount-suggestions', requirePermission('READ_PRODUCTS'), getAdminSuggestions);
router.post('/discount-suggestions/generate', requirePermission('UPDATE_PRODUCTS'), generateAdminSuggestions);
router.patch('/discount-suggestions/:id', requirePermission('UPDATE_PRODUCTS'), decideAdminSuggestion);

export default router;
