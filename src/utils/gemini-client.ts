import axios, { AxiosError } from 'axios'
import { AppError } from '../middleware/error.middleware'
import logger from '../utils/logger'

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

// Keep well under typical platform/proxy timeouts (Railway/Netlify edge ~ often 10-30s).
// We must leave headroom for our own retry logic too.
const REQUEST_TIMEOUT_MS = 12000
const MAX_RETRIES = 1 // total attempts = 2, to stay within overall latency budget

export interface GeminiContent {
  role: 'user' | 'model'
  parts: { text: string }[]
}

interface GeminiCallResult {
  text: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isRetryableStatus = (status?: number): boolean => {
  if (!status) return true
  return status === 429 || status >= 500
}

export const callGemini = async (
  contents: GeminiContent[],
  maxOutputTokens = 700
): Promise<GeminiCallResult> => {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    logger.error('GEMINI_API_KEY is not configured')
    throw new AppError('سرویس چت در حال حاضر در دسترس نیست', 503)
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`

  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.post(
        url,
        {
          contents,
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      )

      const candidate = data?.candidates?.[0]
      const finishReason = candidate?.finishReason
      const text = candidate?.content?.parts?.[0]?.text

      if (finishReason === 'SAFETY') {
        logger.warn('Gemini blocked response due to safety filters')
        throw new AppError('متأسفانه نمی‌توانم به این سوال پاسخ دهم', 400)
      }

      if (!text) {
        logger.warn(`Gemini returned no text. finishReason=${finishReason ?? 'unknown'}`)
        throw new AppError('پاسخی از سرویس هوش مصنوعی دریافت نشد', 502)
      }

      if (finishReason === 'MAX_TOKENS') {
        logger.warn('Gemini response truncated due to MAX_TOKENS')
      }

      return { text: text.trim() }
    } catch (err) {
      lastError = err

      if (err instanceof AppError) throw err

      const axiosErr = err as AxiosError
      const status = axiosErr.response?.status
      const isTimeout = axiosErr.code === 'ECONNABORTED'

      if (status && [400, 401, 403, 404].includes(status)) {
        logger.error(`Gemini API client error: status=${status}`)
        throw mapGeminiError(status)
      }

      const shouldRetry = attempt < MAX_RETRIES && (isRetryableStatus(status) || isTimeout)
      if (!shouldRetry) break

      const backoffMs = 400
      logger.warn(`Gemini call failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${backoffMs}ms`)
      await sleep(backoffMs)
    }
  }

  const axiosErr = lastError as AxiosError
  if (axiosErr?.code === 'ECONNABORTED') {
    logger.error('Gemini API timeout after retries')
    throw new AppError('پاسخ سرویس هوش مصنوعی طول کشید. لطفاً دوباره تلاش کنید', 504)
  }

  const status = axiosErr?.response?.status
  logger.error(`Gemini API failed after retries: status=${status ?? 'network_error'}`)
  throw mapGeminiError(status)
}

const mapGeminiError = (status?: number): AppError => {
  switch (status) {
    case 400:
      return new AppError('درخواست نامعتبر برای سرویس هوش مصنوعی', 400)
    case 401:
    case 403:
      return new AppError('خطا در احراز هویت سرویس هوش مصنوعی', 503)
    case 404:
      return new AppError('مدل هوش مصنوعی یافت نشد', 503)
    case 429:
      return new AppError('تعداد درخواست‌ها زیاد است. لطفاً کمی صبر کنید', 429)
    default:
      return new AppError('خطا در ارتباط با سرویس چت. لطفاً دوباره تلاش کنید', 502)
  }
}
