import { Router } from 'express';
import { updateAnnouncement } from '../controllers/announcements';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// POST /api/admin/announcements - Create or Update the announcement (Admin only)
router.post('/', authenticate, authorize('ADMIN'), updateAnnouncement);

export default router;
