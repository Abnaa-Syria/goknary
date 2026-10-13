import { Router } from 'express';
import {
  createRefundRequest,
  getReturnEligibility,
  getRefundRequests,
  getRefundRequestById,
  startVendorReview,
  recommendRefund,
  approveRefund,
  rejectRefund,
  receiveRefundItem,
  startRefundProcessing,
  completeManualRefund,
  requestGatewayRefund,
  getCancelledPaidOrders,
  createCancelledPaymentRefund,
  updateVendorRefundStatus,
  updateAdminRefundStatus,
} from '../controllers/refunds';
import { authenticate, authorize, requirePermission, requirePermissionIfStaff } from '../middleware/auth';

const router = Router();

// Protect all refund routes
router.use(authenticate);

// Customer
router.post('/', authorize('CUSTOMER'), createRefundRequest);
router.get('/eligibility/:orderId', authorize('CUSTOMER'), getReturnEligibility);

// Admin: payments captured after cancellation (registered before /:id)
router.get('/payment-issues', authorize('ADMIN', 'STAFF'), requirePermission('READ_REFUNDS'), getCancelledPaidOrders);
router.post('/orders/:orderId/cancelled-payment', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), createCancelledPaymentRefund);

// Reads (scoped per role in the controller)
router.get('/', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), requirePermissionIfStaff('READ_REFUNDS'), getRefundRequests);
router.get('/:id', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), requirePermissionIfStaff('READ_REFUNDS'), getRefundRequestById);

// Vendor review (the platform admin makes the final decision)
router.post('/:id/review', authorize('VENDOR'), startVendorReview);
router.post('/:id/recommend', authorize('VENDOR'), recommendRefund);

// Admin workflow actions
router.post('/:id/approve', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), approveRefund);
router.post('/:id/reject', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), rejectRefund);
router.post('/:id/receive', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), receiveRefundItem);
router.post('/:id/start-refund', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), startRefundProcessing);
router.post('/:id/complete-manual', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), completeManualRefund);
router.post('/:id/gateway', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), requestGatewayRefund);

// Legacy endpoints, mapped onto the workflow above
router.patch('/:id/vendor', authorize('VENDOR'), updateVendorRefundStatus);
router.patch('/:id/admin', authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_REFUNDS'), updateAdminRefundStatus);

export default router;
