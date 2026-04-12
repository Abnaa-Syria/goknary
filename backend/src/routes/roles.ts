import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import {
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  assignRoleToUser,
} from '../controllers/roles';

const router = Router();

// Only Super Admins can manage roles
router.use(authenticate);
router.use(authorize('ADMIN'));

router.get('/', getAllRoles);
router.get('/:id', getRoleById);
router.post('/', createRole);
router.patch('/assign', assignRoleToUser);
router.patch('/:id', updateRole);
router.delete('/:id', deleteRole);

export default router;
