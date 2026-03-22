# Orders App

Quản lý đơn đặt hàng cho 1 khách hàng, phân theo ngày, với 2 tab: Admin (bạn) và Customer (khách).

## Features

**Admin tab:**
- Xem đơn phân theo ngày (mới nhất trên cùng)
- Thêm/sửa/xóa sản phẩm trong từng ngày
- Nhập giá tổng per ngày (click vào giá để sửa inline)
- Checkbox "Đặt" per sản phẩm — tick khi đã đặt xong
- Checkbox "Hủy" per sản phẩm — tick khi NCC hủy đơn
- Badge cảnh báo "⚠ Chưa đặt đủ" nếu còn món chưa tick Đặt
- Nhập mã SPX per sản phẩm, click để xem tracking iframe

**Customer tab:**
- Xem đơn phân theo ngày
- Thấy tên SP, số lượng, trạng thái (Đã đặt / Đã hủy / Chờ đặt)
- Thấy giá tổng mỗi ngày
- Click mã SPX → iframe tracking Shopee Express

**URL params:**
- `orders.html` → mặc định tab Admin
- `orders.html?tab=customer` → mở thẳng tab Customer

## File Structure

```
orders/
├── orders.html
├── orders.css
├── orders.js
└── README.md
```

## Data Schema (MockAPI notes table)

Dùng chung notes table với `type="order"`:

| Field | Dùng cho |
|-------|----------|
| `title` | Tên sản phẩm |
| `source` | Ngày (YYYY-MM-DD) |
| `url1` | Số lượng |
| `url2` | Mã SPX |
| `url3` | Giá tổng của ngày (chỉ lưu ở 1 item trong ngày) |
| `tags` | Trạng thái: `ordered` / `cancelled` / `` (chưa đặt) |
| `type` | Luôn là `"order"` |

**Lưu ý:**
- `url3` (giá tổng) chỉ lưu ở 1 item trong nhóm ngày, các item khác để trống
- Khi tạo ngày mới chưa có sản phẩm, tạo placeholder item `title="(Chưa có sản phẩm)"` để giữ ngày + giá
- Placeholder bị xóa tự động khi thêm sản phẩm thật vào ngày đó

## Logic

**Highlight "Chưa đặt đủ":**
- Nếu có bất kỳ item nào trong ngày mà `tags !== 'ordered'` và `tags !== 'cancelled'` → badge vàng "⚠ Chưa đặt đủ"
- Nếu tất cả item đã ordered hoặc cancelled → badge xanh "✓ Đã đặt đủ"

**Checkbox Hủy:**
- Tick "Hủy" → `tags = 'cancelled'`, row bị gạch ngang + mờ
- Khi bị hủy, checkbox "Đặt" bị disable
- Bỏ tick "Hủy" → `tags = ''` (về trạng thái chưa đặt)

**Giá tổng:**
- Click vào giá trong admin → input inline để sửa
- Format tự động: `1500000` → `1.500.000đ`

**SPX Tracking:**
- URL: `https://tracking.shopee.vn/tracking?id={mã_spx}`
- Hiển thị trong iframe popup 700px × 80vh
