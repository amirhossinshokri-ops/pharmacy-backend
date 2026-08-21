import { AppError } from '../middleware/error.middleware'
import { callGemini, type GeminiContent } from '../utils/gemini-client'
import {
  detectIntent,
  searchRelevantProducts,
  findExactProduct,
  type RetrievedProduct,
} from './product-retrieval.service'

export interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

const MAX_HISTORY_MESSAGES = 10 // keep last N messages (5 turns) to bound prompt size
const MAX_RETRIEVED_PRODUCTS = 8

const SYSTEM_INSTRUCTION = `شما دستیار هوشمند فروشگاه آنلاین "سلامتی‌شاپ" هستید — فروشگاه دارو، مکمل و محصولات مراقبت پوست و مو.

قوانین سخت‌گیرانه (باید همیشه رعایت شوند):
۱. فقط و فقط درباره محصولاتی صحبت کن که در بخش PRODUCT_CONTEXT زیر آمده‌اند.
۲. هرگز قیمت، موجودی، برند، لینک یا مشخصات محصولی را که در PRODUCT_CONTEXT نیست، نساز یا حدس نزن.
۳. اگر PRODUCT_CONTEXT خالی بود یا نوشته "هیچ محصول مرتبطی یافت نشد"، صادقانه بگو این محصول یا دسته فعلاً در فروشگاه موجود نیست، و اگر موردی نزدیک در context بود آن را جایگزین پیشنهاد بده.
۴. اگر محصولی پیشنهاد می‌دهی، لینک آن را دقیقاً به‌صورت /products/{slug} از همان slug داده‌شده در context بساز — هرگز slug جعلی نساز.
۵. هرگز تشخیص قطعی پزشکی نده، دوز دقیق دارو تجویز نکن، و جای پزشک یا داروساز وانمود نکن. برای مسائل جدی پزشکی، توصیه به مراجعه به پزشک یا داروساز کن — اما بدون افراط در هشدار.
۶. پاسخ‌ها فارسی، طبیعی، دوستانه و کوتاه باشند (حداکثر ۴ تا ۶ جمله).
۷. برای احوال‌پرسی ساده (سلام، خوبی و…) پاسخ کوتاه و گرم بده، نیازی به معرفی محصول نیست مگر کاربر بخواهد.`

const buildProductContext = (products: RetrievedProduct[]): string => {
  if (products.length === 0) {
    return 'PRODUCT_SEARCH_RESULT:\nهیچ محصول مرتبطی یافت نشد.'
  }

  const items = products.map((p, i) => {
    const stockText = p.stock > 0 ? `موجود (${p.stock} عدد)` : 'ناموجود'
    return [
      `PRODUCT ${i + 1}`,
      `name: ${p.name}`,
      `brand: ${p.brand || 'نامشخص'}`,
      `category: ${p.categoryName}`,
      `price: ${p.price.toLocaleString('fa-IR')} تومان`,
      `stock: ${stockText}`,
      `rating: ${p.rating}/5`,
      `tags: ${p.tags.join('، ') || 'ندارد'}`,
      `description: ${p.description || 'ندارد'}`,
      `slug: ${p.slug}`,
    ].join('\n')
  })

  return `PRODUCT_SEARCH_RESULT:\n${items.join('\n\n')}`
}

const trimHistory = (history: ChatMessage[]): ChatMessage[] => {
  if (history.length <= MAX_HISTORY_MESSAGES) return history
  return history.slice(history.length - MAX_HISTORY_MESSAGES)
}

const toGeminiContents = (
  productContext: string,
  history: ChatMessage[],
  userMessage: string
): GeminiContent[] => {
  const contents: GeminiContent[] = [
    { role: 'user', parts: [{ text: SYSTEM_INSTRUCTION }] },
    { role: 'model', parts: [{ text: 'متوجه شدم. فقط بر اساس محصولات واقعی ارائه‌شده پاسخ می‌دهم.' }] },
  ]

  for (const h of trimHistory(history)) {
    contents.push({ role: h.role, parts: [{ text: h.text }] })
  }

  contents.push({
    role: 'user',
    parts: [{ text: `${productContext}\n\nپیام کاربر: ${userMessage}` }],
  })

  return contents
}

/**
 * Main entry point: analyzes the query, retrieves only relevant
 * products from PostgreSQL (never the full catalog), and asks
 * Gemini to answer using just that context.
 */
export const sendChatMessage = async (
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> => {
  if (!userMessage?.trim()) {
    throw new AppError('پیام نمی‌تواند خالی باشد', 400)
  }

  const intent = detectIntent(userMessage)

  let products: RetrievedProduct[] = []
  if (intent.isProductQuery) {
    // Try exact name match first (handles "do you have X" queries precisely)
    const exact = await findExactProduct(userMessage)
    if (exact) {
      products = [exact]
    } else {
      products = await searchRelevantProducts(userMessage, intent, MAX_RETRIEVED_PRODUCTS)
    }
  }

  const productContext = buildProductContext(products)
  const contents = toGeminiContents(productContext, history, userMessage)

  const { text } = await callGemini(contents)
  return text
}
