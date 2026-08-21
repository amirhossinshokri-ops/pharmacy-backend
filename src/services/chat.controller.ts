import { Request, Response, NextFunction } from 'express'
import * as chatService from '../services/chat.service'
import { sendSuccess, sendError } from '../utils/response'

interface ChatRequestBody {
  message?: string
  history?: { role: 'user' | 'model'; text: string }[]
}

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history }: ChatRequestBody = req.body

    if (!message || typeof message !== 'string' || !message.trim()) {
      return sendError(res, 'پیام نمی‌تواند خالی باشد', 400)
    }

    const safeHistory = Array.isArray(history)
      ? history.filter(h => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string')
      : []

    const reply = await chatService.sendChatMessage(message.trim(), safeHistory)

    // Keep existing response shape: { success, data: { reply } }
    return sendSuccess(res, { reply })
  } catch (err) {
    return next(err)
  }
}
