import { Router } from 'express';
import {
  createTicket,
  getTickets,
  getTicketById,
  replyTicket,
  updateTicketStatus,
} from '../controllers/tickets';
import { authenticate } from '../middleware/auth';

const router = Router();

// Protect all support ticket routes
router.use(authenticate);

router.post('/', createTicket);
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.post('/:id/messages', replyTicket);
router.patch('/:id/status', updateTicketStatus);

export default router;
