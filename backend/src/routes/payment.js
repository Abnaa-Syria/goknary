import { Router } from 'express';
import { initiatePayment, handleWebhook } from '../controllers/payment.controller.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();

/**
 * @route POST /api/payment/initiate
 * @desc Initialize payment and get secure hash
 * @access Private (usually requires authentication)
 */
router.post('/initiate', authenticate, authorize('CUSTOMER'), initiatePayment);

/**
 * @route POST /api/payment/webhook
 * @desc Receive payment notifications from Kashier
 * @access Public (called by Kashier servers)
 */
router.post('/webhook', handleWebhook);

export default router;
