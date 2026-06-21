import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import { AuthRequest } from '../middleware/auth.middleware';
import { processAvatarImage } from '../services/image.service';
import prisma from '../config/database';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.registerUser(req.body);
    return sendCreated(res, result, 'ثبت‌نام با موفقیت انجام شد');
  } catch (err) {
    return next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await authService.loginUser(req.body);
    return sendSuccess(res, result, 'ورود با موفقیت انجام شد');
  } catch (err) {
    return next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return sendError(res, 'توکن رفرش الزامی است', 400);
    }
    const result = await authService.refreshAccessToken(refreshToken);
    return sendSuccess(res, result, 'توکن با موفقیت تجدید شد');
  } catch (err) {
    return next(err);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] as string;
    const { refreshToken } = req.body;
    await authService.logoutUser(token, refreshToken);
    return sendSuccess(res, null, 'خروج با موفقیت انجام شد');
  } catch (err) {
    return next(err);
  }
};

export const getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await authService.getProfile(req.user!.userId);
    return sendSuccess(res, profile);
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone } = req.body;
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
      },
      select: {
        id: true, firstName: true, lastName: true,
        email: true, phone: true, avatar: true, role: true,
      },
    });
    return sendSuccess(res, updated, 'پروفایل با موفقیت بروزرسانی شد');
  } catch (err) {
    return next(err);
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return sendError(res, 'فایل تصویر الزامی است', 400);

    const avatarUrl = await processAvatarImage(req.file.path);
    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatar: avatarUrl },
      select: { id: true, avatar: true },
    });
    return sendSuccess(res, updated, 'تصویر پروفایل با موفقیت بارگذاری شد');
  } catch (err) {
    return next(err);
  }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await authService.changePassword(req.user!.userId, currentPassword, newPassword);
    return sendSuccess(res, null, 'رمز عبور با موفقیت تغییر یافت');
  } catch (err) {
    return next(err);
  }
};
