/**
 * Normalizes Persian/Farsi text for better search matching.
 * Handles common variations: Arabic vs Persian characters, spacing, etc.
 */
export const normalizePersian = (text: string): string => {
  if (!text) return ''

  return text
    .trim()
    .toLowerCase()
    // Arabic ي -> Persian ی
    .replace(/\u064A/g, '\u06CC')
    // Arabic ك -> Persian ک
    .replace(/\u0643/g, '\u06A9')
    // Arabic ة -> Persian ه
    .replace(/\u0629/g, '\u0647')
    // Normalize different forms of alef
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    // Remove zero-width non-joiner (نیم‌فاصله) - normalize to space for search
    .replace(/\u200C/g, ' ')
    // Remove diacritics (اعراب)
    .replace(/[\u064B-\u065F]/g, '')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Remove common punctuation that doesn't help search
    .replace(/[؟!.,،؛:]/g, '')
    .trim()
}

/**
 * Extracts meaningful search tokens from a normalized query,
 * filtering out very short/common Persian stop-ish words.
 */
const STOP_WORDS = new Set([
  'و', 'یا', 'برای', 'از', 'به', 'در', 'با', 'که', 'را', 'این', 'آیا',
  'دارید', 'دارین', 'میخوام', 'می‌خوام', 'خوب', 'یه', 'یک', 'چی', 'چیه',
])

export const extractSearchTokens = (query: string): string[] => {
  const normalized = normalizePersian(query)
  return normalized
    .split(' ')
    .filter(t => t.length >= 2 && !STOP_WORDS.has(t))
}
