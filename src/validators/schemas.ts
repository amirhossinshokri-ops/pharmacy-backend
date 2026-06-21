import { z } from 'zod';

// ==================== AUTH ====================
export const registerSchema = z.object({
  firstName: z.string({ required_error: 'نام الزامی است' }).min(2, 'نام حداقل ۲ کاراکتر').max(50),
  lastName:  z.string({ required_error: 'نام خانوادگی الزامی است' }).min(2, 'نام خانوادگی حداقل ۲ کاراکتر').max(50),
  email:     z.string({ required_error: 'ایمیل الزامی است' }).email('فرمت ایمیل نادرست است'),
  phone:     z.string().regex(/^09[0-9]{9}$/, 'شماره موبایل نادرست است').optional().or(z.literal('')),
  password:  z.string({ required_error: 'رمز عبور الزامی است' })
    .min(8, 'رمز عبور حداقل ۸ کاراکتر')
    .regex(/[A-Z]/, 'رمز عبور باید حداقل یک حرف بزرگ داشته باشد')
    .regex(/[0-9]/, 'رمز عبور باید حداقل یک عدد داشته باشد'),
  confirmPassword: z.string({ required_error: 'تکرار رمز عبور الزامی است' }),
}).refine(d => d.password === d.confirmPassword, {
  message: 'رمز عبور و تکرار آن یکسان نیستند', path: ['confirmPassword'],
});

export const loginSchema = z.object({
  email:    z.string().email('فرمت ایمیل نادرست است'),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('فرمت ایمیل نادرست است'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی الزامی است'),
  newPassword:     z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, {
  message: 'رمز عبور جدید و تکرار آن یکسان نیستند', path: ['confirmPassword'],
});

// ==================== PRODUCT ====================
export const createProductSchema = z.object({
  name:          z.string().min(3).max(255),
  description:   z.string().optional(),
  ingredients:   z.string().optional(),
  howToUse:      z.string().optional(),
  price:         z.number({ required_error: 'قیمت الزامی است' }).int().positive(),
  originalPrice: z.number().int().positive().optional(),
  brand:         z.string().optional(),
  sku:           z.string().optional(),
  stock:         z.number().int().min(0).default(0),
  minStock:      z.number().int().min(0).default(5),
  weight:        z.number().positive().optional(),
  categoryId:    z.number({ required_error: 'دسته‌بندی الزامی است' }).int().positive(),
  tags:          z.array(z.string()).default([]),
  isFeatured:    z.boolean().default(false),
});
export const updateProductSchema = createProductSchema.partial();

export const productQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(100).default(12),
  search:     z.string().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brand:      z.string().optional(),
  minPrice:   z.coerce.number().int().min(0).optional(),
  maxPrice:   z.coerce.number().int().min(0).optional(),
  inStock:    z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  sortBy:     z.enum(['price', 'rating', 'salesCount', 'createdAt']).default('createdAt'),
  sortOrder:  z.enum(['asc', 'desc']).default('desc'),
  tags:       z.string().optional(),
});

// ==================== CATEGORY ====================
export const createCategorySchema = z.object({
  name:      z.string().min(2).max(100),
  description: z.string().optional(),
  icon:      z.string().optional(),
  parentId:  z.number().int().positive().optional(),
  sortOrder: z.number().int().min(0).default(0),
  isActive:  z.boolean().default(true),
});

// ==================== CART ====================
export const addToCartSchema = z.object({
  productId: z.number({ required_error: 'شناسه محصول الزامی است' }).int().positive(),
  quantity:  z.number().int().min(1).max(99).default(1),
});
export const updateCartSchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

// ==================== ORDER ====================
// addressId is optional — user can pass inline address instead
export const createOrderSchema = z.object({
  addressId:      z.string().uuid().optional(),
  // inline address (used when no saved address)
  address: z.object({
    province:   z.string().min(2),
    city:       z.string().min(2),
    street:     z.string().min(5),
    postalCode: z.string().min(5),
  }).optional(),
  shippingMethod: z.enum(['standard', 'express', 'pickup']).default('standard'),
  discountCode:   z.string().optional(),
  notes:          z.string().max(500).optional(),
}).refine(d => d.addressId || d.address, {
  message: 'آدرس الزامی است', path: ['address'],
});

// ==================== ADDRESS ====================
export const createAddressSchema = z.object({
  title:      z.string().min(2).max(50),
  province:   z.string().min(2),
  city:       z.string().min(2),
  street:     z.string().min(5),
  postalCode: z.string().regex(/^[0-9]{5,10}$/, 'کد پستی نادرست است'),
  isDefault:  z.boolean().default(false),
});

// ==================== REVIEW ====================
export const createReviewSchema = z.object({
  productId: z.number().int().positive(),
  rating:    z.number().int().min(1).max(5),
  title:     z.string().max(100).optional(),
  comment:   z.string().min(10).max(1000).optional(),
});

// ==================== DISCOUNT ====================
export const applyDiscountSchema = z.object({
  code:       z.string().min(3).max(50),
  orderTotal: z.number().int().positive(),
});

export type RegisterInput      = z.infer<typeof registerSchema>;
export type LoginInput         = z.infer<typeof loginSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput  = z.infer<typeof productQuerySchema>;
export type CreateCategoryInput= z.infer<typeof createCategorySchema>;
export type AddToCartInput     = z.infer<typeof addToCartSchema>;
export type CreateOrderInput   = z.infer<typeof createOrderSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type CreateReviewInput  = z.infer<typeof createReviewSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
