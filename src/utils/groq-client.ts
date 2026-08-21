import axios, { AxiosError } from 'axios'
import { AppError } from '../middleware/error.middleware'
import logger from '../utils/logger'

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'

const REQUEST_TIMEOUT_MS = 15000
const MAX_RETRIES = 1

export interface ChatRole {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface GroqCallResult {
  text: string
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const isRetryableStatus = (status?: number): boolean => {
  if (!status) return false
  return status === 429 || status >= 500
}

export const callGroq = async (
  messages: ChatRole[],
  maxTokens = 300
): Promise<GroqCallResult> => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    logger.error('GROQ_API_KEY is not configured')
    throw new AppError('سرویس چت در حال حاضر در دسترس نیست', 503)
  }

  let lastError: unknown = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const startedAt = Date.now()
    try {
      const { data } = await axios.post(
        GROQ_URL,
        {
          model: GROQ_MODEL,
          messages,
          temperature: 0.5,
          max_tokens: maxTokens,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: REQUEST_TIMEOUT_MS,
        }
      )

      logger.info(`Groq call succeeded in ${Date.now() - startedAt}ms`)

      const text = data?.choices?.[0]?.message?.content
      const finishReason = data?.choices?.[0]?.finish_reason

      if (!text) {
        logger.warn(`Groq returned no text. finish_reason=${finishReason ?? 'unknown'}`)
        throw new AppError('پاسخی از سرویس هوش مصنوعی دریافت نشد', 502)
      }

      if (finishReason === 'length') {
        logger.warn('Groq response truncated due to max_tokens')
      }

      return { text: text.trim() }
    } catch (err) {
      lastError = err
      const elapsed = Date.now() - startedAt

      if (err instanceof AppError) throw err

      const axiosErr = err as AxiosError
      const status = axiosErr.response?.status
      const isTimeout = axiosErr.code === 'ECONNABORTED'

      if (status && [400, 401, 403, 404].includes(status)) {
        logger.error(`Groq API client error: status=${status}`)
        throw mapGroqError(status)
      }

      const shouldRetry = attempt < MAX_RETRIES && !isTimeout && isRetryableStatus(status)
      logger.warn(`Groq call failed after ${elapsed}ms (status=${status ?? (isTimeout ? 'timeout' : 'network')})`)

      if (!shouldRetry) break
      await sleep(300)
    }
  }

  const axiosErr = lastError as AxiosError
  if (axiosErr?.code === 'ECONNABORTED') {
    logger.error('Groq API timeout')
    throw new AppError('پاسخ سرویس هوش مصنوعی طول کشید. لطفاً دوباره تلاش کنید', 504)
  }

  const status = axiosErr?.response?.status
  logger.error(`Groq API failed: status=${status ?? 'network_error'}`)
  throw mapGroqError(status)
}

const mapGroqError = (status?: number): AppError => {
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
