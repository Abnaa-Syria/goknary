import { 
  getDashboardStats, 
  getAdminOrderById, 
  getAdminOrders,
  getUsers, 
  updateUser, 
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
import { authenticate, authorize } from '../middleware/auth';

import { Router } from 'express';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboardStats);
router.get('/orders', getAdminOrders);
router.get('/orders/:id', getAdminOrderById);

// User Management
router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.patch('/users/:id/password', forceResetPassword);

// Catalog Governance (General)
router.patch('/products/:id/status', updateProductStatus);
router.delete('/products/:id', deleteProduct);

// Coupon Governance
router.post('/coupons', createCoupon);
router.get('/coupons', getAdminCoupons);
router.patch('/coupons/:id', updateAdminCoupon);
router.delete('/coupons/:id', deleteAdminCoupon);

export default router;
