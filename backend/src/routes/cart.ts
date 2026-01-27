import { Router } from 'express';
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart } from '../controllers/cart';
import { authenticate } from '../middleware/auth';

const router = Router();

// Cart routes - some endpoints work with guest (sessionId) and authenticated users
router.get('/', getCart);
router.post('/items', addToCart);
router.patch('/items/:id', updateCartItem);
router.delete('/items/:id', removeCartItem);
router.delete('/', clearCart);

export default router;

