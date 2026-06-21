import prisma from '../config/database';
import { AppError } from '../middleware/error.middleware';

export const validateDiscountCode = async (code: string, orderTotal: number) => {
  const discount = await prisma.discountCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!discount) throw new AppError('کد تخفیف نامعتبر یا منقضی شده است', 400);

  if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
    throw new AppError('ظرفیت استفاده از این کد تخفیف تمام شده است', 400);
  }

  if (orderTotal < Number(discount.minOrder)) {
    throw new AppError(
      `حداقل مبلغ سفارش برای این کد تخفیف ${Number(discount.minOrder).toLocaleString()} تومان است`,
      400
    );
  }

  let discountAmount = 0;
  if (discount.type === 'PERCENT') {
    discountAmount = Math.round((orderTotal * discount.value) / 100);
    if (discount.maxDiscount) {
      discountAmount = Math.min(discountAmount, Number(discount.maxDiscount));
    }
  } else {
    discountAmount = Math.min(discount.value, orderTotal);
  }

  return {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    discountAmount,
    finalTotal: orderTotal - discountAmount,
  };
};

export const createDiscountCode = async (data: {
  code: string;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minOrder?: number;
  maxUses?: number;
  maxDiscount?: number;
  expiresAt?: Date;
}) => {
  const existing = await prisma.discountCode.findUnique({
    where: { code: data.code.toUpperCase() },
  });
  if (existing) throw new AppError('این کد تخفیف قبلاً ثبت شده است', 409);

  return prisma.discountCode.create({
    data: {
      ...data,
      code: data.code.toUpperCase(),
      minOrder: data.minOrder ? BigInt(data.minOrder) : BigInt(0),
      maxDiscount: data.maxDiscount ? BigInt(data.maxDiscount) : null,
    },
  });
};

export const getAllDiscountCodes = async () => {
  const codes = await prisma.discountCode.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return codes.map((c) => ({
    ...c,
    minOrder: Number(c.minOrder),
    maxDiscount: c.maxDiscount ? Number(c.maxDiscount) : null,
  }));
};

export const toggleDiscountCode = async (id: number) => {
  const code = await prisma.discountCode.findUnique({ where: { id } });
  if (!code) throw new AppError('کد تخفیف یافت نشد', 404);
  return prisma.discountCode.update({
    where: { id },
    data: { isActive: !code.isActive },
  });
};
