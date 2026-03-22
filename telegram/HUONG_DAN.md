# 🎯 Hướng Dẫn Sử Dụng Telegram Deal Scraper

## ✨ KHÔNG CẦN API - SIÊU ĐỠN GIẢN!

## Bước 1: Cài đặt Python
- Tải Python từ https://www.python.org/downloads/
- Chọn "Add Python to PATH" khi cài đặt

## Bước 2: Cài đặt thư viện
Mở Command Prompt (cmd) trong thư mục này và chạy:
```
pip install -r requirements.txt
```

## Bước 3: Chạy script (XONG!)
```
python telegram_scraper.py
```

KHÔNG CẦN ĐĂNG NHẬP, KHÔNG CẦN API, KHÔNG CẦN GÌ CẢ!

## Cách hoạt động:
- ✅ Script sẽ chạy ngầm và lắng nghe tin nhắn mới
- ✅ Mỗi khi có deal mới, tự động lưu vào file `deals.txt`
- ✅ Bạn chỉ cần mở file `deals.txt` để xem tất cả deals
- ✅ Hoàn toàn miễn phí, không tốn tiền

## Chạy tự động khi khởi động Windows:
1. Nhấn `Win + R`, gõ `shell:startup`
2. Tạo file `start_deal_tracker.bat` với nội dung:
```
@echo off
cd /d "ĐƯỜNG_DẪN_THƯ_MỤC_SCRIPT"
python telegram_deal_tracker.py
```
3. Copy file .bat vào thư mục startup

## Lưu ý:
- Script cần chạy liên tục để bắt tin nhắn mới
- Nếu tắt máy thì script sẽ dừng
- Có thể chạy trên VPS miễn phí nếu muốn chạy 24/7

## Troubleshooting:
- Lỗi "No module named telethon": Chạy lại `pip install telethon`
- Lỗi kết nối: Kiểm tra internet và tên kênh
- Lỗi API: Kiểm tra lại API_ID và API_HASH
