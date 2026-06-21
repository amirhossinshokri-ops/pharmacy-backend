import { Router } from 'express';
import * as shopController from '../controllers/shop.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  addToCartSchema,
  updateCartSchema,
  createOrderSchema,
  createAddressSchema,
  applyDiscountSchema,
} from '../validators/schemas';
import prisma from '../config/database';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// All shop routes require authentication
router.use(authenticate);

// ==================== CART ====================
router.get('/cart', shopController.getCart);
router.post('/cart', validate(addToCartSchema), shopController.addToCart);
router.put('/cart/:itemId', validate(updateCartSchema), shopController.updateCartItem);
router.delete('/cart/:itemId', shopController.removeFromCart);
router.delete('/cart', shopController.clearCart);

// ==================== WISHLIST ====================
router.get('/wishlist', shopController.getWishlist);
router.post('/wishlist/:productId', shopController.addToWishlist);
router.delete('/wishlist/:productId', shopController.removeFromWishlist);

// ==================== ORDERS ====================
router.get('/orders', shopController.getMyOrders);
router.post('/orders', validate(createOrderSchema), shopController.createOrder);
router.get('/orders/:id', shopController.getOrderById);

// ==================== DISCOUNT ====================
router.post('/discount/apply', validate(applyDiscountSchema), shopController.applyDiscount);

// ==================== ADDRESSES ====================
router.get('/addresses', async (req: AuthRequest, res, next) => {
  try {
    const addresses = await prisma.address.findMany({
      where: { userId: req.user!.userId },
      orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
    });
    return sendSuccess(res, addresses);
  } catch (err) { return next(err); }
});

router.post('/addresses', validate(createAddressSchema), async (req: AuthRequest, res, next) => {
  try {
    const data = req.body;
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }
    const address = await prisma.address.create({
      data: { ...data, userId: req.user!.userId },
    });
    return sendSuccess(res, address, 'آدرس با موفقیت ثبت شد', 201);
  } catch (err) { return next(err); }
});

router.put('/addresses/:id', async (req: AuthRequest, res, next) => {
  try {
    const address = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!address) return sendError(res, 'آدرس یافت نشد', 404);

    if (req.body.isDefault) {
      await prisma.address.updateMany({
        where: { userId: req.user!.userId },
        data: { isDefault: false },
      });
    }
    const updated = await prisma.address.update({
      where: { id: req.params.id },
      data: req.body,
    });
    return sendSuccess(res, updated, 'آدرس بروزرسانی شد');
  } catch (err) { return next(err); }
});

router.delete('/addresses/:id', async (req: AuthRequest, res, next) => {
  try {
    const address = await prisma.address.findFirst({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    if (!address) return sendError(res, 'آدرس یافت نشد', 404);
    await prisma.address.delete({ where: { id: req.params.id } });
    return sendSuccess(res, null, 'آدرس حذف شد');
  } catch (err) { return next(err); }
});

export default router;
