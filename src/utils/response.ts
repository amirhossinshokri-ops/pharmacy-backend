import { Response } from 'express';

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  meta?: Record<string, unknown>;
  errors?: Record<string, string[]>;
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'عملیات با موفقیت انجام شد',
  statusCode = 200,
  meta?: Record<string, unknown>
) => {
  const response: ApiResponse<T> = { success: true, message, data };
  if (meta) response.meta = meta;
  return res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>
) => {
  const response: ApiResponse = { success: false, message };
  if (errors) response.errors = errors;
  return res.status(statusCode).json(response);
};

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'با موفقیت ایجاد شد'
) => sendSuccess(res, data, message, 201);

export const sendNotFound = (res: Response, message = 'یافت نشد') =>
  sendError(res, message, 404);

export const sendUnauthorized = (res: Response, message = 'دسترسی غیرمجاز') =>
  sendError(res, message, 401);

export const sendForbidden = (res: Response, message = 'دسترسی ممنوع') =>
  sendError(res, message, 403);

export const sendServerError = (res: Response, message = 'خطای سرور') =>
  sendError(res, message, 500);
