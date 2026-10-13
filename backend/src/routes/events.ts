import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { recordClientEvent } from '../controllers/events';

const router = Router();

// Page views are frequent, so they have their own per-customer budget instead of consuming the
// global /api limit that protects regular shopping requests.
const eventsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: () => (process.env.NODE_ENV === 'production' ? 300 : 3000),
  keyGenerator: (req) => `user:${(req as AuthRequest).user?.id ?? 'anonymous'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many events' },
});

router.post('/', authenticate, authorize('CUSTOMER'), eventsLimiter, recordClientEvent);

export default router;
