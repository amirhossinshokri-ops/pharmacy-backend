import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import logger from '../utils/logger';
import { sendError, sendServerError } from '../utils/response';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (req: Request, res: Response) => {
  sendError(res, `مسیر ${req.originalUrl} یافت نشد`, 404);
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err.message, { stack: err.stack });

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode);
  }

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[])?.join(', ');
      return sendError(res, `مقدار ${fields} قبلاً ثبت شده است`, 409);
    }
    if (err.code === 'P2025') {
      return sendError(res, 'رکورد مورد نظر یافت نشد', 404);
    }
    if (err.code === 'P2003') {
      return sendError(res, 'کلید خارجی نامعتبر است', 400);
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return sendError(res, 'داده‌های ارسالی نامعتبر هستند', 400);
  }

  // Multer errors
  if (err.message.includes('فایل')) {
    return sendError(res, err.message, 400);
  }

  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      success: false,
      message: err.message,
      stack: err.stack,
    });
  }

  return sendServerError(res);
};
