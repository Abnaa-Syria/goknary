import { Router } from 'express';
import { getAddresses, createAddress, updateAddress, deleteAddress, getAddress } from '../controllers/addresses';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.get('/', getAddresses);
router.get('/:id', getAddress);
router.post('/', createAddress);
router.patch('/:id', updateAddress);
router.delete('/:id', deleteAddress);

export default router;

