import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

const SHIPPING_THRESHOLD = BigInt(1_000_000); // 1M toman
const SHIPPING_COST_STANDARD = BigInt(50_000);
const SHIPPING_COST_EXPRESS = BigInt(120_000);

export const getCart = async (userId: string) => {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        select: {
          id: true, name: true, slug: true, price: true,
          originalPrice: true, discountPercent: true, images: true,
          stock: true, brand: true, isActive: true,
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  });

  const activeItems = items.filter((item) => item.product.isActive);

  const subtotal = activeItems.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );

  const shippingStandard = subtotal >= Number(SHIPPING_THRESHOLD) ? 0 : Number(SHIPPING_COST_STANDARD);
  const shippingExpress = subtotal >= Number(SHIPPING_THRESHOLD) ? 0 : Number(SHIPPING_COST_EXPRESS);

  return {
    items: activeItems.map((item) => ({
      ...item,
      product: {
        ...item.product,
        price: Number(item.product.price),
        originalPrice: item.product.originalPrice ? Number(item.product.originalPrice) : null,
      },
      lineTotal: Number(item.product.price) * item.quantity,
    })),
    summary: {
      itemCount: activeItems.reduce((sum, item) => sum + item.quantity, 0),
      subtotal,
      shipping: {
        standard: shippingStandard,
        express: shippingExpress,
        freeShippingThreshold: Number(SHIPPING_THRESHOLD),
        remainingForFreeShipping: Math.max(0, Number(SHIPPING_THRESHOLD) - subtotal),
      },
      total: subtotal + shippingStandard,
    },
  };
};

export const addToCart = async (
  userId: string,
  productId: number,
  quantity: number
) => {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
  });

  if (!product) throw new AppError('محصول یافت نشد', 404);
  if (product.stock < quantity) {
    throw new AppError(`موجودی کافی نیست. موجودی فعلی: ${product.stock}`, 400);
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existing) {
    const newQty = existing.quantity + quantity;
    if (product.stock < newQty) {
      throw new AppError(`موجودی کافی نیست. موجودی فعلی: ${product.stock}`, 400);
    }
    return prisma.cartItem.update({
      where: { userId_productId: { userId, productId } },
      data: { quantity: newQty },
      include: { product: { select: { id: true, name: true, price: true, images: true } } },
    });
  }

  return prisma.cartItem.create({
    data: { userId, productId, quantity },
    include: { product: { select: { id: true, name: true, price: true, images: true } } },
  });
};

export const updateCartItem = async (
  userId: string,
  itemId: number,
  quantity: number
) => {
  const item = await prisma.cartItem.findFirst({
    where: { id: itemId, userId },
    include: { product: true },
  });

  if (!item) throw new AppError('آیتم سبد خرید یافت نشد', 404);
  if (item.product.stock < quantity) {
    throw new AppError(`موجودی کافی نیست. موجودی فعلی: ${item.product.stock}`, 400);
  }

  return prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity },
  });
};

export const removeFromCart = async (userId: string, itemId: number) => {
  const item = await prisma.cartItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new AppError('آیتم سبد خرید یافت نشد', 404);
  await prisma.cartItem.delete({ where: { id: itemId } });
};

export const clearCart = async (userId: string) => {
  await prisma.cartItem.deleteMany({ where: { userId } });
};
