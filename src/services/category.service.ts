import prisma from '../config/database'
import { setCache, getCache, deleteCache } from '../config/redis'
import { AppError } from '../middleware/error.middleware'
import { generateUniqueSlug } from '../utils/helpers'
import type { CreateCategoryInput } from '../validators/schemas'

export const getCategories = async (includeInactive = false) => {
  const cacheKey = `categories:tree:${includeInactive}`
  const cached = await getCache(cacheKey)
  if (cached) return cached

  const whereActive = includeInactive ? {} : { isActive: true }

  const categories = await prisma.category.findMany({
    where: { parentId: null, ...whereActive },
    include: {
      children: {
        where: whereActive,
        include: { _count: { select: { products: true } } },
        orderBy: { sortOrder: 'asc' },
      },
      _count: { select: { products: true } },
    },
    orderBy: { sortOrder: 'asc' },
  })

  await setCache(cacheKey, categories, 600)
  return categories
}

export const getCategoryById = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      children: true,
      parent: true,
      _count: { select: { products: true } },
    },
  })
  if (!category) throw new AppError('دسته‌بندی یافت نشد', 404)
  return category
}

export const getCategoryBySlug = async (slug: string) => {
  const category = await prisma.category.findUnique({
    where: { slug },
    include: { children: true, _count: { select: { products: true } } },
  })
  if (!category) throw new AppError('دسته‌بندی یافت نشد', 404)
  return category
}

export const createCategory = async (data: CreateCategoryInput, image?: string) => {
  const slug = await generateUniqueSlug(data.name, async (s) => {
    const exists = await prisma.category.findUnique({ where: { slug: s } })
    return !!exists
  })

  if (data.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: data.parentId } })
    if (!parent) throw new AppError('دسته‌بندی والد یافت نشد', 404)
  }

  const category = await prisma.category.create({
    data: { ...data, slug, image },
  })

  await deleteCache('categories:')
  return category
}

export const updateCategory = async (
  id: number,
  data: Partial<CreateCategoryInput>,
  image?: string
) => {
  const existing = await prisma.category.findUnique({ where: { id } })
  if (!existing) throw new AppError('دسته‌بندی یافت نشد', 404)

  let slug = existing.slug
  if (data.name && data.name !== existing.name) {
    slug = await generateUniqueSlug(data.name, async (s) => {
      const exists = await prisma.category.findFirst({ where: { slug: s, NOT: { id } } })
      return !!exists
    })
  }

  const category = await prisma.category.update({
    where: { id },
    data: { ...data, slug, ...(image && { image }) },
  })

  await deleteCache('categories:')
  return category
}

export const deleteCategory = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  })

  if (!category) throw new AppError('دسته‌بندی یافت نشد', 404)
  if (category._count.products > 0) throw new AppError('نمی‌توان دسته‌بندی با محصول را حذف کرد', 400)
  if (category._count.children > 0) throw new AppError('نمی‌توان دسته‌بندی با زیر‌دسته را حذف کرد', 400)

  await prisma.category.delete({ where: { id } })
  await deleteCache('categories:')
}
