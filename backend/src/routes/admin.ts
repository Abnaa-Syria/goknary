import { 
  getDashboardStats, 
  getAdminOrderById, 
  getAdminOrders,
  getUsers, 
  updateUser, 
  createUser,
  forceResetPassword,
  updateProductStatus,
  deleteProduct
} from '../controllers/admin';
import {
  createCoupon,
  getAdminCoupons,
  updateAdminCoupon,
  deleteAdminCoupon
} from '../controllers/admin-coupons';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

import { Router } from 'express';

const router = Router();

// All admin routes require authentication + ADMIN or STAFF role
router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

// Dashboard
router.get('/dashboard', requirePermission('READ_DASHBOARD'), getDashboardStats);

// Orders
router.get('/orders', requirePermission('READ_ORDERS'), getAdminOrders);
router.get('/orders/:id', requirePermission('READ_ORDERS'), getAdminOrderById);

// User Management
router.get('/users', requirePermission('READ_USERS'), getUsers);
router.post('/users', requirePermission('CREATE_USERS'), createUser);
router.patch('/users/:id', requirePermission('UPDATE_USERS'), updateUser);
router.patch('/users/:id/password', requirePermission('UPDATE_USERS'), forceResetPassword);

// Catalog Governance (General)
router.patch('/products/:id/status', requirePermission('UPDATE_PRODUCTS'), updateProductStatus);
router.delete('/products/:id', requirePermission('DELETE_PRODUCTS'), deleteProduct);

// Coupon Governance
router.post('/coupons', requirePermission('CREATE_COUPONS'), createCoupon);
router.get('/coupons', requirePermission('READ_COUPONS'), getAdminCoupons);
router.patch('/coupons/:id', requirePermission('UPDATE_COUPONS'), updateAdminCoupon);
router.delete('/coupons/:id', requirePermission('DELETE_COUPONS'), deleteAdminCoupon);

export default router;
