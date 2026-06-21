import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

export const getWishlist = async (userId: string) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, price: true,
          originalPrice: true, discountPercent: true, images: true,
          rating: true, stock: true, brand: true, isActive: true,
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  return items
    .filter((item) => item.product.isActive)
    .map((item) => ({
      ...item,
      product: {
        ...item.product,
        price: Number(item.product.price),
        originalPrice: item.product.originalPrice ? Number(item.product.originalPrice) : null,
      },
    }));
};

export const addToWishlist = async (userId: string, productId: number) => {
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
  if (!product) throw new AppError('محصول یافت نشد', 404);

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (existing) throw new AppError('محصول قبلاً به علاقه‌مندی‌ها اضافه شده است', 409);

  return prisma.wishlistItem.create({ data: { userId, productId } });
};

export const removeFromWishlist = async (userId: string, productId: number) => {
  const item = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (!item) throw new AppError('محصول در لیست علاقه‌مندی‌ها یافت نشد', 404);
  await prisma.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
};

export const isInWishlist = async (userId: string, productId: number): Promise<boolean> => {
  const item = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  return !!item;
};
