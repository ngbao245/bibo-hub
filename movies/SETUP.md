# Movies Tracker - Setup Guide

## 🗄️ Database Setup

**Movies sử dụng chung bảng `notes` với Notes app!**

Không cần tạo bảng mới. Movies được phân biệt bằng field `type`:
- `type="movie"` - Phim lẻ
- `type="series"` - Phim bộ

Notes app sẽ tự động filter out movies (`type !== "movie" && type !== "series"`).

## ⚙️ API Configuration

Movies sử dụng `API_CONFIG.NOTES` (đã có sẵn từ Notes app).

Không cần config gì thêm!

## 📝 Field Mapping

Movies data được map vào notes schema như sau:

| Movie Field | Notes Field | Description |
|-------------|-------------|-------------|
| title | title | Tên phim |
| notes | content | Ghi chú/thoughts |
| type | type | "movie" hoặc "series" |
| url | source | Link xem phim |
| status | tags | "watching", "completed", "plan" |
| currentTime | url1 | Thời gian hiện tại (phim lẻ) |
| totalTime | url2 | Tổng thời gian (phim lẻ) |
| currentEpisode | url1 | Tập hiện tại (phim bộ) |
| totalEpisodes | url2 | Tổng số tập (phim bộ) |
| season | url3 | Season (phim bộ) |
| rating | url4 | Đánh giá 1-5 sao |

## 📝 Sample Data

Để test, tạo vài movies mẫu:

**Phim lẻ:**
```json
{
  "title": "The Shawshank Redemption",
  "type": "movie",
  "status": "watching",
  "currentTime": "45:30",
  "totalTime": "142:00",
  "notes": "Great movie!",
  "rating": 5
}
```

**Phim bộ:**
```json
{
  "title": "Breaking Bad",
  "type": "series",
  "status": "watching",
  "season": 2,
  "currentEpisode": 5,
  "totalEpisodes": 13,
  "notes": "Amazing series",
  "rating": 5
}
```

## 🚀 Usage

### Thêm phim lẻ
1. Click "+ Add Movie"
2. Nhập tên: "Inception"
3. Type: "Movie"
4. Total Time: "148:00" (2h 28min)
5. Status: "Plan to Watch"
6. Click "Save"

### Thêm phim bộ
1. Click "+ Add Movie"
2. Nhập tên: "Game of Thrones"
3. Type: "Series"
4. Season: 1
5. Total Episodes: 10
6. Status: "Watching"
7. Click "Save"

### Update progress
- **Click progress bar**: Jump tới % bất kỳ
- **Click "⏩ +5 min"**: Thêm 5 phút (phim lẻ)
- **Click "▶ Next Episode"**: Tập tiếp theo (phim bộ)
- **Click "✓ Mark Complete"**: Đánh dấu đã xem xong

### Filter & Search
- **Status**: All, Watching, Completed, Plan to Watch
- **Type**: All, Movies, Series
- **Search**: Tìm theo tên phim

## 🎨 UX Features

### Quick Actions
- Progress bar clickable → jump tới %
- One-click complete
- Fast forward +5 min / next episode
- Visual progress indicators

### Keyboard Shortcuts
- `Enter`: Save form
- `Escape`: Close modal
- Click outside modal: Close

### Mobile Support
- Hamburger menu (☰)
- Touch-friendly buttons
- Responsive layout

## 🐛 Troubleshooting

### Movies không load
- Check API URL trong `config.js`
- Mở Console (F12) xem lỗi
- Verify MockAPI accessible

### Progress không update
- Check `currentTime` format: "MM:SS"
- Check `totalTime` có giá trị
- Xem Console có lỗi

### Modal không mở
- Check JavaScript loaded
- Xem Console có lỗi
- Try refresh page

## 📱 Mobile Testing

Test trên mobile:
1. Mở DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Chọn iPhone/Android
4. Test hamburger menu
5. Test touch interactions

---

**Ready to use!** 🎬
