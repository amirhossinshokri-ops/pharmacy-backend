import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import { setCache, getCache, deleteCache } from '../config/redis';
import { AppError } from '../middleware/error.middleware';
import { generateUniqueSlug, paginationMeta } from '../utils/helpers';
import type { CreateProductInput, UpdateProductInput, ProductQueryInput } from '../validators/schemas';

export const getProducts = async (query: ProductQueryInput) => {
  const {
    page, limit, search, categoryId, brand, minPrice, maxPrice,
    inStock, isFeatured, sortBy, sortOrder, tags,
  } = query;

  const cacheKey = `products:${JSON.stringify(query)}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
        { tags: { has: search } },
      ],
    }),
    ...(categoryId && { categoryId }),
    ...(brand && { brand: { equals: brand, mode: 'insensitive' } }),
    ...(minPrice !== undefined || maxPrice !== undefined
      ? { price: { ...(minPrice && { gte: BigInt(minPrice) }), ...(maxPrice && { lte: BigInt(maxPrice) }) } }
      : {}),
    ...(inStock !== undefined && { stock: inStock ? { gt: 0 } : { equals: 0 } }),
    ...(isFeatured !== undefined && { isFeatured }),
    ...(tags && { tags: { hasSome: tags.split(',').map((t) => t.trim()) } }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  // Serialize BigInt
  const serialized = products.map(serializeProduct);
  const result = { products: serialized, meta: paginationMeta(total, page, limit) };

  await setCache(cacheKey, result, 120); // 2 min cache
  return result;
};

export const getProductById = async (id: number) => {
  const cacheKey = `product:${id}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const product = await prisma.product.findFirst({
    where: { id, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      reviews: {
        where: { isVerified: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
        },
      },
    },
  });

  if (!product) throw new AppError('محصول یافت نشد', 404);

  // Increment view count (fire and forget)
  prisma.product.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const result = serializeProduct(product);
  await setCache(cacheKey, result, 300);
  return result;
};

export const getProductBySlug = async (slug: string) => {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      reviews: {
        where: { isVerified: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          user: { select: { firstName: true, lastName: true, avatar: true } },
        },
      },
    },
  });

  if (!product) throw new AppError('محصول یافت نشد', 404);
  prisma.product.update({ where: { id: product.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  return serializeProduct(product);
};

export const getFeaturedProducts = async (limit = 8) => {
  const cacheKey = `products:featured:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const products = await prisma.product.findMany({
    where: { isFeatured: true, isActive: true, stock: { gt: 0 } },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  const result = products.map(serializeProduct);
  await setCache(cacheKey, result, 300);
  return result;
};

export const getBestSellers = async (limit = 8) => {
  const cacheKey = `products:bestsellers:${limit}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const products = await prisma.product.findMany({
    where: { isActive: true, stock: { gt: 0 } },
    take: limit,
    orderBy: { salesCount: 'desc' },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  const result = products.map(serializeProduct);
  await setCache(cacheKey, result, 300);
  return result;
};

export const createProduct = async (
  data: CreateProductInput,
  images: string[] = []
) => {
  const slug = await generateUniqueSlug(data.name, async (s) => {
    const exists = await prisma.product.findUnique({ where: { slug: s } });
    return !!exists;
  });

  const discountPercent =
    data.originalPrice && data.originalPrice > data.price
      ? Math.round(((data.originalPrice - data.price) / data.originalPrice) * 100)
      : null;

  const product = await prisma.product.create({
    data: {
      ...data,
      slug,
      price: BigInt(data.price),
      originalPrice: data.originalPrice ? BigInt(data.originalPrice) : null,
      discountPercent,
      images,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  await deleteCache('products:');
  return serializeProduct(product);
};

export const updateProduct = async (
  id: number,
  data: UpdateProductInput,
  newImages?: string[]
) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('محصول یافت نشد', 404);

  let slug = existing.slug;
  if (data.name && data.name !== existing.name) {
    slug = await generateUniqueSlug(data.name, async (s) => {
      const exists = await prisma.product.findFirst({ where: { slug: s, NOT: { id } } });
      return !!exists;
    });
  }

  const priceNum = data.price ?? Number(existing.price);
  const origPriceNum = data.originalPrice ?? (existing.originalPrice ? Number(existing.originalPrice) : null);
  const discountPercent =
    origPriceNum && origPriceNum > priceNum
      ? Math.round(((origPriceNum - priceNum) / origPriceNum) * 100)
      : null;

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...data,
      slug,
      ...(data.price !== undefined && { price: BigInt(data.price) }),
      ...(data.originalPrice !== undefined && { originalPrice: data.originalPrice ? BigInt(data.originalPrice) : null }),
      discountPercent,
      ...(newImages && newImages.length > 0 && { images: [...existing.images, ...newImages] }),
    },
    include: { category: { select: { id: true, name: true } } },
  });

  await deleteCache(`product:${id}`);
  await deleteCache('products:');
  return serializeProduct(product);
};

export const deleteProduct = async (id: number) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new AppError('محصول یافت نشد', 404);

  // Soft delete
  await prisma.product.update({ where: { id }, data: { isActive: false } });
  await deleteCache(`product:${id}`);
  await deleteCache('products:');
};

export const getRelatedProducts = async (productId: number, limit = 4) => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return [];

  const products = await prisma.product.findMany({
    where: {
      categoryId: product.categoryId,
      id: { not: productId },
      isActive: true,
    },
    take: limit,
    orderBy: { rating: 'desc' },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });

  return products.map(serializeProduct);
};

// BigInt serializer
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const serializeProduct = (product: any) => ({
  ...product,
  price: Number(product.price),
  originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
});
