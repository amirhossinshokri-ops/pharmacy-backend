import { Router } from 'express';
import * as shopController from '../controllers/shop.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', shopController.getWishlist);
router.post('/:productId', shopController.addToWishlist);
router.delete('/:productId', shopController.removeFromWishlist);

export default router;
