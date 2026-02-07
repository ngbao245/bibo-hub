# Global Modal Popup Guide

Hướng dẫn tạo modal có thể mở từ bất kỳ trang nào bằng keyboard shortcuts với tính năng toggle.

## 📋 Tổng quan

**Vấn đề:** Muốn mở modal (Translate, Calculator, etc.) từ bất kỳ trang nào (Notes, Tasks, Hub) mà không cần duplicate HTML.

**Giải pháp:** 
- Global shortcuts system với toggle support
- Dynamic modal loading
- Lazy initialization
- Tránh conflict với browser shortcuts (dùng Alt thay vì Ctrl)

---

## 🏗️ Cấu trúc

```
/
├── global-shortcuts.js          # Keyboard shortcuts cho tất cả trang
├── hub-shortcuts.js             # Hub-specific shortcuts (tránh duplicate)
├── shortcuts-loader.js          # Shortcuts modal loader
├── translate/
│   ├── translate-loader.js      # Load modal dynamically
│   ├── translate-modal.js       # Modal logic
│   └── translate-modal.css      # Modal styles
└── notes/
    └── notes.html               # Trang sử dụng modal
```

---

## 🔧 Cách tạo Global Modal mới

### **Bước 1: Tạo Modal Loader**

File: `your-modal/your-modal-loader.js`

```javascript
// Your Modal Loader
let yourModalLoaded = false;

async function loadYourModal() {
    if (yourModalLoaded) return;
    
    try {
        // Detect current path (notes/, tasks/, or root)
        const basePath = window.location.pathname.includes('/notes/') || 
                         window.location.pathname.includes('/tasks/') ? '../' : './';
        
        // Inject HTML directly (no fetch needed - avoids CORS)
        const html = `
            <div id="yourModal" class="modal">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <span class="modal-title">Your Modal Title</span>
                        <button onclick="closeYourModal()" class="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body">
                        <!-- Your modal content here -->
                    </div>
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = html;
        document.body.appendChild(container.firstElementChild);
        
        // Load CSS if not already loaded
        if (!document.querySelector('link[href*="your-modal.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = basePath + 'your-modal/your-modal.css';
            document.head.appendChild(link);
        }
        
        // Load JS if not already loaded - use Promise to wait
        if (typeof openYourModal === 'undefined') {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = basePath + 'your-modal/your-modal.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });
        }
        
        yourModalLoaded = true;
    } catch (error) {
        console.error('Error loading your modal:', error);
    }
}

// Lazy open function with toggle support
async function openYourModalLazy() {
    // Load modal first if not loaded
    await loadYourModal();
    
    const modal = document.getElementById('yourModal');
    
    // Toggle: if open, close it
    if (modal && modal.classList.contains('show')) {
        if (typeof closeYourModal === 'function') {
            closeYourModal();
        } else {
            modal.classList.remove('show');
        }
    } else if (modal) {
        // Otherwise open it
        if (typeof openYourModal === 'function') {
            openYourModal();
        } else {
            modal.classList.add('show');
        }
    }
}
```

**⚠️ Quan trọng:**
- Dùng `await new Promise()` để đợi script load xong
- Toggle logic: check modal có class `show` không
- Load modal trước, sau đó mới check toggle

---

### **Bước 2: Tạo Modal Logic**

File: `your-modal/your-modal.js`

```javascript
// Your Modal Logic

function openYourModal() {
    document.getElementById('yourModal').classList.add('show');
}

function closeYourModal() {
    document.getElementById('yourModal').classList.remove('show');
}

// Your modal logic here...
```

**⚠️ Lưu ý:**
- KHÔNG cần thêm event listener cho ESC hoặc click outside
- `global-shortcuts.js` đã xử lý tất cả
- Chỉ cần implement `openYourModal()` và `closeYourModal()`

---

### **Bước 3: Tạo Modal Styles**

File: `your-modal/your-modal.css`

```css
/* Your Modal Styles */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    z-index: 10000; /* High z-index to appear above other modals */
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(2px);
}

.modal.show {
    display: flex;
}

.modal-content {
    background: var(--color-bg-elevated);
    border: 1px solid var(--color-border);
    /* ... your styles ... */
}
```

**⚠️ Quan trọng:** `z-index: 10000` để modal hiện phía trên các modal khác (rich text editor có z-index: 1000)!

---

### **Bước 4: Thêm vào Shortcuts Config**

File: `shortcuts-config.js`

```javascript
const SHORTCUTS_CONFIG = {
    // Thêm shortcut mới (dùng Alt để tránh conflict với browser)
    'alt+y': { name: 'Your Modal', action: 'openYourModalLazy' },
    
    // Existing shortcuts...
    'alt+t': { name: 'Translate', action: 'openTranslateModalLazy' },
    'alt+c': { name: 'Calculator', action: 'openCalculatorModalLazy' },
    'alt+e': { name: 'Encoder', action: 'openEncoderModalLazy' },
    'alt+b': { name: 'Backup', action: 'openBackupModalLazy' },
    'alt+k': { name: 'Shortcuts', action: 'openShortcutsModalLazy' },
    'escape': { name: 'Close Modal', action: 'closeAllModals' }
};
```

**⚠️ Dùng Alt thay vì Ctrl:**
- `Ctrl+Q` → Đóng tab browser
- `Ctrl+E` → Focus address bar
- `Ctrl+B` → Bookmarks
- `Ctrl+N` → New window
- `Alt` ít conflict hơn!

**⚠️ Lợi ích của shortcuts-config.js:**
- Chỉ cần edit 1 file để thay đổi tất cả shortcuts
- `global-shortcuts.js` và `shortcuts-loader.js` đều đọc từ đây
- Dễ maintain và không duplicate

---

### **Bước 5: Load vào trang cần dùng**

File: `notes/notes.html` (hoặc trang khác)

```html
<!-- Global Modal Loaders -->
<script src="../translate/translate-loader.js"></script>
<script src="../modals/calculator-loader.js"></script>
<script src="../encoder/encoder-loader.js"></script>
<script src="../backup/backup-loader.js"></script>
<script src="../your-modal/your-modal-loader.js"></script>

<!-- Keyboard Shortcuts -->
<script src="../hub-shortcuts.js"></script>
<script src="../shortcuts-loader.js"></script>
<script src="../global-shortcuts.js"></script>
```

**Thứ tự quan trọng:**
1. Tất cả modal loaders
2. `hub-shortcuts.js` (để shortcuts modal có data)
3. `shortcuts-loader.js` (shortcuts modal loader)
4. `global-shortcuts.js` (cuối cùng - xử lý keyboard events)

---

## ✅ Checklist

- [ ] Tạo `your-modal-loader.js` với HTML embedded và toggle logic
- [ ] Tạo `your-modal.js` với open/close functions (không cần ESC/click outside handlers)
- [ ] Tạo `your-modal.css` với `z-index: 10000`
- [ ] Thêm shortcut vào `global-shortcuts.js` (dùng Alt)
- [ ] Thêm shortcut vào `hub-shortcuts.js` (để hiển thị trong shortcuts modal)
- [ ] Load loader script vào tất cả trang HTML (notes, tasks, hub)
- [ ] Test: Nhấn phím tắt lần 1 → Modal mở
- [ ] Test: Nhấn phím tắt lần 2 → Modal đóng (toggle)
- [ ] Test: Click outside → Modal đóng
- [ ] Test: ESC → Modal đóng

---

## 🎯 Ví dụ thực tế

### **Translate Modal:**
- Shortcut: `Alt+T` (toggle)
- Files: `translate/translate-loader.js`, `translate-modal.js`, `translate-modal.css`
- Function: `openTranslateModalLazy()`

### **Calculator Modal:**
- Shortcut: `Alt+C` (toggle)
- Files: `modals/calculator-loader.js`, `calculator-modal.js`, `calculator-modal.css`
- Function: `openCalculatorModalLazy()`

### **Shortcuts Modal:**
- Shortcut: `Alt+K` (toggle)
- Files: `shortcuts-loader.js`, `shortcuts-modal.css`
- Function: `openShortcutsModalLazy()`
- Hiển thị tất cả shortcuts từ `HUB_SHORTCUTS`

---

## 🐛 Troubleshooting

### **Modal không mở:**
1. Check Console có lỗi không (F12 → Console)
2. Verify loader script đã load: `typeof openYourModalLazy`
3. Check shortcut đã đăng ký: `console.log(GLOBAL_SHORTCUTS)`
4. Verify modal HTML đã được inject: `document.getElementById('yourModal')`

### **Toggle không hoạt động:**
- Verify modal có class `show` khi mở: `document.getElementById('yourModal').classList.contains('show')`
- Check có duplicate event listeners không (hub-shortcuts.js và global-shortcuts.js)
- Đảm bảo `hub-shortcuts.js` skip global shortcuts

### **Modal bị nằm phía sau:**
- Tăng `z-index` trong CSS lên `10000` hoặc cao hơn
- Rich text editor modal có `z-index: 1000`, nên modal mới cần `z-index: 10000`

### **Conflict với browser shortcuts:**
- Dùng `Alt` thay vì `Ctrl`
- Tránh: Ctrl+Q, Ctrl+E, Ctrl+B, Ctrl+N, Ctrl+T, Ctrl+P

### **Failed to fetch:**
- Đừng dùng `fetch()` để load HTML từ file riêng
- Embed HTML trực tiếp trong loader JS (như ví dụ)
- Tránh CORS issues khi mở bằng `file://` protocol

### **Path sai:**
- Dùng `basePath` detection như trong ví dụ
- Test từ nhiều trang khác nhau (notes/, tasks/, root)
- Check path trong DevTools Network tab

### **Modal được gọi 2 lần:**
- Verify `hub-shortcuts.js` có skip global shortcuts
- Check logic: `const isGlobalShortcut = typeof GLOBAL_SHORTCUTS !== 'undefined' && GLOBAL_SHORTCUTS[keyCombo];`
- Nếu `isGlobalShortcut` thì return ngay

---

## 💡 Tips

1. **Lazy loading:** Modal chỉ load khi cần (lần đầu nhấn phím tắt)
2. **Toggle support:** Nhấn lần 1 mở, lần 2 đóng
3. **No duplication:** HTML chỉ có 1 chỗ (trong loader)
4. **High z-index:** Luôn dùng `z-index: 10000` để tránh bị che
5. **Close handlers:** `global-shortcuts.js` xử lý ESC và click outside cho tất cả modal
6. **Path detection:** Dùng `window.location.pathname` để detect path
7. **Alt key:** Dùng Alt thay vì Ctrl để tránh conflict với browser
8. **Hub shortcuts:** Thêm vào `hub-shortcuts.js` để hiển thị trong shortcuts modal
9. **Test thoroughly:** Test từ nhiều trang khác nhau (notes, tasks, hub)
10. **Console is your friend:** Luôn mở Console để debug

---

## 🔍 Debug Checklist

Khi modal không hoạt động, check theo thứ tự:

1. **F12 → Console:** Có lỗi JavaScript không?
2. **Network tab:** CSS/JS files có load không?
3. **Elements tab:** Modal HTML có được inject vào DOM không?
4. **Console:** `typeof openYourModalLazy` → Phải là `"function"`
5. **Console:** `document.getElementById('yourModal')` → Phải trả về element
6. **Console:** `GLOBAL_SHORTCUTS` → Check shortcut đã đăng ký chưa
7. **Console:** `HUB_SHORTCUTS` → Check shortcut có trong hub shortcuts không
8. **Console:** Nhấn phím tắt và xem có log gì không

---

## 📚 Tham khảo

- `translate/translate-loader.js` - Ví dụ hoàn chỉnh với toggle
- `shortcuts-loader.js` - Ví dụ modal không cần separate JS file
- `global-shortcuts.js` - Keyboard shortcuts system
- `hub-shortcuts.js` - Hub shortcuts với duplicate prevention
- `translate/translate-modal.css` - Modal styling với z-index cao

---

## 🎨 Architecture Overview

```
User nhấn Alt+T
    ↓
global-shortcuts.js detect
    ↓
Call openTranslateModalLazy()
    ↓
Check modal đã load chưa?
    ├─ Chưa → Load HTML, CSS, JS
    └─ Rồi → Skip loading
    ↓
Check modal đang mở không?
    ├─ Đang mở → Close (toggle off)
    └─ Đang đóng → Open (toggle on)
    ↓
Modal hiển thị/ẩn
```

**Duplicate Prevention:**
```
User nhấn Alt+T trong hub
    ↓
hub-shortcuts.js detect
    ↓
Check: Alt+T có trong GLOBAL_SHORTCUTS?
    ├─ Có → Skip (return ngay)
    └─ Không → Execute function
    ↓
Tránh được duplicate execution
```

---

**Tạo bởi:** Kiro AI Assistant  
**Ngày:** 2026-02-07  
**Version:** 2.0 (Updated with toggle support and Alt key usage)
