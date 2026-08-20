import axios from 'axios'
import prisma from '../config/database'
import { AppError } from '../middleware/error.middleware'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`

interface ChatMessage {
  role: 'user' | 'model'
  text: string
}

// Cache product catalog for 5 minutes to avoid hitting DB on every message
let catalogCache: { text: string; expiresAt: number } | null = null

const buildProductCatalog = async (): Promise<string> => {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return catalogCache.text
  }

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      brand: true,
      price: true,
      originalPrice: true,
      stock: true,
      description: true,
      tags: true,
      rating: true,
      category: { select: { name: true } },
    },
    orderBy: { salesCount: 'desc' },
  })

  const catalogText = products.map(p => {
    const price = Number(p.price).toLocaleString('fa-IR')
    const stockText = p.stock > 0 ? `موجود (${p.stock} عدد)` : 'ناموجود'
    return `- «${p.name}» | برند: ${p.brand || 'ندارد'} | دسته: ${p.category?.name} | قیمت: ${price} تومان | ${stockText} | امتیاز: ${p.rating}/5 | برچسب‌ها: ${p.tags.join('، ')} | توضیح: ${p.description || 'ندارد'} | لینک: /products/${p.slug}`
  }).join('\n')

  const text = products.length > 0
    ? catalogText
    : 'در حال حاضر محصولی در فروشگاه ثبت نشده است.'

  catalogCache = { text, expiresAt: Date.now() + 5 * 60 * 1000 }
  return text
}

const buildSystemPrompt = (catalog: string) => `شما دستیار هوشمند فروشگاه آنلاین "سلامتی‌شاپ" هستید — یک فروشگاه دارو، مکمل و محصولات مراقبت پوست و مو.

نقش شما:
۱. به سوالات کاربران درباره سلامت، پوست، مو و مکمل‌ها پاسخ تخصصی و مختصر بدهید.
۲. **حتماً و فقط از محصولات واقعی فروشگاه که در لیست زیر آمده استفاده کنید** — هرگز محصولی که در لیست نیست را پیشنهاد ندهید.
۳. وقتی محصولی پیشنهاد می‌دهید، نام دقیق و قیمت آن را ذکر کنید.
۴. اگر محصول مناسبی در فروشگاه نبود، صادقانه بگویید که فعلاً چنین محصولی موجود نیست.
۵. برای مشکلات جدی پزشکی، کاربر را به پزشک ارجاع دهید.
۶. پاسخ‌ها کوتاه، دوستانه و به فارسی باشند (حداکثر ۴-۵ جمله).
۷. هرگز دوز دقیق دارو تجویز نکنید.

فهرست محصولات موجود در فروشگاه (بروزرسانی لحظه‌ای):
${catalog}

اگر کاربر درباره محصولی پرسید که در بالا نیست، بگویید فعلاً موجود نیست و نزدیک‌ترین جایگزین موجود را پیشنهاد دهید.`

export const sendChatMessage = async (
  userMessage: string,
  history: ChatMessage[] = []
): Promise<string> => {
  if (!GEMINI_API_KEY) {
    throw new AppError('سرویس چت در حال حاضر در دسترس نیست', 503)
  }

  try {
    const catalog = await buildProductCatalog()
    const systemPrompt = buildSystemPrompt(catalog)

    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'متوجه شدم. من فقط محصولات موجود در فروشگاه را معرفی می‌کنم و آماده راهنمایی کاربران هستم.' }] },
      ...history.map(h => ({ role: h.role, parts: [{ text: h.text }] })),
      { role: 'user', parts: [{ text: userMessage }] },
    ]

    const { data } = await axios.post(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 350,
        },
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    )

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!reply) throw new AppError('پاسخی دریافت نشد', 500)

    return reply.trim()
  } catch (err: any) {
    if (err instanceof AppError) throw err
    console.error('Gemini API error:', err.response?.data || err.message)
    throw new AppError('خطا در ارتباط با سرویس چت. لطفاً دوباره تلاش کنید', 500)
  }
}

// Call this after product create/update/delete to invalidate cache
export const invalidateCatalogCache = () => {
  catalogCache = null
}
