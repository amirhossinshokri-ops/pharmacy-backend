import { Response } from 'express'
import { serializeBigInt } from './bigint'

interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data?: T
  meta?: Record<string, unknown>
  errors?: Record<string, string[]>
}

const safeJson = (res: Response, status: number, body: unknown) => {
  const serialized = serializeBigInt(body)
  return res.status(status).json(serialized)
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = 'عملیات با موفقیت انجام شد',
  statusCode = 200,
  meta?: Record<string, unknown>
) => {
  const body: ApiResponse<T> = { success: true, message, data }
  if (meta) body.meta = meta
  return safeJson(res, statusCode, body)
}

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>
) => {
  const body: ApiResponse = { success: false, message }
  if (errors) body.errors = errors
  return safeJson(res, statusCode, body)
}

export const sendCreated = <T>(
  res: Response,
  data: T,
  message = 'با موفقیت ایجاد شد'
) => sendSuccess(res, data, message, 201)

export const sendNotFound = (res: Response, message = 'یافت نشد') =>
  sendError(res, message, 404)

export const sendUnauthorized = (res: Response, message = 'دسترسی غیرمجاز') =>
  sendError(res, message, 401)

export const sendForbidden = (res: Response, message = 'دسترسی ممنوع') =>
  sendError(res, message, 403)

export const sendServerError = (res: Response, message = 'خطای سرور') =>
  sendError(res, message, 500)
