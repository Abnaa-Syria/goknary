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
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Protect all refund routes
router.use(authenticate);

// Customer
router.post('/', authorize('CUSTOMER'), createRefundRequest);
router.get('/eligibility/:orderId', authorize('CUSTOMER'), getReturnEligibility);

// Admin: payments captured after cancellation (registered before /:id)
router.get('/payment-issues', authorize('ADMIN', 'STAFF'), getCancelledPaidOrders);
router.post('/orders/:orderId/cancelled-payment', authorize('ADMIN', 'STAFF'), createCancelledPaymentRefund);

// Reads (scoped per role in the controller)
router.get('/', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), getRefundRequests);
router.get('/:id', authorize('CUSTOMER', 'VENDOR', 'ADMIN', 'STAFF'), getRefundRequestById);

// Vendor review (the platform admin makes the final decision)
router.post('/:id/review', authorize('VENDOR'), startVendorReview);
router.post('/:id/recommend', authorize('VENDOR'), recommendRefund);

// Admin workflow actions
router.post('/:id/approve', authorize('ADMIN', 'STAFF'), approveRefund);
router.post('/:id/reject', authorize('ADMIN', 'STAFF'), rejectRefund);
router.post('/:id/receive', authorize('ADMIN', 'STAFF'), receiveRefundItem);
router.post('/:id/start-refund', authorize('ADMIN', 'STAFF'), startRefundProcessing);
router.post('/:id/complete-manual', authorize('ADMIN', 'STAFF'), completeManualRefund);
router.post('/:id/gateway', authorize('ADMIN', 'STAFF'), requestGatewayRefund);

// Legacy endpoints, mapped onto the workflow above
router.patch('/:id/vendor', authorize('VENDOR'), updateVendorRefundStatus);
router.patch('/:id/admin', authorize('ADMIN', 'STAFF'), updateAdminRefundStatus);

export default router;
