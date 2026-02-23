# Movies Tracker

Ứng dụng quản lý và tracking tiến độ xem phim với optimistic UI và draggable progress bar.

## 📋 Overview

Movies Tracker là mini project chuyên dụng để quản lý danh sách phim đang xem, đã xem, và dự định xem. Hỗ trợ cả phim lẻ (tracking thời gian) và phim bộ (tracking số tập).

## 🚀 Features

### Core Features
- **Phim lẻ**: Track thời gian xem (VD: 45:30 / 120:00)
- **Phim bộ**: Track tập đang xem + thời gian trong tập (VD: (20:00) Ep 5 / 10)
- **Draggable Progress Bar**: Kéo thả để update tiến độ nhanh
  - Phim lẻ: Smooth theo giây
  - Phim bộ: Snap theo từng tập
- **Double-click Edit**: Double-click vào thời gian để edit trực tiếp
- **Auto Status**: Tự động chuyển status khi có tiến độ
- **Rating System**: Đánh giá 1-5 sao (click lại để xóa)
- **Status Filter**: All, Watching, Completed, Plan to Watch
- **Type Filter**: All, Movies, Series
- **Search**: Tìm kiếm theo tên phim

### UX Optimizations
- **Optimistic UI**: Update UI ngay lập tức, save API ở background
- **Debounced Save**: Chỉ save API sau 200ms khi thả chuột
- **Smart Time Parsing**: 
  - "120" → 120:00
  - "12 34" → 12:34
  - "12:34" → 12:34
  - "12:12222" → 12:12 (chỉ lấy 2 chữ số giây)
- **Scroll Wheel Input**: Focus vào number input và scroll để tăng/giảm
- **Visual Feedback**: 
  - Tooltip hiển thị thời gian/% khi kéo
  - Progress bar màu sắc theo status
  - Inset shadow cho input đang edit
- **Mobile-friendly**: Touch-optimized với hamburger menu
- **Unsaved Changes Warning**: Cảnh báo khi có thay đổi chưa lưu

### Smart Behaviors
- **Auto Status Change**:
  - Current Episode > 0 → Watching
  - Current Episode >= Total Episodes → Completed
  - Current Time > 0:00 → Watching
- **Validation**:
  - Current Episode không vượt quá Total Episodes
  - Giây không vượt quá 59
- **Next Episode**: Reset episode time về 0:00 khi chuyển tập
- **Plan to Watch**: Current Episode = 0, không hiển thị S01E01

## 📁 File Structure

```
movies/
├── movies.html              # Main HTML page
├── movies.css               # Styles + animations
├── movies.js                # Main logic (optimistic UI, debounce)
├── movies-mobile.js         # Mobile hamburger menu
├── README.md                # This file
└── SETUP.md                 # Setup instructions
```

## 🗄️ Database Schema

Uses MockAPI **notes** table (shared with Notes app):

**Movies use notes table with type filtering:**
- `type="movie"` - Phim lẻ
- `type="series"` - Phim bộ

**Field Mapping:**
```json
{
  "id": "string",
  "title": "string (movie title)",
  "content": "string (notes/thoughts)",
  "type": "movie|series",
  "source": "string (watch URL)",
  "tags": "watching|completed|plan (status)",
  "example": "string (unused)",
  "url1": "string (currentTime for movie, currentEpisode for series)",
  "url2": "string (totalTime for movie, totalEpisodes for series)",
  "url3": "string (season for series)",
  "url4": "string (rating 1-5)",
  "url5": "string (episodeDuration for series - time in current episode)",
  "wordCountEnabled": false,
  "timerDuration": "0",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

**Why share notes table?**
- No need to create separate movies table in MockAPI
- Reuse existing API endpoint
- Movies filtered by `type="movie"` or `type="series"`
- Notes app filters out movies (`type !== "movie" && type !== "series"`)

## 🔧 Technical Implementation

### Progress Calculation

**Phim lẻ:**
```javascript
function calculateMovieProgress(currentTime, totalTime) {
    const current = timeToSeconds(currentTime);
    const total = timeToSeconds(totalTime);
    return Math.round((current / total) * 10000) / 100; // 2 decimal places
}
```

**Phim bộ:**
```javascript
function calculateSeriesProgress(currentEpisode, totalEpisodes) {
    return Math.round((currentEpisode / totalEpisodes) * 10000) / 100; // 2 decimal places
}
```

### Draggable Progress Bar

**Smooth dragging với debounce:**
```javascript
// While dragging: only update UI
const onMove = (event) => {
    const percent = calculatePercent(clientX);
    updateProgressUI(movie, percent); // No API call
};

// On release: save to API with debounce
const onEnd = () => {
    updateProgress(movie, lastPercent); // Debounced save (200ms)
};
```

**Snap behavior:**
```javascript
// Series: snap to episode boundaries
if (movie.type === 'series') {
    const episodePercent = 100 / movie.totalEpisodes;
    percent = Math.round(percent / episodePercent) * episodePercent;
}

// Movie: snap to seconds (smooth)
if (movie.type === 'movie') {
    const totalSeconds = timeToSeconds(movie.totalTime);
    const currentSeconds = Math.round((percent / 100) * totalSeconds);
    percent = (currentSeconds / totalSeconds) * 100;
}
```

### Double-click Edit

```javascript
span.addEventListener('dblclick', (e) => {
    // Replace span with input
    const input = document.createElement('input');
    input.value = currentValue;
    span.parentNode.insertBefore(input, span);
    span.style.display = 'none';
    input.focus();
    
    // Save on blur or Enter
    input.addEventListener('blur', saveValue);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveValue();
        if (e.key === 'Escape') cancel();
    });
});
```

### Optimistic UI

```javascript
// Update UI immediately
updateMovieInState(updatedMovie);
renderMovies();

// Save to API in background with debounce
debouncedSave(updatedMovie); // 200ms delay
```

## 🎨 Styling

### Progress Bar Colors
- Watching: Blue (#007acc)
- Completed: Green (#4caf50)
- Plan to watch: Gray (#666)

### Animations
- `slideInTop`: Card animation khi update (nếu có)
- Smooth transitions cho hover states
- Inset shadow cho input đang edit

### Layout
```
┌─────────────────────────────────────┐
│ Sidebar: Filters                    │
│ - Status (All/Watching/...)         │
│ - Type (All/Movies/Series)          │
├─────────────────────────────────────┤
│ [Search] [+ Add Movie]              │
├─────────────────────────────────────┤
│ Movie Cards                         │
│ ┌─────────────────────────────────┐ │
│ │ 🎬 Movie Title - S01E05  [Badge]│ │
│ │ ⭐⭐⭐⭐⭐                        │ │
│ │ (20:00) Ep 5 / 10        42%    │ │
│ │ [████████░░░░░░░░░░░░░░]        │ │
│ │ [▶ Watch] [Next Ep]  [⚙] [✕]   │ │
│ │ Notes: Great show!              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🚀 Usage

### Thêm phim lẻ
1. Click "+ Add Movie"
2. Nhập tên phim
3. Type: "Movie", Total Time: "120" (120 phút)
4. Status mặc định: Plan to Watch (ẩn)
5. Click "Save"

### Thêm phim bộ
1. Click "+ Add Movie"
2. Nhập tên phim
3. Type: "Series"
4. Total Episodes: 12
5. Current Episode: 0 (mặc định)
6. Click "Save"

### Update progress
- **Kéo progress bar**: Kéo thả để jump tới vị trí
- **Double-click time**: Click 2 lần vào thời gian để edit
- **Next Ep button**: Chuyển sang tập tiếp theo (series)
- **+5 min button**: Thêm 5 phút (movies only)

### Smart Features
- Nhập "120" → tự động thành 120:00
- Nhập "12 34" → tự động thành 12:34
- Current Episode > 0 → tự động chuyển sang Watching
- Scroll wheel trên number input để tăng/giảm

---

**Version**: 2.0.0  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, MockAPI  
**Key Features**: Optimistic UI, Draggable Progress, Smart Parsing, Auto Status
