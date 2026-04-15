import { Router } from 'express';
import {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/admin-banners';
import { authenticate, authorize, requirePermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'STAFF'));

router.get('/', requirePermission('READ_BANNERS'), getBanners);
router.get('/:id', requirePermission('READ_BANNERS'), getBannerById);
router.post('/', requirePermission('CREATE_BANNERS'), createBanner);
router.patch('/:id', requirePermission('UPDATE_BANNERS'), updateBanner);
router.delete('/:id', requirePermission('DELETE_BANNERS'), deleteBanner);

export default router;

