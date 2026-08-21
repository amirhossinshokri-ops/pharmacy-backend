import prisma from '../config/database'
import { getCache, setCache } from '../config/redis'
import { normalizePersian, extractSearchTokens } from '../utils/persian-normalize'

export interface RetrievedProduct {
  id: number
  name: string
  slug: string
  brand: string | null
  categoryName: string
  price: number
  stock: number
  rating: number
  tags: string[]
  description: string | null
}

export interface QueryIntent {
  isProductQuery: boolean
  sortBy?: 'price_asc' | 'price_desc' | 'rating_desc' | 'sales_desc'
  maxPrice?: number
  minPrice?: number
  inStockOnly?: boolean
  exactPhrase?: string
}

const GENERIC_GREETINGS = new Set([
  'سلام', 'سلام خوبی', 'خوبی', 'چطوری', 'حالت چطوره', 'ممنون', 'مرسی',
  'خداحافظ', 'بای', 'تشکر', 'خیلی ممنون',
])

/**
 * Detects whether the user's message requires product retrieval,
 * and extracts simple intent signals (price filters, sorting) so
 * the database — not the LLM — does the filtering/sorting.
 */
export const detectIntent = (rawMessage: string): QueryIntent => {
  const normalized = normalizePersian(rawMessage)

  if (GENERIC_GREETINGS.has(normalized) || normalized.length < 3) {
    return { isProductQuery: false }
  }

  const intent: QueryIntent = { isProductQuery: true }

  // Sorting signals
  if (/ارزون\s?ترین|ارزان\s?ترین|کمترین قیمت/.test(normalized)) {
    intent.sortBy = 'price_asc'
  } else if (/گرون\s?ترین|گران\s?ترین|بیشترین قیمت/.test(normalized)) {
    intent.sortBy = 'price_desc'
  } else if (/بهترین امتیاز|بیشترین امتیاز|بالاترین امتیاز/.test(normalized)) {
    intent.sortBy = 'rating_desc'
  } else if (/پرفروش\s?ترین|محبوب\s?ترین/.test(normalized)) {
    intent.sortBy = 'sales_desc'
  }

  // Price filter: "زیر 500 هزار" / "زیر ۵۰۰ هزار تومان" / "کمتر از 300000"
  const priceMatch = normalized.match(/(?:زیر|کمتر از|حداکثر)\s*([\d۰-۹]+)\s*(هزار|میلیون)?/)
  if (priceMatch) {
    const digits = toEnglishDigits(priceMatch[1])
    let value = parseInt(digits, 10)
    if (priceMatch[2] === 'هزار') value *= 1000
    if (priceMatch[2] === 'میلیون') value *= 1000000
    if (!isNaN(value) && value > 0) intent.maxPrice = value
  }

  const minPriceMatch = normalized.match(/(?:بالای|بیشتر از)\s*([\d۰-۹]+)\s*(هزار|میلیون)?/)
  if (minPriceMatch) {
    const digits = toEnglishDigits(minPriceMatch[1])
    let value = parseInt(digits, 10)
    if (minPriceMatch[2] === 'هزار') value *= 1000
    if (minPriceMatch[2] === 'میلیون') value *= 1000000
    if (!isNaN(value) && value > 0) intent.minPrice = value
  }

  // Stock filter
  if (/موجود(?!ی نیست)|در دسترس/.test(normalized)) {
    intent.inStockOnly = true
  }

  return intent
}

const toEnglishDigits = (s: string): string =>
  s.replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))

const CACHE_TTL_SECONDS = 180 // 3 minutes

/**
 * Retrieves a small, relevant set of products from PostgreSQL
 * based on the user's query and detected intent. Never returns
 * the full catalog — capped at `limit`.
 */
export const searchRelevantProducts = async (
  rawQuery: string,
  intent: QueryIntent,
  limit = 8
): Promise<RetrievedProduct[]> => {
  const tokens = extractSearchTokens(rawQuery)
  const cacheKey = `chat:retrieval:${normalizePersian(rawQuery)}:${JSON.stringify(intent)}`

  const cached = await getCache<RetrievedProduct[]>(cacheKey)
  if (cached) return cached

  // Build a Prisma OR filter across name/brand/description/tags/category
  const orConditions: any[] = []

  if (tokens.length > 0) {
    for (const token of tokens) {
      orConditions.push(
        { name: { contains: token, mode: 'insensitive' } },
        { brand: { contains: token, mode: 'insensitive' } },
        { description: { contains: token, mode: 'insensitive' } },
        { tags: { has: token } },
        { category: { name: { contains: token, mode: 'insensitive' } } },
      )
    }
  }

  const where: any = {
    isActive: true,
    ...(intent.inStockOnly ? { stock: { gt: 0 } } : {}),
    ...(intent.maxPrice ? { price: { lte: intent.maxPrice } } : {}),
    ...(intent.minPrice ? { price: { gte: intent.minPrice } } : {}),
    ...(orConditions.length > 0 ? { OR: orConditions } : {}),
  }

  const orderBy: any =
    intent.sortBy === 'price_asc' ? { price: 'asc' } :
    intent.sortBy === 'price_desc' ? { price: 'desc' } :
    intent.sortBy === 'rating_desc' ? { rating: 'desc' } :
    intent.sortBy === 'sales_desc' ? { salesCount: 'desc' } :
    { salesCount: 'desc' } // default: most relevant/popular first

  let products = await prisma.product.findMany({
    where,
    orderBy,
    take: limit,
    select: {
      id: true, name: true, slug: true, brand: true,
      price: true, stock: true, rating: true, tags: true, description: true,
      category: { select: { name: true } },
    },
  })

  // Fallback: if keyword search found nothing but query had tokens,
  // try a looser search (any single token match) before giving up.
  if (products.length === 0 && tokens.length > 1) {
    const looseOr = tokens.map(t => ({ name: { contains: t, mode: 'insensitive' as const } }))
    products = await prisma.product.findMany({
      where: { isActive: true, OR: looseOr },
      orderBy: { salesCount: 'desc' },
      take: limit,
      select: {
        id: true, name: true, slug: true, brand: true,
        price: true, stock: true, rating: true, tags: true, description: true,
        category: { select: { name: true } },
      },
    })
  }

  const result: RetrievedProduct[] = products.map(p => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    brand: p.brand,
    categoryName: p.category?.name ?? '',
    price: Number(p.price),
    stock: p.stock,
    rating: p.rating,
    tags: p.tags,
    description: p.description,
  }))

  await setCache(cacheKey, result, CACHE_TTL_SECONDS)
  return result
}

/**
 * Attempts an exact/near-exact name lookup first (for "do you have X" queries).
 * Returns null if nothing close enough was found.
 */
export const findExactProduct = async (rawQuery: string): Promise<RetrievedProduct | null> => {
  const tokens = extractSearchTokens(rawQuery)
  if (tokens.length === 0) return null

  const phrase = tokens.join(' ')
  const product = await prisma.product.findFirst({
    where: {
      isActive: true,
      name: { contains: phrase, mode: 'insensitive' },
    },
    select: {
      id: true, name: true, slug: true, brand: true,
      price: true, stock: true, rating: true, tags: true, description: true,
      category: { select: { name: true } },
    },
  })

  if (!product) return null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    brand: product.brand,
    categoryName: product.category?.name ?? '',
    price: Number(product.price),
    stock: product.stock,
    rating: product.rating,
    tags: product.tags,
    description: product.description,
  }
}
