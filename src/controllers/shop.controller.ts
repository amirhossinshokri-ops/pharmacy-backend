import { Response, NextFunction } from 'express';
import * as cartService from '../services/cart.service';
import * as wishlistService from '../services/wishlist.service';
import * as orderService from '../services/order.service';
import * as discountService from '../services/discount.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';

// ==================== CART ====================

export const getCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cart = await cartService.getCart(req.user!.userId);
    return sendSuccess(res, cart);
  } catch (err) { return next(err); }
};

export const addToCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId, quantity } = req.body;
    const item = await cartService.addToCart(req.user!.userId, productId, quantity);
    return sendCreated(res, item, 'محصول به سبد خرید اضافه شد');
  } catch (err) { return next(err); }
};

export const updateCartItem = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const item = await cartService.updateCartItem(
      req.user!.userId,
      parseInt(req.params.itemId),
      req.body.quantity
    );
    return sendSuccess(res, item, 'سبد خرید بروزرسانی شد');
  } catch (err) { return next(err); }
};

export const removeFromCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await cartService.removeFromCart(req.user!.userId, parseInt(req.params.itemId));
    return sendSuccess(res, null, 'محصول از سبد خرید حذف شد');
  } catch (err) { return next(err); }
};

export const clearCart = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await cartService.clearCart(req.user!.userId);
    return sendSuccess(res, null, 'سبد خرید خالی شد');
  } catch (err) { return next(err); }
};

// ==================== WISHLIST ====================

export const getWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const items = await wishlistService.getWishlist(req.user!.userId);
    return sendSuccess(res, items);
  } catch (err) { return next(err); }
};

export const addToWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await wishlistService.addToWishlist(req.user!.userId, parseInt(req.params.productId));
    return sendCreated(res, null, 'محصول به علاقه‌مندی‌ها اضافه شد');
  } catch (err) { return next(err); }
};

export const removeFromWishlist = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await wishlistService.removeFromWishlist(req.user!.userId, parseInt(req.params.productId));
    return sendSuccess(res, null, 'محصول از علاقه‌مندی‌ها حذف شد');
  } catch (err) { return next(err); }
};

// ==================== ORDERS ====================

export const createOrder = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.createOrder(req.user!.userId, req.body);
    return sendCreated(res, order, 'سفارش با موفقیت ثبت شد');
  } catch (err) { return next(err); }
};

export const getMyOrders = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await orderService.getMyOrders(req.user!.userId, page, limit);
    return sendSuccess(res, result.orders, 'سفارشات دریافت شدند', 200, result.meta);
  } catch (err) { return next(err); }
};

export const getOrderById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.getOrderById(parseInt(req.params.id), req.user!.userId);
    return sendSuccess(res, order);
  } catch (err) { return next(err); }
};

// ==================== DISCOUNT ====================

export const applyDiscount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { code, orderTotal } = req.body;
    const result = await discountService.validateDiscountCode(code, orderTotal);
    return sendSuccess(res, result, 'کد تخفیف اعمال شد');
  } catch (err) { return next(err); }
};
