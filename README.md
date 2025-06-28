# VocaBoost – Backend API

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green?logo=node.js) ![Express](https://img.shields.io/badge/Express-5.x-blue) ![Supabase](https://img.shields.io/badge/Supabase-Postgres-informational?logo=supabase) ![License](https://img.shields.io/badge/License-ISC-lightgrey)

> **VocaBoost** là hệ thống luyện từ vựng tiếng Anh dựa trên thuật toán *Spaced Repetition* (SM‑2). Repo này chứa mã nguồn **backend REST API** được viết bằng **Node.js / Express** và sử dụng **Supabase Postgres** làm cơ sở dữ liệu.

---

## 1. Tính năng chính

* Xác thực JWT & Google OAuth 2.0
* Hỗ trợ phân quyền *student / teacher / admin* và RLS trên Supabase
* Thuật toán ôn tập SM‑2 & nhiều chế độ học (flashcard, điền khuyết, word‑association…)
* Tạo ví dụ câu tự động với **Google Generative AI (Gemini)**
* Giới hạn tốc độ và bộ nhớ đệm bằng Redis (tuỳ chọn)
* Hệ thống email giao dịch (Nodemailer + Handlebars) kèm xác thực email
* Unit test với Jest & Supertest
* Logging bằng Winston, bảo mật HTTP headers (Helmet) & rate‑limiting nâng cao

## 2. Tech Stack

| Layer          | Công nghệ                               |
| -------------- | --------------------------------------- |
| Runtime        | Node.js 20 +, Express 5                 |
| Database       | Supabase (Postgres + Storage + RLS)     |
| Cache / Queue  | Redis (optional)                        |
| Authentication | Passport JWT · Passport Google          |
| Emails         | Nodemailer (SMTP)                       |
| AI             | Google Generative AI (Gemini 1.5 Flash) |
| Tests          | Jest, Supertest                         |

## 3. Cấu trúc thư mục

``` text
vocaboost-backend/
├── src/
│   ├── app.js                       # Main Express application setup
│   ├── server.js                    # Entry point - khởi động server
│   │
│   ├── config/                      
│   │   ├── database.js              # Kết nối Supabase
│   │   ├── auth.js                  # Passport JWT & Google OAuth config
│   │   ├── redis.js                 # Redis connection với fallback
│   │   └── constants.js             # Các hằng số ứng dụng
│   │
│   ├── middleware/                 
│   │   ├── core/                    # Middleware cốt lõi, dùng globally
│   │   │   ├── security.js          # Security headers, CORS, helmet
│   │   │   ├── logging.js           # Request logging, audit trails
│   │   │   ├── parsing.js           # Body parsing, compression, timeout
│   │   │   └── session.js           # Session middleware cho OAuth
│   │   │
│   │   ├── auth/                    # Authentication & Authorization
│   │   │   ├── authenticate.js      # JWT authentication strategies
│   │   │   ├── authorize.js         # Role-based access control
│   │   │   └── index.js             # Export tất cả auth middleware
│   │   │
│   │   ├── protection/              
│   │   │   └── rateLimiter.js       # Redis-based distributed rate limiting
│   │   │
│   │   ├── validation/              
│   │   │   └── validators.js        # Common validation rules & handlers
│   │   │
│   │   ├── monitoring/              # Monitoring & debugging
│   │   │   ├── requestId.js         # Request tracking với unique ID
│   │   │   ├── performance.js       # Performance monitoring
│   │   └   └── errorHandler.js      # Enhanced error handling & reporting
│   │
│   ├── controllers/                 # Request handlers
│   │   ├── adminController.js       # Admin panel operations
│   │   ├── authController.js        # Authentication endpoints
│   │   ├── classroomController.js   # Classroom management
│   │   ├── reviewController.js      # Learning review sessions
│   │   ├── userController.js        # User profile & settings
│   │   └── vocabularyController.js  # Vocabulary lists & items
│   │
│   ├── models/                      # Data access layer (Supabase ORM)
│   │   ├── User.js                  # User model với authentication
│   │   ├── Token.js                 # Password reset & email verification
│   │   ├── VocabularyList.js        # Vocabulary list management
│   │   ├── VocabularyItem.js        # Individual vocabulary items
│   │   ├── LearningProgress.js      # Spaced repetition progress
│   │   ├── Classroom.js             # Classroom & teacher functionality
│   │
│   ├── routes/                      # API route definitions
│   │   ├── authRoutes.js            # /api/auth/* - Authentication
│   │   ├── userRoutes.js            # /api/users/* - User management
│   │   ├── vocabularyRoutes.js      # /api/vocabulary/* - Vocabulary
│   │   ├── reviewRoutes.js          # /api/review/* - Learning sessions
│   │   ├── classroomRoutes.js       # /api/classrooms/* - Classroom
│   │   ├── adminRoutes.js           # /api/admin/* - Admin panel
│   │   └── index.js                 # Route composition
│   │
│   ├── services/                    # Business logic layer
│   │   ├── aiService.js             # Google Generative AI integration
│   │   ├── emailService.js          # SMTP email sending
│   │   ├── cacheService.js          # Redis caching wrapper
│   │   └── spacedRepetition.js      # SM-2 algorithm implementation
│   │
│   ├── utils/                       # Helper functions & utilities
│   │   ├── jwtHelpers.js            # Generate token functions
│   │   ├── logger.js                # Winston logging configuration
│   │
│   ├── templates/                   # Email & document templates
│   │   └── emails/                  # Handlebars email templates
│   │       ├── registration-confirmation.hbs          
│   │       └── password-reset.hbs   
│   │
│   └── tests/                       
│       ├── auth.test.js         # Authentication flow tests
│       └── redis.test.js        # Redis integration tests
│
├── .env                             # Environment variables (gitignored)
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore rules
├── package.json                     # Dependencies & scripts
├── package-lock.json                # Dependency lock file
├── README.md                        
│
├── docker/                          # Docker configuration
│   ├── Dockerfile.dev               # Development environment
│   └── docker-compose.yml           # Full stack với Redis & DB
│
├── docs/                            # Documentation
│   ├── API.md                       # API documentation
│   ├── DEPLOYMENT.md                # Deployment guide
│   ├── MIDDLEWARE.md                # Middleware architecture
│   └── REDIS.md                     # Redis setup & usage
│
├── scripts/                         # Utility scripts
│   ├── migrate.js                   # Database migration runner
│   ├── seed.js                      # Database seeding
│   └── health-check.js              # Health check script
│
└── logs/                            # Application logs (gitignored)
    ├── error.log                    # Error logs
    ├── combined.log                 # All logs
    └── access.log                   # Request access logs
```

> **Mô hình thư mục chi tiết**: gốc dự án chứa cấu hình container hoá (Dockerfile, docker-compose.yml) và file môi trường; mã nguồn backend nằm trong `src/`, tách riêng các lớp *config*, *controllers*, *middleware*, *models*, *services*, *routes* & *templates*. Unit tests được đặt trong `tests/`.

## 4. Cài đặt nhanh

> Yêu cầu: **Node.js 18 +**, **npm** (hoặc **pnpm/yarn**), **Supabase CLI** cài sẵn, và (tuỳ chọn) **Redis** nếu bạn muốn bật cache & distributed rate‑limit.

```bash
# 1. Clone & cài dependencies
$ git clone https://github.com/petiheo/vocaboost-backend.git
$ cd vocaboost-backend
$ npm install

# 2. Tạo file cấu hình môi trường
$ cp .env.example .env
# → Điền thông tin DB, JWT, SMTP, OAuth, Redis, Gemini...

# 3. Khởi tạo cơ sở dữ liệu (Supabase)
$ supabase db push                   # hoặc psql -f 001_initial_schema.sql

# 4. Chạy server ở chế độ development (nodemon reload)
$ npm run dev
# Hoặc production
$ npm start

# 5. Kiểm tra
$ curl http://localhost:3000/api/health
```

### Các biến môi trường quan trọng (rút gọn)

| Biến                                           | Giải thích                            |
| ---------------------------------------------- | ------------------------------------- |
| `PORT`                                         | Cổng API (mặc định **3000**)          |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`        | Kết nối Database Supabase             |
| `FRONTEND_URL`                                 | Origin Frontend cho CORS & email link |
| `SESSION_SECRET`                               | Khoá session (Google OAuth)           |
| `JWT_SECRET` / `JWT_EXPIRE`                    | Khoá & thời hạn token JWT             |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`    | Thông tin OAuth Google                |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | (Tuỳ chọn) kết nối Redis              |
| `SMTP_HOST` / `SMTP_USER` / ...                | Thông tin SMTP gửi email              |
| `GEMINI_API_KEY`                               | Khoá Google Generative AI             |

## 5. Test

```bash
npm test      # Chạy toàn bộ Jest test suites
```

## 6. API Endpoints tiêu biểu (REST)

| Phương thức | URL                | Mô tả                          |
| ----------- | ------------------ | ------------------------------ |
| GET         | /api/health        | Kiểm tra trạng thái server     |
| POST        | /api/auth/register | Đăng ký tài khoản              |
| POST        | /api/auth/login    | Đăng nhập JWT                  |
| GET         | /api/auth/verify-email/:token | Xác thực email              |
| GET         | /api/vocabulary    | Lấy danh sách list công khai   |
| GET         | /api/review/queue  | Hàng đợi ôn tập của người dùng |

> Xem thêm chi tiết trong từng file route dưới `src/routes/`.

---

© 2025 VocaBoost Team – Happy Learning!
