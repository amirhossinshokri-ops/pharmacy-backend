import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import { AppError } from '../middleware/error.middleware';

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = parseInt(req.params.productId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;

    const [reviews, total, stats] = await Promise.all([
      prisma.review.findMany({
        where: { productId, isVerified: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
        },
      }),
      prisma.review.count({ where: { productId, isVerified: true } }),
      prisma.review.groupBy({
        by: ['rating'],
        where: { productId, isVerified: true },
        _count: { rating: true },
      }),
    ]);

    const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats.forEach((s) => { ratingDistribution[s.rating] = s._count.rating; });

    return sendSuccess(res, { reviews, ratingDistribution }, 'نظرات دریافت شدند', 200, {
      total, page, limit, totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return next(err);
  }
};

export const createReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { productId, rating, title, comment } = req.body;

    // Check if user has purchased this product
    const hasPurchased = await prisma.orderItem.findFirst({
      where: {
        productId,
        order: { userId: req.user!.userId, status: 'DELIVERED' },
      },
    });

    const existing = await prisma.review.findUnique({
      where: { userId_productId: { userId: req.user!.userId, productId } },
    });
    if (existing) throw new AppError('شما قبلاً برای این محصول نظر ثبت کرده‌اید', 409);

    const review = await prisma.review.create({
      data: {
        userId: req.user!.userId,
        productId,
        rating,
        title,
        comment,
        isVerified: !!hasPurchased,
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatar: true } },
      },
    });

    // Update product rating
    const { _avg, _count } = await prisma.review.aggregate({
      where: { productId, isVerified: true },
      _avg: { rating: true },
      _count: { rating: true },
    });
    await prisma.product.update({
      where: { id: productId },
      data: {
        rating: Math.round((_avg.rating ?? 0) * 10) / 10,
        reviewCount: _count.rating,
      },
    });

    return sendCreated(res, review, 'نظر شما با موفقیت ثبت شد');
  } catch (err) {
    return next(err);
  }
};

export const deleteReview = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!review) return sendError(res, 'نظر یافت نشد', 404);

    const isOwner = review.userId === req.user!.userId;
    const isAdmin = req.user!.role === 'ADMIN';
    if (!isOwner && !isAdmin) throw new AppError('دسترسی غیرمجاز', 403);

    await prisma.review.delete({ where: { id: review.id } });
    return sendSuccess(res, null, 'نظر حذف شد');
  } catch (err) {
    return next(err);
  }
};
