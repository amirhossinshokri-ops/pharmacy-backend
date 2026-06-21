import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate, authorize('ADMIN'));

// Dashboard
router.get('/stats', adminController.getDashboardStats);

// Users
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/toggle', adminController.toggleUserStatus);

// Orders
router.get('/orders', adminController.getAllOrders);
router.patch('/orders/:id/status', adminController.updateOrderStatus);

// Discount codes
router.get('/discounts', adminController.getAllDiscountCodes);
router.post('/discounts', adminController.createDiscountCode);
router.patch('/discounts/:id/toggle', adminController.toggleDiscountCode);

export default router;
