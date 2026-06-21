import { Router } from 'express';
import * as shopController from '../controllers/shop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createOrderSchema, applyDiscountSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate);

// IMPORTANT: /discount/apply must come BEFORE /:id
router.post('/discount/apply', validate(applyDiscountSchema), shopController.applyDiscount);
router.get('/', shopController.getMyOrders);
router.post('/', validate(createOrderSchema), shopController.createOrder);
router.get('/:id', shopController.getOrderById);

export default router;
