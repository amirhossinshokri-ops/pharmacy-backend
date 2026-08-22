# 🏥 سلامتی‌شاپ — Backend API

بک‌اند کامل فروشگاه آنلاین سلامت و دارو — Node.js + TypeScript + PostgreSQL + Redis + چت‌بات هوش مصنوعی

**نسخه دپلوی‌شده:** Railway (بک‌اند) + Netlify (فرانت)

---

## 🛠️ تکنولوژی‌ها

| لایه | تکنولوژی |
|------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript |
| Framework | Express.js |
| ORM | Prisma |
| Database | PostgreSQL 15 |
| Cache | Redis (اختیاری — سیستم بدون آن هم کار می‌کند) |
| Auth | JWT (Access + Refresh Token) |
| Validation | Zod |
| Upload | Multer + Sharp |
| Logging | Winston |
| Security | Helmet + CORS + Rate Limit + Trust Proxy |
| هوش مصنوعی چت | **Groq API** (مدل Llama، رایگان و سریع) |
| Hosting بک‌اند | Railway |
| Hosting فرانت | Netlify |

---

## 📁 ساختار پروژه

```
src/
├── config/
│   ├── database.ts        # Prisma client singleton
│   ├── redis.ts           # Redis + cache helpers (fail-safe: کار می‌کند حتی بدون Redis)
│   └── multer.ts          # تنظیمات آپلود فایل
├── controllers/
│   ├── auth.controller.ts
│   ├── product.controller.ts
│   ├── shop.controller.ts     # سبد خرید + علاقه‌مندی + سفارشات
│   ├── admin.controller.ts
│   └── chat.controller.ts     # کنترلر چت‌بات
├── middleware/
│   ├── auth.middleware.ts     # JWT authenticate + authorize
│   ├── validate.middleware.ts
│   └── error.middleware.ts
├── routes/
│   ├── auth.routes.ts
│   ├── product.routes.ts
│   ├── category.routes.ts
│   ├── cart.routes.ts
│   ├── wishlist.routes.ts
│   ├── order.routes.ts
│   ├── admin.routes.ts
│   └── chat.routes.ts         # مسیر چت‌بات
├── services/
│   ├── auth.service.ts
│   ├── product.service.ts
│   ├── category.service.ts
│   ├── cart.service.ts
│   ├── order.service.ts
│   ├── wishlist.service.ts
│   ├── discount.service.ts
│   ├── image.service.ts
│   ├── chat.service.ts             # منطق اصلی چت‌بات (retrieval + prompt)
│   └── product-retrieval.service.ts # جستجوی هوشمند محصولات برای چت‌بات
├── utils/
│   ├── jwt.ts
│   ├── response.ts            # سریال‌سازی خودکار BigInt برای JSON
│   ├── bigint.ts
│   ├── logger.ts
│   ├── helpers.ts
│   ├── persian-normalize.ts   # نرمال‌سازی متن فارسی برای جستجو
│   └── groq-client.ts         # کلاینت Groq با retry و timeout
├── validators/
│   └── schemas.ts             # تمام Zod schemaها
├── app.ts
└── server.ts
prisma/
├── schema.prisma
└── seed.ts
```

---

## 🤖 چت‌بات هوش مصنوعی (Groq)

### چرا Groq و نه Gemini؟
در نسخه اول از Gemini استفاده شد، اما به دلیل کندی/timeout مکرر (تا ۱۵ ثانیه در برخی درخواست‌ها) به **Groq** مهاجرت کردیم. Groq روی سخت‌افزار اختصاصی (LPU) اجرا می‌شود و معمولاً پاسخ‌ها را در کمتر از ۱ ثانیه برمی‌گرداند — کاملاً رایگان و بدون نیاز به کارت اعتباری.

### معماری (Retrieval-Augmented، نه Full-Catalog)
برخلاف پیاده‌سازی اولیه (که کل کاتالوگ محصولات را در هر درخواست به مدل می‌فرستاد)، نسخه فعلی:

1. پیام کاربر تحلیل می‌شود (`detectIntent`) — تشخیص می‌دهد آیا سوال مرتبط با محصول است، فیلتر قیمت دارد، نیاز به مرتب‌سازی خاص دارد (ارزان‌ترین/پرفروش‌ترین/بهترین امتیاز) و غیره.
2. فقط محصولات **مرتبط** (حداکثر ۶ محصول) از PostgreSQL با Prisma واکشی می‌شوند — نه کل کاتالوگ.
3. متن نرمال‌سازی فارسی (`persian-normalize.ts`) اعمال می‌شود تا تفاوت‌های نگارشی مثل «ی» عربی/فارسی، فاصله‌ها و... مشکلی در جستجو ایجاد نکنند.
4. فقط این محصولات محدود، همراه با ۶ پیام آخر مکالمه، به مدل فرستاده می‌شوند.
5. مدل موظف است **فقط درباره محصولات واقعی ارسالی صحبت کند** — قیمت، لینک یا موجودی ساختگی تولید نمی‌کند.

این معماری باعث می‌شود:
- سرعت پاسخ با افزایش تعداد محصولات فروشگاه کند نشود
- مدل هرگز محصول یا قیمت ساختگی نسازد (کاهش hallucination)
- فیلتر قیمت / مرتب‌سازی توسط خود دیتابیس انجام شود، نه حدس مدل

### فایل‌های کلیدی
| فایل | مسئولیت |
|------|----------|
| `product-retrieval.service.ts` | تشخیص intent (قیمت، مرتب‌سازی، موجودی) + جستجوی Prisma با کش Redis ۳ دقیقه‌ای |
| `persian-normalize.ts` | نرمال‌سازی حروف عربی/فارسی، فاصله‌ها، اعداد فارسی به انگلیسی |
| `groq-client.ts` | فراخوانی Groq API با timeout ۱۵ ثانیه، ۱ retry برای خطاهای ۴۲۹/۵xx (نه برای timeout) |
| `chat.service.ts` | ترکیب همه موارد بالا + ساخت پیام نهایی برای مدل |

---

## 🚀 راه‌اندازی محلی

### ۱. پیش‌نیازها
```bash
# PostgreSQL 15
# Redis 7 (اختیاری — سیستم بدون آن هم اجرا می‌شود)
# Node.js 20+
```

### ۲. نصب وابستگی‌ها
```bash
npm install
```

### ۳. تنظیم محیط
```bash
cp .env.example .env
```

مقادیر زیر را در `.env` تنظیم کنید:

```env
NODE_ENV=development
PORT=5000
API_PREFIX=/api/v1

DATABASE_URL="postgresql://postgres:PASSWORD@localhost:5432/pharmacy_db"

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_ACCESS_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_secret_key
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

CORS_ORIGIN=http://localhost:3000

BCRYPT_ROUNDS=12
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880

# چت‌بات — از console.groq.com رایگان بگیرید
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
```

### ۴. راه‌اندازی دیتابیس
```bash
npm run prisma:generate
npm run prisma:push
npm run prisma:seed
```

### ۵. اجرا
```bash
npm run dev
```

---

## ☁️ Deploy روی Railway

### مراحل
1. پروژه GitHub را به Railway وصل کنید (`New Project → Deploy from GitHub repo`)
2. یک سرویس **PostgreSQL** و یک سرویس **Redis** به همان پروژه اضافه کنید
3. متغیرهای محیطی زیر را در سرویس بک‌اند تنظیم کنید:

```
NODE_ENV=production
PORT=5000
API_PREFIX=/api/v1
DATABASE_URL=<از سرویس Postgres کپی کنید>
REDIS_URL=<از سرویس Redis کپی کنید>
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
BCRYPT_ROUNDS=12
UPLOAD_DIR=uploads
MAX_FILE_SIZE=5242880
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
CORS_ORIGIN=<آدرس دقیق سایت روی Netlify>
```

4. بعد از اولین دیپلوی موفق، migration و seed را اجرا کنید:
```bash
railway run npm run prisma:push
railway run npm run prisma:seed
```

5. از تب **Settings → Networking → Generate Domain** یک آدرس عمومی بگیرید و در فرانت (`VITE_API_URL`) استفاده کنید.

### نکات مهم Production
- `app.set('trust proxy', 1)` در `app.ts` فعال است — بدون آن، `express-rate-limit` پشت پراکسی Railway به درستی کار نمی‌کند.
- Redis اختیاری است: اگر متغیر `REDIS_URL` ست نشود یا Redis در دسترس نباشد، برنامه crash نمی‌کند — فقط کش غیرفعال می‌شود (`redis.ts` این fallback را مدیریت می‌کند).
- تمام مقادیر `BigInt` (قیمت‌ها در Prisma) پیش از پاسخ JSON به صورت خودکار به `Number` تبدیل می‌شوند (`utils/bigint.ts` + `utils/response.ts`).

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
| POST | `/` | ✅ | ثبت سفارش (آدرس inline یا ذخیره‌شده) |
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

### Chat — `/api/v1/chat`
| Method | Route | Auth | توضیح |
|--------|-------|------|-------|
| POST | `/` | ❌ | ارسال پیام به چت‌بات (rate limit: ۱۰ پیام/دقیقه) |

**Request:**
```json
{
  "message": "شامپو ضدشوره دارید؟",
  "history": [
    { "role": "user", "text": "سلام" },
    { "role": "model", "text": "سلام! چطور می‌تونم کمک کنم؟" }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": { "reply": "بله، شامپو تقویت‌کننده مو نوتریوا موجود است..." }
}
```

**تست با curl:**
```bash
curl -X POST https://your-backend.up.railway.app/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "ارزون‌ترین ضدآفتاب چیه؟", "history": []}'
```

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
5. logout: accessToken به blacklist Redis اضافه می‌شود (اگر Redis در دسترس باشد)
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
  sortOrder=asc&        # asc | desc
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

| داده | مدت کش | محل |
|------|--------|------|
| لیست محصولات | ۲ دقیقه | Redis |
| جزئیات محصول | ۵ دقیقه | Redis |
| محصولات ویژه/پرفروش | ۵ دقیقه | Redis |
| دسته‌بندی‌ها | ۱۰ دقیقه | Redis |
| نتیجه جستجوی چت‌بات | ۳ دقیقه | Redis |
| Token Blacklist | برابر با TTL توکن | Redis |

اگر Redis در دسترس نباشد، همه موارد بالا به صورت خودکار غیرفعال می‌شوند و درخواست‌ها مستقیماً به دیتابیس می‌روند — بدون کرش کردن سرویس.

---

## 🔒 امنیت

- **Helmet** — HTTP headers امن
- **CORS** — فقط origin مشخص‌شده در `CORS_ORIGIN` مجاز است
- **Trust Proxy** — برای شناسایی صحیح IP پشت پراکسی Railway
- **Rate Limiting** — ۵۰۰ req/۱۵min برای عمومی، ۲۰ req/۱۵min برای auth، ۱۰ msg/min برای چت
- **bcrypt** با ۱۲ round
- **JWT Rotation** — refresh token در هر استفاده rotate می‌شود
- **Token Blacklist** — logout واقعی (در صورت وجود Redis)
- **Soft Delete** — محصولات به‌جای حذف کامل، غیرفعال می‌شوند
- **Zod** — اعتبارسنجی تمام ورودی‌ها
- **API Key چت‌بات** — هرگز در لاگ چاپ نمی‌شود؛ prompt کامل یا داده حساس کاربر هم لاگ نمی‌شود

---

## 🐞 عیب‌یابی رایج

| خطا | راه‌حل |
|------|--------|
| `Environment variable not found: DATABASE_URL` | متغیر `DATABASE_URL` را در تنظیمات محیطی (Railway/`.env`) بررسی کنید |
| `Redis connection failed` | طبیعی است اگر Redis ندارید — سرویس بدون کش کار می‌کند. اگر باید کار کند، `REDIS_URL` را چک کنید |
| `Do not know how to serialize a BigInt` | مطمئن شوید از `sendSuccess`/`sendError` در `utils/response.ts` استفاده می‌کنید، نه `res.json` مستقیم |
| `Not allowed by CORS` | مقدار `CORS_ORIGIN` باید دقیقاً همان آدرس Netlify (با `https://` کامل) باشد |
| چت‌بات timeout می‌زند | مدل Groq را در `GROQ_MODEL` بررسی کنید؛ لاگ `Groq call succeeded in Xms` زمان واقعی را نشان می‌دهد |
| `tsc: Permission denied` روی Netlify/Railway | اسکریپت build را به `vite build` (بدون `tsc &&`) یا `node ./node_modules/vite/bin/vite.js build` تغییر دهید |