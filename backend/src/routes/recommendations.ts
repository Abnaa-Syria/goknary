import { Router } from 'express';
import { getRecentlyViewedHandler, getRecommendationsHandler } from '../controllers/recommendations';

// Optional auth: the controller resolves a logged-in CUSTOMER from the Bearer token; everyone else
// (guests, vendors, admins, staff) gets the general, non-personalized list.
const router = Router();

router.get('/', getRecommendationsHandler);
router.get('/recently-viewed', getRecentlyViewedHandler);

export default router;
