import { Request, Response, NextFunction } from 'express'
import * as chatService from '../services/chat.service'
import { sendSuccess } from '../utils/response'

export const chat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message, history } = req.body
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'پیام نمی‌تواند خالی باشد' })
    }

    const reply = await chatService.sendChatMessage(message.trim(), history || [])
    return sendSuccess(res, { reply })
  } catch (err) {
    return next(err)
  }
}
