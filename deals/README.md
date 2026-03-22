# Deal Tracker

Modal popup để theo dõi deals từ Telegram channel.

## Cấu trúc

- `deals-modal.js` - Logic chính của modal
- `deals-modal.css` - Styling theo common.css
- `deals-loader.js` - Lazy loading modal

## API

- `/api/deals` - Vercel Serverless Function đọc `telegram/deals.txt`

## Deployment

### Vercel
1. Push code lên GitHub
2. Connect repo với Vercel
3. Deploy tự động

### GitHub Actions (Auto-scrape)
1. Vào GitHub repo → Settings → Secrets
2. Thêm secrets:
   - `TELEGRAM_API_ID`
   - `TELEGRAM_API_HASH`
   - `TELEGRAM_PHONE`
3. GitHub Actions tự chạy scraper mỗi 10 phút

## Tính năng

- ✅ Hiển thị deals từ Telegram
- ✅ Tìm kiếm deals
- ✅ Lọc: Tất cả / Chưa xem / Đã xem
- ✅ Đánh dấu đã xem (lưu localStorage)
- ✅ Hiển thị hình ảnh
- ✅ Badge "Mới nhất" và "MỚI"
- ✅ Auto-scrape mỗi 10 phút (GitHub Actions)
- ✅ Responsive mobile

## Shortcut

`Alt+Shift+D` - Mở Deal Tracker modal
