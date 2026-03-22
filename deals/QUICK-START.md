# 🚀 Quick Start - Deal Tracker

## Cách nhanh nhất để bắt đầu:

### Bước 1: Chạy Telegram Scraper (Thu thập deals)
```bash
cd telegram
python telegram_scraper.py
```
Script sẽ tự động thu thập deals từ kênh Telegram và lưu vào `telegram/deals.txt`

### Bước 2: Chạy Deal Tracker Web (Xem deals)
Mở terminal mới:
```bash
cd deals
node deals-api.js
```

### Bước 3: Mở trình duyệt
Truy cập: http://localhost:3000/deals.html

## Hoặc từ Hub:
1. Mở file `index.html` hoặc `hub.html`
2. Click vào nút "🎯 Deal Tracker"

---

## 💡 Tips:

### Chạy cả 2 cùng lúc:
Mở 2 terminal:
- Terminal 1: `cd telegram && python telegram_scraper.py`
- Terminal 2: `cd deals && node deals-api.js`

### Chạy tự động khi khởi động:
Tạo file `start-deal-system.bat`:
```batch
@echo off
start cmd /k "cd telegram && python telegram_scraper.py"
start cmd /k "cd deals && node deals-api.js"
start http://localhost:3000/deals.html
```

### Kiểm tra nhanh:
```bash
# Xem số lượng deals đã thu thập
type telegram\deals.txt | find /c "====="

# Test API
curl http://localhost:3000/api/deals
```

---

## 🔧 Troubleshooting:

### Lỗi "python not found":
- Cài Python từ https://www.python.org/downloads/
- Hoặc dùng `python3` thay vì `python`

### Lỗi "node not found":
- Cài Node.js từ https://nodejs.org/

### Lỗi "No module named requests":
```bash
pip install -r telegram/requirements.txt
```

### API không kết nối được:
- Kiểm tra port 3000 có bị chiếm không
- Thử đổi PORT trong `deals-api.js`

### Không có deals:
- Kiểm tra file `telegram/deals.txt` có tồn tại không
- Chạy telegram scraper trước
- Đợi vài phút để scraper thu thập deals

---

## 📱 Sử dụng trên mobile:
1. Tìm IP máy tính: `ipconfig` (Windows) hoặc `ifconfig` (Mac/Linux)
2. Truy cập từ điện thoại: `http://[IP-máy-tính]:3000/deals.html`
   Ví dụ: `http://192.168.1.100:3000/deals.html`

---

## ⚡ Nâng cao:

### Tự động làm mới mỗi 5 phút:
Thêm vào `deals.js`:
```javascript
setInterval(() => {
    document.getElementById('refreshBtn').click();
}, 300000); // 5 phút
```

### Thông báo khi có deal mới:
Cần cài thêm notification API hoặc dùng browser notification

### Deploy lên server:
- Dùng VPS miễn phí (Heroku, Railway, Render)
- Hoặc chạy trên Raspberry Pi tại nhà
