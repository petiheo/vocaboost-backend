# Supabase CLI Setup Guide

Hướng dẫn sử dụng Supabase CLI cho team backend của dự án VocaBoost.

## I. Cài đặt Supabase CLI

```bash
# macOS với Homebrew
brew install supabase/tap/supabase

# Windows với Chocolatey
choco install supabase
```

## II. Quản lý Database
### 1. Đăng nhập vào Supabase

```bash
supabase login
```

Lệnh này sẽ mở trình duyệt để đăng nhập vào tài khoản Supabase.


### 2. Khởi động local development (optional - không dùng local, dùng cloud cũng được)

```bash
# Khởi động Supabase local stack (yêu cầu phải có Docker)
supabase start

# Dừng local stack
supabase stop

# Reset database (xóa tất cả dữ liệu)
supabase db reset
```

Sau khi chạy `supabase start`, bạn sẽ thấy thông tin kết nối:

```
API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: your-super-secret-jwt-token-with-at-least-32-characters-long
anon key: your-anon-key
service_role key: your-service-role-key
```

### 3. Kết nối với database trên cloud
```bash
# Login vào Supabase
supabase login

# Link với project đã tạo
supabase link --project-ref your-project-id
```

## III. Workflow phát triển

### 1. Làm việc với migrations

```bash
# Tạo migration mới
supabase migration new add_user_preferences

# Viết SQL trong file migration được tạo
# Ví dụ: supabase/migrations/20240101000000_add_user_preferences.sql

# Test migration locally
supabase db reset

# Kiểm tra database schema
supabase db diff
```

### 2. Sync với remote database

```bash
# Link với project trên cloud (chỉ làm 1 lần)
supabase link --project-ref <project-ref>

# Push migrations lên remote
supabase db push

# Pull schema từ remote về local
supabase db pull
```

## IV. Testing và Debug

### Kiểm tra database

```bash
# Mở Supabase Studio (GUI)
# Truy cập: http://localhost:54323

# Kết nối trực tiếp với database
supabase db shell

# Xem logs
supabase logs
```

### Seed data (optional, tạo nếu cần dữ liệu test)

```bash
# Tạo file seed trong supabase/seed.sql
# Chạy seed data
supabase db reset --seed
```

## V. Team workflow

### 1. Khi nhận code mới từ Git

```bash
git pull origin main
cd supabase
supabase db reset  # Chạy tất cả migrations mới
```

### 2. Khi thêm migration mới

```bash
# Tạo migration
supabase migration new your_feature_name

# Viết SQL trong file migration
# Test local
supabase db reset

# Commit và push
git add .
git commit -m "feat: add migration for your feature"
git push origin your-branch
```

### 3. Khi có conflict trong migrations

```bash
# Pull latest changes
git pull origin main

# Đổi tên migration file nếu cần (để tránh conflict timestamp)
# Reset database
supabase db reset

# Test và commit
```
## VI. Commands cheat sheet

| Command | Mô tả |
|---------|--------|
| `supabase start` | Khởi động local stack |
| `supabase stop` | Dừng local stack |
| `supabase status` | Kiểm tra trạng thái services |
| `supabase db reset` | Reset database và chạy migrations |
| `supabase db push` | Push migrations lên remote |
| `supabase db pull` | Pull schema từ remote |
| `supabase migration new <name>` | Tạo migration mới |
| `supabase migration list` | Liệt kê migrations |
| `supabase db diff` | So sánh schema changes |

## 🔗 Tài liệu tham khảo

- [Local Development & CLI](https://supabase.com/docs/guides/cli)

---

**Lưu ý:** Luôn test migrations trên local trước khi push lên remote. Đừng chỉnh sửa migrations đã được apply trên production.