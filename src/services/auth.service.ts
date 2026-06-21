import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { blacklistToken } from '../config/redis';
import {
  generateAccessToken, generateRefreshToken,
  verifyRefreshToken, getRefreshTokenExpiry,
} from '../utils/jwt';
import { AppError } from '../middleware/error.middleware';
import type { RegisterInput, LoginInput } from '../validators/schemas';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export const registerUser = async (data: RegisterInput) => {
  // Normalize phone: empty string -> undefined
  const phone = data.phone && data.phone.trim() !== '' ? data.phone.trim() : undefined;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.email },
        ...(phone ? [{ phone }] : []),
      ],
    },
  });

  if (existing) {
    if (existing.email === data.email) throw new AppError('این ایمیل قبلاً ثبت شده است', 409);
    throw new AppError('این شماره موبایل قبلاً ثبت شده است', 409);
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: phone ?? null,
      passwordHash,
    },
    select: {
      id: true, firstName: true, lastName: true,
      email: true, phone: true, role: true, avatar: true, createdAt: true,
    },
  });

  const tokenPayload = { userId: user.id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
  });

  return { user, accessToken, refreshToken };
};

export const loginUser = async (data: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: data.email } });

  if (!user) throw new AppError('ایمیل یا رمز عبور اشتباه است', 401);
  if (!user.isActive) throw new AppError('حساب کاربری شما غیرفعال شده است', 403);

  const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isPasswordValid) throw new AppError('ایمیل یا رمز عبور اشتباه است', 401);

  const tokenPayload = { userId: user.id, role: user.role, email: user.email };
  const accessToken  = generateAccessToken(tokenPayload);
  const refreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: getRefreshTokenExpiry() },
  });

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword, accessToken, refreshToken };
};

export const refreshAccessToken = async (refreshToken: string) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!storedToken || storedToken.expiresAt < new Date()) {
    throw new AppError('توکن رفرش نامعتبر یا منقضی شده است', 401);
  }

  try { verifyRefreshToken(refreshToken); }
  catch {
    await prisma.refreshToken.delete({ where: { token: refreshToken } });
    throw new AppError('توکن رفرش نامعتبر است', 401);
  }

  const { user } = storedToken;
  const tokenPayload   = { userId: user.id, role: user.role, email: user.email };
  const newAccessToken  = generateAccessToken(tokenPayload);
  const newRefreshToken = generateRefreshToken(tokenPayload);

  await prisma.refreshToken.update({
    where: { token: refreshToken },
    data: { token: newRefreshToken, expiresAt: getRefreshTokenExpiry() },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
};

export const logoutUser = async (accessToken: string, refreshToken?: string) => {
  await blacklistToken(accessToken, 60 * 15);
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
  }
};

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, firstName: true, lastName: true, email: true,
      phone: true, role: true, avatar: true, isVerified: true, createdAt: true,
      _count: { select: { orders: true, wishlistItems: true, reviews: true } },
    },
  });
  if (!user) throw new AppError('کاربر یافت نشد', 404);
  return user;
};

export const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('کاربر یافت نشد', 404);

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new AppError('رمز عبور فعلی اشتباه است', 400);

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });
  await prisma.refreshToken.deleteMany({ where: { userId } });
};
