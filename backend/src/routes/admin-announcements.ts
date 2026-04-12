import { Router } from 'express';
import { updateAnnouncement } from '../controllers/announcements';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

// POST /api/admin/announcements - Create or Update the announcement (Admin only)
router.post('/', authenticate, authorize('ADMIN', 'STAFF'), requirePermission('UPDATE_ANNOUNCEMENTS'), updateAnnouncement);

export default router;
