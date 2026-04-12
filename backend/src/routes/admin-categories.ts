import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/admin-categories';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

router.get('/', requirePermission('READ_CATEGORIES'), getCategories);
router.get('/:id', requirePermission('READ_CATEGORIES'), getCategoryById);
router.post('/', requirePermission('CREATE_CATEGORIES'), createCategory);
router.patch('/:id', requirePermission('UPDATE_CATEGORIES'), updateCategory);
router.delete('/:id', requirePermission('DELETE_CATEGORIES'), deleteCategory);

export default router;

