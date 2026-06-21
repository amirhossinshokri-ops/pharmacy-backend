import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';
import { clearCart } from './cart.service';
import type { CreateOrderInput } from '../validators/schemas';

const SHIPPING_COSTS: Record<string, number> = {
  standard: 50_000, express: 120_000, pickup: 0,
};
const FREE_SHIPPING = 1_000_000;

export const createOrder = async (userId: string, data: CreateOrderInput) => {
  // Resolve address
  let addressId: string | null = null;

  if (data.addressId) {
    const addr = await prisma.address.findFirst({ where: { id: data.addressId, userId } });
    if (!addr) throw new AppError('آدرس یافت نشد', 404);
    addressId = addr.id;
  } else if (data.address) {
    // Create address on the fly
    const addr = await prisma.address.create({
      data: {
        userId,
        title: 'آدرس سفارش',
        province:   data.address.province,
        city:       data.address.city,
        street:     data.address.street,
        postalCode: data.address.postalCode,
        isDefault:  false,
      },
    });
    addressId = addr.id;
  } else {
    throw new AppError('آدرس الزامی است', 400);
  }

  // Get cart
  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { product: true },
  });
  if (cartItems.length === 0) throw new AppError('سبد خرید خالی است', 400);

  // Check stock
  for (const item of cartItems) {
    if (!item.product.isActive) throw new AppError(`محصول "${item.product.name}" دیگر موجود نیست`, 400);
    if (item.product.stock < item.quantity)
      throw new AppError(`موجودی "${item.product.name}" کافی نیست (موجودی: ${item.product.stock})`, 400);
  }

  const subtotal = cartItems.reduce((s, i) => s + Number(i.product.price) * i.quantity, 0);
  const shippingMethod = data.shippingMethod ?? 'standard';
  const shippingCost = subtotal >= FREE_SHIPPING ? 0 : (SHIPPING_COSTS[shippingMethod] ?? 50_000);

  // Apply discount
  let discountAmount = 0;
  let discountCodeId: number | null = null;

  if (data.discountCode) {
    const code = await prisma.discountCode.findFirst({
      where: {
        code: data.discountCode.toUpperCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    if (!code) throw new AppError('کد تخفیف نامعتبر یا منقضی شده است', 400);
    if (code.maxUses !== null && code.usedCount >= code.maxUses)
      throw new AppError('ظرفیت این کد تخفیف تمام شده است', 400);
    if (subtotal < Number(code.minOrder))
      throw new AppError(`حداقل مبلغ سفارش برای این کد ${Number(code.minOrder).toLocaleString()} تومان است`, 400);

    if (code.type === 'PERCENT') {
      discountAmount = Math.round((subtotal * code.value) / 100);
      if (code.maxDiscount) discountAmount = Math.min(discountAmount, Number(code.maxDiscount));
    } else {
      discountAmount = Math.min(code.value, subtotal);
    }
    discountCodeId = code.id;
  }

  const finalPrice = subtotal - discountAmount + shippingCost;

  // Transaction
  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.order.create({
      data: {
        userId, addressId, discountCodeId,
        totalPrice:     BigInt(subtotal),
        discountAmount: BigInt(discountAmount),
        shippingCost:   BigInt(shippingCost),
        finalPrice:     BigInt(finalPrice),
        shippingMethod,
        notes: data.notes,
        items: {
          create: cartItems.map(item => ({
            productId: item.productId,
            quantity:  item.quantity,
            price:     item.product.price,
            snapshot: {
              name:  item.product.name,
              brand: item.product.brand,
              image: item.product.images[0] ?? null,
              sku:   item.product.sku,
            },
          })),
        },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
        address: true,
      },
    });

    for (const item of cartItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity }, salesCount: { increment: item.quantity } },
      });
    }
    if (discountCodeId) {
      await tx.discountCode.update({ where: { id: discountCodeId }, data: { usedCount: { increment: 1 } } });
    }
    return newOrder;
  });

  await clearCart(userId);
  return serializeOrder(order);
};

export const getMyOrders = async (userId: string, page = 1, limit = 10) => {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId },
      skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: { select: { id: true, name: true, images: true } } } } },
    }),
    prisma.order.count({ where: { userId } }),
  ]);
  return { orders: orders.map(serializeOrder), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

export const getOrderById = async (id: number, userId: string) => {
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: { include: { product: { select: { id: true, name: true, images: true, slug: true } } } },
      address: true,
      discountCode: { select: { code: true, type: true, value: true } },
    },
  });
  if (!order) throw new AppError('سفارش یافت نشد', 404);
  return serializeOrder(order);
};

export const getAllOrders = async (page = 1, limit = 20, status?: string) => {
  const where = status ? { status: status as never } : {};
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where, skip: (page - 1) * limit, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user:  { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        items: { include: { product: { select: { name: true, images: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  return { orders: orders.map(serializeOrder), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};

export const updateOrderStatus = async (id: number, status: string) => {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError('سفارش یافت نشد', 404);
  return prisma.order.update({ where: { id }, data: { status: status as never } });
};

const serializeOrder = (order: any) => ({
  ...order,
  totalPrice:     Number(order.totalPrice),
  discountAmount: Number(order.discountAmount),
  shippingCost:   Number(order.shippingCost),
  finalPrice:     Number(order.finalPrice),
  items: order.items?.map((item: any) => ({ ...item, price: Number(item.price) })),
});
