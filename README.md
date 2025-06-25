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
* Hệ thống email giao dịch (Nodemailer + Handlebars)
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

```text
vocaboost-backend/
├── src/
│   ├── app.js
│   ├── config/
│   │   ├── database.js      # Kết nối Supabase
│   │   ├── auth.js          # Config JWT & OAuth
│   │   └── constants.js     # Các hằng số
│   ├── controllers/
│   │   ├── adminController.js
│   │   ├── authController.js
│   │   ├── classroomController.js
│   │   ├── reviewController.js
│   │   ├── userController.js
│   │   └── vocabularyController.js
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   ├── errorHandler.js
│   │   ├── rateLimiter.js
│   │   └── validators.js
│   ├── models/
│   │   ├── Classroom.js
│   │   ├── LearningProgress.js
│   │   ├── User.js
│   │   ├── VocabularyItem.js
│   │   └── VocabularyList.js
│   ├── routes/
│   │   ├── adminRoutes.js
│   │   ├── authRoutes.js
│   │   ├── classroomRoutes.js
│   │   ├── reviewRoutes.js
│   │   ├── userRoutes.js
│   │   ├── vocabularyRoutes.js
│   │   └── index.js
│   ├── services/
│   │   ├── aiService.js
│   │   ├── CacheService.js
│   │   ├── emailService.js
│   │   └── spacedRepetition.js
│   ├── templates/
│   │   └── emails/
│   │       ├── password-reset.hbs
│   │       └── registration-confirmation.hbs
│   └── utils/
│   │   ├── helpers.js
│   │   └── logger.js
│   ├── tests/
│   └── auth.test.js
├── .env.example
├── .env
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
└── server.js                    # Entry point
```

> **Mô hình thư mục chi tiết**: gốc dự án chứa cấu hình container hoá (Dockerfile, docker-compose.yml) và file môi trường; mã nguồn backend nằm trong `src/`, tách riêng các lớp *config*, *controllers*, *middleware*, *models*, *services*, *routes* & *templates*. Unit tests được đặt trong `tests/`.

## 4. Cài đặt nhanh

> Yêu cầu: **Node.js 18 +**, **npm** (hoặc **pnpm/yarn**), **Supabase CLI** cài sẵn, và (tuỳ chọn) **Redis** nếu bạn muốn bật cache & distributed rate‑limit.

```bash
# 1. Clone & cài dependencies
$ git clone https://github.com/<YOUR‑ORG>/vocaboost-backend.git
$ cd vocaboost-backend
$ npm install

# 2. Tạo file cấu hình môi trường
$ cp .env.example .env
# → Điền thông tin DB, JWT, SMTP, OAuth, Redis, Gemini...

# 3. Khởi tạo cơ sở dữ liệu (Supabase)
$ supabase db push                   # hoặc psql -f supabase/migrations/001_initial_schema.sql

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
| GET         | /api/vocabulary    | Lấy danh sách list công khai   |
| GET         | /api/review/queue  | Hàng đợi ôn tập của người dùng |

> Xem thêm chi tiết trong từng file route dưới `src/routes/`.

---

© 2025 VocaBoost Team – Happy Learning!
