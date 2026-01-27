import { Router } from 'express';
import {
  getBanners,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
} from '../controllers/admin-banners';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getBanners);
router.get('/:id', getBannerById);
router.post('/', createBanner);
router.patch('/:id', updateBanner);
router.delete('/:id', deleteBanner);

export default router;

