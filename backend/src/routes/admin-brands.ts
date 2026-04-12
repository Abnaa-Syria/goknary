import { Router } from 'express';
import {
  getBrands,
  getBrandById,
  createBrand,
  updateBrand,
  deleteBrand,
} from '../controllers/admin-brands';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

router.get('/', requirePermission('READ_BRANDS'), getBrands);
router.get('/:id', requirePermission('READ_BRANDS'), getBrandById);
router.post('/', requirePermission('CREATE_BRANDS'), createBrand);
router.patch('/:id', requirePermission('UPDATE_BRANDS'), updateBrand);
router.delete('/:id', requirePermission('DELETE_BRANDS'), deleteBrand);

export default router;

