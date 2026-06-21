import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const adminHash = await bcrypt.hash('Admin@123', 12);
  await prisma.user.upsert({
    where: { email: 'admin@salamatishop.ir' },
    update: {},
    create: {
      firstName: 'مدیر', lastName: 'سیستم',
      email: 'admin@salamatishop.ir', phone: '09000000000',
      passwordHash: adminHash, role: 'ADMIN', isVerified: true,
    },
  });

  const userHash = await bcrypt.hash('Test@1234', 12);
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      firstName: 'کاربر', lastName: 'آزمایشی',
      email: 'test@example.com', phone: '09111111111',
      passwordHash: userHash, isVerified: true,
    },
  });

  const skinCare = await prisma.category.upsert({
    where: { slug: 'skin-care' }, update: {},
    create: { name: 'مراقبت از پوست', slug: 'skin-care', icon: 'fa-spa', sortOrder: 1 },
  });

  const hairCare = await prisma.category.upsert({
    where: { slug: 'hair-care' }, update: {},
    create: { name: 'مراقبت از مو', slug: 'hair-care', icon: 'fa-scissors', sortOrder: 2 },
  });

  const supplements = await prisma.category.upsert({
    where: { slug: 'supplements' }, update: {},
    create: { name: 'مکمل‌های غذایی', slug: 'supplements', icon: 'fa-capsules', sortOrder: 3 },
  });

  const sunCare = await prisma.category.upsert({
    where: { slug: 'sun-care' }, update: {},
    create: { name: 'ضدآفتاب', slug: 'sun-care', icon: 'fa-sun', sortOrder: 1, parentId: skinCare.id },
  });

  const prods = [
    {
      name: 'کرم آبرسان پوست خشک سینره', slug: 'sinere-moisturizing-cream',
      price: BigInt(690000), originalPrice: BigInt(890000), discountPercent: 23,
      brand: 'سینره', sku: 'SIN-001', stock: 45, categoryId: skinCare.id,
      images: ['https://images.unsplash.com/photo-1612817288484-6f916006741a?w=500'],
      tags: ['آبرسان', 'پوست خشک'], isFeatured: true, rating: 4.8, reviewCount: 127, salesCount: 342,
    },
    {
      name: 'شامپو تقویت‌کننده مو نوتریوا', slug: 'nutriva-hair-shampoo',
      price: BigInt(540000), brand: 'نوتریوا', sku: 'NUT-001', stock: 30, categoryId: hairCare.id,
      images: ['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500'],
      tags: ['شامپو', 'ریزش مو'], isFeatured: true, rating: 4.6, reviewCount: 89, salesCount: 218,
    },
    {
      name: 'ضدآفتاب SPF50 لاروش پوزه', slug: 'laroche-spf50-sunscreen',
      price: BigInt(480000), originalPrice: BigInt(600000), discountPercent: 20,
      brand: 'لاروش پوزه', sku: 'LAR-001', stock: 60, categoryId: sunCare.id,
      images: ['https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=500'],
      tags: ['ضدآفتاب', 'SPF50'], isFeatured: false, rating: 4.9, reviewCount: 203, salesCount: 521,
    },
    {
      name: 'سرم ویتامین C آنتی‌اکسیدان', slug: 'vitamin-c-serum',
      price: BigInt(790000), originalPrice: BigInt(950000), discountPercent: 17,
      brand: 'اوردینری', sku: 'ORD-001', stock: 25, categoryId: skinCare.id,
      images: ['https://images.unsplash.com/photo-1556228578-dd6c2f2c2b8f?w=500'],
      tags: ['سرم', 'ویتامین C'], isFeatured: true, rating: 4.7, reviewCount: 156, salesCount: 289,
    },
    {
      name: 'امگا ۳ پلاس 1000mg', slug: 'omega3-plus-1000mg',
      price: BigInt(350000), brand: 'ویتا', sku: 'VIT-001', stock: 100, categoryId: supplements.id,
      images: ['https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=500'],
      tags: ['امگا ۳', 'مکمل'], isFeatured: false, rating: 4.5, reviewCount: 74, salesCount: 167,
    },
    {
      name: 'ماسک صورت هیدراتاسیون عمیق', slug: 'deep-hydration-face-mask',
      price: BigInt(290000), originalPrice: BigInt(380000), discountPercent: 24,
      brand: 'ایانیر', sku: 'IAN-001', stock: 80, categoryId: skinCare.id,
      images: ['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=500'],
      tags: ['ماسک', 'آبرسان'], isFeatured: false, rating: 4.4, reviewCount: 62, salesCount: 198,
    },
  ];

  for (const p of prods) {
    await prisma.product.upsert({ where: { slug: p.slug }, update: {}, create: p as any });
  }

  for (const d of [
    { code: 'WELCOME20', type: 'PERCENT' as const, value: 20, minOrder: BigInt(500000), maxDiscount: BigInt(200000), maxUses: 1000 },
    { code: 'SAVE50K', type: 'FIXED' as const, value: 50000, minOrder: BigInt(300000), maxUses: 500 },
    { code: 'VIP30', type: 'PERCENT' as const, value: 30, minOrder: BigInt(1000000), maxDiscount: BigInt(500000), maxUses: 100 },
  ]) {
    await prisma.discountCode.upsert({ where: { code: d.code }, update: {}, create: d });
  }

  console.log('Done! Admin: admin@salamatishop.ir / Admin@123');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
