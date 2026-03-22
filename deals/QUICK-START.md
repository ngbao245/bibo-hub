# Deal Tracker - Quick Start

## Cách hoạt động

1. **GitHub Actions** chạy scraper Python mỗi 10 phút
2. Scraper lấy deals từ Telegram → ghi vào `telegram/deals.txt`
3. Commit tự động lên repo
4. Frontend đọc `telegram/deals.txt` trực tiếp (không cần API server)

## Setup GitHub Actions

### Bước 1: Thêm Secrets
Vào GitHub repo → Settings → Secrets and variables → Actions → New repository secret

Thêm 3 secrets:
- `TELEGRAM_API_ID` - API ID từ my.telegram.org
- `TELEGRAM_API_HASH` - API Hash từ my.telegram.org
- `TELEGRAM_PHONE` - Số điện thoại (format: +84xxxxxxxxx)

### Bước 2: Enable Actions
- Vào tab Actions trong repo
- Click "I understand my workflows, go ahead and enable them"

### Bước 3: Test
- Vào Actions → Scrape Telegram Deals → Run workflow
- Chờ vài phút, check `telegram/deals.txt` có update không

## Deploy Vercel

1. Push code lên GitHub
2. Vercel tự động deploy
3. Mở trang → Click "🎯 Deal Tracker" hoặc `Alt+Shift+D`

## Không cần

- ❌ API server
- ❌ Node.js backend
- ❌ Database
- ❌ Vercel Functions

Chỉ cần: GitHub Actions + Static hosting = Miễn phí 100%
