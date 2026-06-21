import { Request, Response, NextFunction } from 'express';
import * as orderService from '../services/order.service';
import * as discountService from '../services/discount.service';
import { sendSuccess, sendCreated } from '../utils/response';
import prisma from '../config/database';

export const getDashboardStats = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      revenueResult,
      recentOrders,
      topProducts,
      ordersByStatus,
      newUsersThisMonth,
    ] = await Promise.all([
      prisma.user.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.count(),
      prisma.order.aggregate({
        where: { status: { in: ['DELIVERED', 'SHIPPED', 'PROCESSING'] } },
        _sum: { finalPrice: true },
      }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          items: { take: 1, include: { product: { select: { name: true, images: true } } } },
        },
      }),
      prisma.product.findMany({
        take: 5,
        orderBy: { salesCount: 'desc' },
        where: { isActive: true },
        select: { id: true, name: true, salesCount: true, images: true, price: true },
      }),
      prisma.order.groupBy({ by: ['status'], _count: { id: true } }),
      prisma.user.count({ where: { createdAt: { gte: new Date(new Date().setDate(1)) } } }),
    ]);

    return sendSuccess(res, {
      overview: {
        totalUsers, totalProducts, totalOrders,
        totalRevenue: Number(revenueResult._sum.finalPrice ?? 0),
        newUsersThisMonth,
      },
      recentOrders: recentOrders.map((o) => ({
        ...o, finalPrice: Number(o.finalPrice), totalPrice: Number(o.totalPrice),
      })),
      topProducts: topProducts.map((p) => ({ ...p, price: Number(p.price) })),
      ordersByStatus: ordersByStatus.map((s) => ({ status: s.status, count: s._count.id })),
    });
  } catch (err) { return next(err); }
};

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const where = search ? {
      OR: [
        { email: { contains: search, mode: 'insensitive' as const } },
        { firstName: { contains: search, mode: 'insensitive' as const } },
        { lastName: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search } },
      ],
    } : {};
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where, skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, firstName: true, lastName: true, email: true,
          phone: true, role: true, isActive: true, createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    return sendSuccess(res, users, 'کاربران دریافت شدند', 200, {
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  } catch (err) { return next(err); }
};

export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ success: false, message: 'کاربر یافت نشد' });
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true, email: true },
    });
    return sendSuccess(res, updated, `کاربر ${updated.isActive ? 'فعال' : 'غیرفعال'} شد`);
  } catch (err) { return next(err); }
};

export const getAllOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const result = await orderService.getAllOrders(page, limit, status);
    return sendSuccess(res, result.orders, 'سفارشات دریافت شدند', 200, result.meta);
  } catch (err) { return next(err); }
};

export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const order = await orderService.updateOrderStatus(parseInt(req.params.id), req.body.status);
    return sendSuccess(res, order, 'وضعیت سفارش بروزرسانی شد');
  } catch (err) { return next(err); }
};

export const createDiscountCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = await discountService.createDiscountCode(req.body);
    return sendCreated(res, code, 'کد تخفیف با موفقیت ایجاد شد');
  } catch (err) { return next(err); }
};

export const getAllDiscountCodes = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const codes = await discountService.getAllDiscountCodes();
    return sendSuccess(res, codes);
  } catch (err) { return next(err); }
};

export const toggleDiscountCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const code = await discountService.toggleDiscountCode(parseInt(req.params.id));
    return sendSuccess(res, code, 'وضعیت کد تخفیف تغییر کرد');
  } catch (err) { return next(err); }
};
