import { Router } from 'express';
import { getHomeSections } from '../controllers/home';

const router = Router();

router.get('/sections', getHomeSections);

export default router;

