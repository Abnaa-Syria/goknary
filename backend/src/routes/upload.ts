import { Router } from 'express';
import { uploadImagesMiddleware } from '../middleware/upload';
import { authenticate } from '../middleware/auth';
import { uploadFiles } from '../controllers/upload';

const router = Router();

/**
 * Centralized Upload Endpoint
 * Supports multiple images under the 'images' field
 */
router.post('/', authenticate, uploadImagesMiddleware('images'), uploadFiles);

export default router;
