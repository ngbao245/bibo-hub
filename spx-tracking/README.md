# SPX Tracking Modal

Modal tra cứu đơn hàng Shopee Express (SPX) đơn giản và nhanh chóng.

## 📋 Overview

SPX Tracking là một modal nhỏ gọn giúp tra cứu thông tin đơn hàng Shopee Express bằng cách mở link tracking trên spx.vn. Modal lưu lịch sử tra cứu gần đây để truy cập nhanh.

## 🚀 Features

- **Tra cứu nhanh**: Nhập mã vận đơn và mở link tracking
- **Lịch sử tra cứu**: Lưu 10 mã vận đơn gần nhất
- **Click để mở lại**: Click vào lịch sử để mở lại link tracking
- **Keyboard shortcuts**: Enter để tra cứu, Escape để đóng
- **Responsive**: Hoạt động tốt trên mobile

## 📁 File Structure

```
spx-tracking/
├── spx-tracking-loader.js      # Lazy loader
├── spx-tracking-modal.js       # Logic
├── spx-tracking-modal.css      # Styles
└── README.md                   # This file
```

## 🔧 Technical Implementation

### Loader (spx-tracking-loader.js)

**Lazy Loading Pattern:**
```javascript
async function openSpxTrackingModalLazy() {
    await loadSpxTrackingModal(); // Load CSS + JS if not loaded
    // Toggle modal
}
```

**Benefits:**
- Only loads when first opened
- No impact on initial page load
- Subsequent opens are instant

### Logic (spx-tracking-modal.js)

**Key Functions:**

1. **openSpxTrackingModal()**: Open modal and load history
2. **trackSpxPackage()**: Validate and open tracking URL
3. **saveToSpxHistory()**: Save to localStorage
4. **loadSpxHistory()**: Display recent tracking codes
5. **trackSpxFromHistory()**: Quick access from history

**Storage:**
```javascript
const SPX_STORAGE_KEY = 'spx_tracking_history';

// History format
[
    {
        code: "SPXVN062495885902",
        timestamp: "2026-02-24T10:30:00.000Z"
    }
]
```

**URL Format:**
```javascript
const SPX_BASE_URL = 'https://spx.vn/track?';
// Result: https://spx.vn/track?SPXVN062495885902
```

### Styles (spx-tracking-modal.css)

**Key Classes:**
- `.spx-modal-content`: Modal container (max-width: 500px)
- `.spx-input-group`: Input field wrapper
- `.spx-recent-section`: History section
- `.spx-recent-item`: History item (clickable)

**Responsive:**
- Mobile: 95% width, 16px font size (prevent iOS zoom)
- Desktop: 500px max width

## 🚀 Usage

### From Hub
1. Click "📦 SPX Tracking" button
2. Enter tracking code (e.g., SPXVN062495885902)
3. Press Enter or click "🔍 Tra cứu"
4. New tab opens with tracking info

### From History
1. Open modal
2. Click any recent tracking code
3. Opens tracking page immediately

### Keyboard Shortcuts
- `Enter`: Track package (when input focused)
- `Escape`: Close modal

## ⚙️ Configuration

### Change Tracking URL
Edit `SPX_BASE_URL` in `spx-tracking-modal.js`:
```javascript
const SPX_BASE_URL = 'https://spx.vn/track?';
```

### Change History Limit
Edit history slice in `saveToSpxHistory()`:
```javascript
history = history.slice(0, 10); // Keep last 10
```

### Add Validation
Edit `trackSpxPackage()`:
```javascript
// Add custom validation
if (!trackingCode.startsWith('SPXVN')) {
    alert('Mã vận đơn phải bắt đầu bằng SPXVN');
    return;
}
```

## 🐛 Troubleshooting

### Modal not opening
- Check `spx-tracking-loader.js` is loaded in hub.html
- Check Console for errors
- Verify button onclick calls `openSpxTrackingModalLazy()`

### History not saving
- Check localStorage is enabled
- Check Console for errors
- Verify `SPX_STORAGE_KEY` is correct

### Link not opening
- Check popup blocker settings
- Verify `SPX_BASE_URL` is correct
- Check tracking code format

### Mobile input zoom
- CSS already includes `font-size: 16px` for mobile
- This prevents iOS auto-zoom on input focus

## 📝 Development Notes

### Adding New Features

**Add Tracking Provider:**
1. Add provider selector in HTML
2. Update `SPX_BASE_URL` based on selection
3. Add provider-specific validation

**Add Barcode Scanner:**
1. Add camera permission request
2. Use QuaggaJS or similar library
3. Auto-fill input with scanned code

**Add Notification:**
1. Request notification permission
2. Use Notification API
3. Notify when package status changes

### Code Style

**Naming Conventions:**
- Functions: camelCase (`trackSpxPackage`, `loadSpxHistory`)
- Constants: UPPER_SNAKE_CASE (`SPX_STORAGE_KEY`, `SPX_BASE_URL`)
- CSS classes: kebab-case (`.spx-recent-item`, `.spx-input-group`)

## 🔗 Related Documentation

- `../README.md`: Global project overview
- `../PROJECT-STRUCTURE.md`: Project structure
- `../shortcut/GLOBAL-MODAL-POPUP-GUIDE.md`: How to create global modals

## 📞 Support

For issues or questions:
1. Check this README first
2. Check browser Console for errors
3. Verify tracking code format
4. Test with known working tracking code

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Part of**: BiBo Project  
**Tech Stack**: Vanilla JavaScript, LocalStorage  
**External Dependency**: spx.vn tracking service
