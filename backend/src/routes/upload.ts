import { Router } from 'express';
import { upload } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { uploadFiles } from '../controllers/upload';

const router = Router();

/**
 * Centralized Upload Endpoint
 * Supports multiple images under the 'images' field
 */
router.post('/', authenticate, upload.array('images', 10), uploadFiles);

export default router;
