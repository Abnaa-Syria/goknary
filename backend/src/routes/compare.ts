import { Router } from 'express';
import {
  getCompare,
  addToCompare,
  removeFromCompare,
  clearCompare,
} from '../controllers/compare';

const router = Router();

// Compare routes work with both authenticated and guest users
// No authentication required - controllers handle both cases
router.get('/', getCompare);
router.post('/', addToCompare);
router.delete('/:id', removeFromCompare);
router.delete('/', clearCompare);

export default router;

