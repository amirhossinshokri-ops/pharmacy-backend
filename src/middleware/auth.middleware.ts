import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { isTokenBlacklisted } from '../config/redis';
import { sendUnauthorized, sendForbidden } from '../utils/response';
import { Role } from '@prisma/client';

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return sendUnauthorized(res, 'توکن ارسال نشده است');
    }

    const token = authHeader.split(' ')[1];

    // Check blacklist
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      return sendUnauthorized(res, 'توکن باطل شده است');
    }

    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch {
    return sendUnauthorized(res, 'توکن نامعتبر یا منقضی شده است');
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendUnauthorized(res);
    }
    if (!roles.includes(req.user.role as Role)) {
      return sendForbidden(res, 'شما اجازه دسترسی به این بخش را ندارید');
    }
    return next();
  };
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const blacklisted = await isTokenBlacklisted(token);
      if (!blacklisted) {
        req.user = verifyAccessToken(token);
      }
    }
  } catch {
    // silently ignore — optional
  }
  return next();
};
