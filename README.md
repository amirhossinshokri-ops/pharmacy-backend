# 🏥 سلامتی‌شاپ — Backend API

بک‌اند کامل فروشگاه آنلاین سلامت و دارو با Node.js + TypeScript + PostgreSQL + Redis

---

## 🛠️ تکنولوژی‌ها

| لایه | تکنولوژی |
|------|-----------|
| Runtime | Node.js 18+ |
| Language | TypeScript |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL 15 |
| Cache / Token Blacklist | Redis |
| Auth | JWT (Access + Refresh Token) |
| Validation | Zod |
| Upload | Multer + Sharp |
| Logging | Winston |
| Security | Helmet + CORS + Rate Limit |

---

## 📁 ساختار پروژه

```
src/
├── config/
│   ├── database.ts      # Prisma client singleton
│   ├── redis.ts         # Redis + cache helpers
│   └── multer.ts        # File upload config
├── controllers/
│   ├── auth.controller.ts
│   ├── product.controller.ts
│   ├── shop.controller.ts   # cart + wishlist + orders
│   └── admin.controller.ts
├── middleware/
│   ├── auth.middleware.ts   # JWT authenticate + authorize
│   ├── validate.middleware.ts
│   └── error.middleware.ts
├── routes/
│   ├── auth.routes.ts
│   ├── product.routes.ts
│   ├── category.routes.ts
│   ├── cart.routes.ts
│   ├── wishlist.routes.ts
│   ├── order.routes.ts
│   └── admin.routes.ts
├── services/
│   ├── auth.service.ts
│   ├── product.service.ts
│   ├── category.service.ts
│   ├── cart.service.ts
│   ├── order.service.ts
│   ├── wishlist.service.ts
│   ├── discount.service.ts
│   └── image.service.ts
├── utils/
│   ├── jwt.ts
│   ├── response.ts
│   ├── logger.ts
│   └── helpers.ts
├── validators/
│   └── schemas.ts       # All Zod schemas
├── app.ts
└── server.ts
prisma/
├── schema.prisma
└── seed.ts
```

---

## 🚀 راه‌اندازی

### ۱. پیش‌نیازها
```bash
# PostgreSQL 15
# Redis 7
# Node.js 18+
```

### ۲. نصب وابستگی‌ها
```bash
npm install
```

### ۳. تنظیم محیط
```bash
cp .env.example .env
# ویرایش .env و تنظیم DATABASE_URL و سایر متغیرها
```

### ۴. راه‌اندازی دیتابیس
```bash
# ساخت دیتابیس
createdb pharmacy_db

# اجرای migration
npm run prisma:push

# تولید Prisma Client
npm run prisma:generate

# seed کردن داده‌های اولیه
npm run prisma:seed
```

### ۵. اجرا
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## 📡 API Endpoints

### Auth — `/api/v1/auth`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| POST | `/register` | ❌ | ثبت‌نام |
| POST | `/login` | ❌ | ورود |
| POST | `/refresh` | ❌ | تجدید Access Token |
| POST | `/logout` | ✅ | خروج |
| GET | `/profile` | ✅ | دریافت پروفایل |
| PATCH | `/profile` | ✅ | بروزرسانی پروفایل |
| POST | `/avatar` | ✅ | آپلود تصویر پروفایل |
| PATCH | `/change-password` | ✅ | تغییر رمز عبور |

### Products — `/api/v1/products`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| GET | `/` | ❌ | لیست با فیلتر و صفحه‌بندی |
| GET | `/featured` | ❌ | محصولات ویژه |
| GET | `/bestsellers` | ❌ | پرفروش‌ترین‌ها |
| GET | `/:id` | ❌ | جزئیات محصول |
| GET | `/slug/:slug` | ❌ | محصول با slug |
| GET | `/:id/related` | ❌ | محصولات مرتبط |
| POST | `/` | 🔒 Admin | ایجاد محصول |
| PATCH | `/:id` | 🔒 Admin | ویرایش محصول |
| DELETE | `/:id` | 🔒 Admin | حذف محصول |

### Cart — `/api/v1/cart`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| GET | `/` | ✅ | سبد خرید |
| POST | `/add` | ✅ | افزودن به سبد |
| PATCH | `/:itemId` | ✅ | بروزرسانی تعداد |
| DELETE | `/:itemId` | ✅ | حذف آیتم |
| DELETE | `/` | ✅ | خالی کردن سبد |

### Wishlist — `/api/v1/wishlist`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| GET | `/` | ✅ | لیست علاقه‌مندی‌ها |
| POST | `/:productId` | ✅ | افزودن |
| DELETE | `/:productId` | ✅ | حذف |

### Orders — `/api/v1/orders`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| GET | `/` | ✅ | سفارشات من |
| POST | `/` | ✅ | ثبت سفارش |
| GET | `/:id` | ✅ | جزئیات سفارش |
| POST | `/discount/apply` | ✅ | اعمال کد تخفیف |

### Categories — `/api/v1/categories`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| GET | `/` | ❌ | همه دسته‌بندی‌ها (درختی) |
| GET | `/:slug` | ❌ | دسته‌بندی با slug |
| POST | `/` | 🔒 Admin | ایجاد |
| PATCH | `/:id` | 🔒 Admin | ویرایش |
| DELETE | `/:id` | 🔒 Admin | حذف |

### Admin — `/api/v1/admin`
| Method | Route | توضیح |
|--------|-------|-------|
| GET | `/stats` | داشبورد آماری |
| GET | `/users` | لیست کاربران |
| PATCH | `/users/:id/toggle` | فعال/غیرفعال کردن |
| GET | `/orders` | همه سفارشات |
| PATCH | `/orders/:id/status` | تغییر وضعیت سفارش |
| GET | `/discounts` | کدهای تخفیف |
| POST | `/discounts` | ایجاد کد تخفیف |
| PATCH | `/discounts/:id/toggle` | فعال/غیرفعال کد |

---

## 🔐 احراز هویت

### جریان JWT
```
1. کاربر login می‌کند
2. سرور: accessToken (15m) + refreshToken (7d) برمی‌گرداند
3. فرانت: accessToken را در header ارسال می‌کند
   Authorization: Bearer <accessToken>
4. وقتی accessToken منقضی شد:
   POST /api/v1/auth/refresh با { refreshToken }
5. logout: accessToken به blacklist Redis اضافه می‌شود
```

---

## 🔍 فیلتر محصولات

```
GET /api/v1/products?
  page=1&
  limit=12&
  search=کرم&
  categoryId=1&
  brand=سینره&
  minPrice=100000&
  maxPrice=1000000&
  inStock=true&
  isFeatured=true&
  sortBy=price&        # price | rating | salesCount | createdAt
  sortOrder=asc&       # asc | desc
  tags=آبرسان,پوست خشک
```

---

## 🌱 داده‌های seed

پس از اجرای seed:

**👤 Admin:** `admin@salamatishop.ir` / `Admin@123`
**👤 User:** `test@example.com` / `Test@1234`

**کدهای تخفیف:**
- `WELCOME20` — ۲۰٪ تخفیف (حداکثر ۲۰۰هزار تومان)
- `SAVE50K` — ۵۰هزار تومان تخفیف ثابت
- `VIP30` — ۳۰٪ تخفیف VIP

---

## ⚡ Cache Strategy

| داده | مدت کش |
|------|--------|
| لیست محصولات | ۲ دقیقه |
| جزئیات محصول | ۵ دقیقه |
| محصولات ویژه | ۵ دقیقه |
| دسته‌بندی‌ها | ۱۰ دقیقه |
| Token Blacklist | همان TTL توکن |

---

## 🔒 امنیت

- **Helmet** — HTTP headers امن
- **CORS** — فقط origin مجاز
- **Rate Limiting** — ۲۰۰ req/15min (۱۰ برای auth)
- **bcrypt** با 12 rounds
- **JWT Rotation** — refresh token rotate می‌شود
- **Token Blacklist** — logout واقعی در Redis
- **Soft Delete** — محصولات حذف واقعی نمی‌شوند
- **Zod** — اعتبارسنجی تمام ورودی‌ها
