import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as chatController from '../controllers/chat.controller'

const router = Router()

// Limit chat requests to prevent abuse of free API quota
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, message: 'تعداد پیام‌های شما در این دقیقه بیش از حد مجاز است' },
})

router.post('/', chatLimiter, chatController.chat)

export default router
