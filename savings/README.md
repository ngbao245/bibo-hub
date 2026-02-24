# Savings Tracker Modal

Gamification tiết kiệm tiền với progress tracking, milestones, QR code, và Daily Challenge.

## Features

- **Goal Setting**: Tên, số tiền, thời hạn (hỗ trợ `3m` = 90 ngày)
- **Progress Tracking**: Progress bar, % hoàn thành, stats còn lại/ngày
- **Milestones**: 🌱 25% → 🌿 50% → 🌳 75% → 🏆 100%
- **Quick Add**: 50k, 100k, 200k, 500k (tự disable khi vượt target)
- **Custom Amount**: Nhập tay, format số tự động (10.000.000)
- **QR Code**: Upload ảnh QR ngân hàng
- **History**: Toggle panel lịch sử bên cạnh nút tạo mới
- **Optimistic UI**: Update ngay, save ngầm, rollback nếu lỗi
- **Daily Challenge**: Bảng 30 ngày tiết kiệm random

## File Structure

```
savings/
├── savings-loader.js   # Dynamic loader + HTML template
├── savings-modal.js    # Logic
├── savings-modal.css   # Styles
└── README.md
```

## Data Schema (MockAPI notes table)

```json
{
  "type": "savings",
  "title": "Tên mục tiêu",
  "url1": "10000000",
  "url2": "2500000",
  "url3": "90",
  "url4": "data:image/png;base64,...",
  "url5": "{\"enabled\":true,\"days\":[...]}",
  "source": "2026-02-24",
  "content": "[{\"amount\":500000,\"date\":\"...\",\"challengeDay\":1}]"
}
```

| Field | Dùng cho |
|-------|----------|
| `url1` | targetAmount |
| `url2` | currentAmount |
| `url3` | deadline (ngày) |
| `url4` | QR image base64 |
| `url5` | challenge JSON |
| `source` | startDate local (YYYY-MM-DD) |
| `content` | history JSON array |

## Daily Challenge

Bảng 30 ô, mỗi ô 1 ngày với số tiền bội số 50k, shuffle random, tổng ≥ target.

**Generate:**
```javascript
// Base = ceil(target / 30 / 50000) * 50000
// Tạo variants ±2 step xung quanh base, shuffle Fisher-Yates
// Adjust ngày cuối nếu tổng < target
```

**Xác định ngày hiện tại (`getTodayIndex`):**

Dùng `history` thay vì `startDate` để tránh lệch timezone:
```javascript
function getTodayIndex() {
    // Nếu chưa có history → todayIdx = 0 (chỉ ngày 1 mở)
    // Tìm entry challengeDay === 1 trong history → lấy date làm mốc ngày 0
    // Diff từ ngày đó đến hôm nay (local date, không dùng ISO string trực tiếp)
}
```

**Tại sao không dùng `startDate`/`createdAt`:**
- MockAPI lưu `createdAt` theo UTC → lệch timezone với user UTC+7
- Ví dụ tạo lúc 1h sáng VN = 18h ngày hôm trước UTC → `createdAt` sai ngày
- Dùng history entry thực tế của user → luôn đúng ngày local

**Rules:**
- Chỉ tick được ngày hôm nay hoặc ngày đã qua (missed)
- Ngày tương lai: `pointer-events: none` + không gắn event listener
- Double-check trong `tickChallengeDay`: `if (index > getTodayIndex()) return`
- Khi challenge bật: ẩn section "Thêm tiền" (quick buttons + custom input)

## Optimistic UI

```
User action → update state + UI ngay → debouncedSave(300ms) → API
                                              ↓ lỗi
                                    rollback state → updateDisplay → toast
```

Snapshot trước mỗi action:
```javascript
const snapshot = {
    currentAmount: savingsGoal.currentAmount,
    history: [...savingsGoal.history],
    challenge: JSON.parse(JSON.stringify(savingsGoal.challenge))
};
```

## Input Formatting

- Số tiền: `type="text"` + live format `10000000` → `10.000.000`
- Deadline: hỗ trợ `3m` → 90 ngày, convert on blur
- Scroll wheel trên input để tăng/giảm (snap về bội số step)

## Loading Strategy

- Lần đầu mở: skeleton shimmer → fetch → render
- Lần 2+ (có cache): show ngay → sync ngầm nếu không có pending save
- Đóng trước khi load xong: reset `savingsLoading = false` để retry
