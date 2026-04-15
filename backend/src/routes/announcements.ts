import { Router } from 'express';
import { getActiveAnnouncement } from '../controllers/announcements';

const router = Router();

// GET /api/announcements - Fetch the active announcement for the bar
router.get('/', getActiveAnnouncement);

export default router;
