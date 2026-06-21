import { Router } from 'express';
import * as shopController from '../controllers/shop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { addToCartSchema, updateCartSchema } from '../validators/schemas';

const router = Router();

router.use(authenticate);
router.get('/', shopController.getCart);
router.post('/add', validate(addToCartSchema), shopController.addToCart);
router.patch('/:itemId', validate(updateCartSchema), shopController.updateCartItem);
router.delete('/:itemId', shopController.removeFromCart);
router.delete('/', shopController.clearCart);

export default router;
