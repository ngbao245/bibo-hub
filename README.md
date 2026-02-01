# BiBo - Notes & Tasks Management App

Ứng dụng quản lý ghi chú và công việc với giao diện Microsoft To Do style, hỗ trợ rich text editing và quản lý tasks với custom lists.

## 🚀 Tính năng chính

### 📝 Notes Management
- **Rich Text Editor**: Hỗ trợ bold, italic, underline, bullet lists, numbered lists
- **Fullscreen Mode**: Chế độ toàn màn hình cho việc viết (F11 hoặc nút ⛶)
- **Window Controls**: Nút fullscreen (màu xám) và close (màu đỏ) như Windows Explorer
- **Inline Editing**: Chỉnh sửa trực tiếp title và content
- **Search**: Tìm kiếm notes theo title và content
- **Categories & Tags**: Phân loại notes theo type, language, tags
- **URLs Management**: Lưu trữ tối đa 5 URLs per note
- **Auto-save**: Tự động lưu form data khi đang chỉnh sửa

### ✅ Tasks Management (Microsoft To Do Style)
- **3-Column Layout**: Lists → Tasks → Editor (giống Microsoft To Do desktop)
- **Default View**: "My Day" thay vì "All Tasks" khi mở app
- **Auto-save Task Editor**: Không cần nút Save/Cancel, tự động lưu khi:
  - **Inputs**: Auto-save khi blur (click ra ngoài)
  - **Dropdowns**: Auto-save khi chọn option
  - **Toggle buttons**: Auto-save khi click
- **Custom Lists**: Tạo và quản lý lists tùy chỉnh với auto-naming
- **Smart Task Management**: 
  - **My Day**: Tasks có due date hôm nay + overdue + daily recurring tasks
  - **All Tasks**: Tất cả tasks
  - **Important**: Tasks có priority = high
  - **Completed**: Tasks đã hoàn thành
- **Task Features**:
  - Due date với dropdown (Today, Tomorrow, Pick a date)
  - Priority levels (High/Normal) 
  - **Daily Recurring Tasks**: Luôn xuất hiện trong My Day mỗi ngày
  - Task descriptions và URLs (tối đa 3)
- **Move Tasks**: Di chuyển tasks giữa các lists với auto-save và refresh
- **Circular Checkboxes**: Thiết kế giống Microsoft To Do
- **Context Menus**: Right-click để rename/delete lists (màu bình thường, không đỏ)
- **Inline List Editing**: Click để edit list names, auto-save khi blur/enter

### 🎨 UI/UX Features
- **Dark Theme**: Giao diện tối chuyên nghiệp với CSS variables
- **Edge-style Tabs**: Navigation tabs sát nhau không có gaps
- **Unified Design**: Cùng sidebar width (280px) và color scheme
- **Consistent Hover Colors**: Tất cả hover effects dùng #2d2d30 (var(--color-bg-elevated))
- **Smooth Animations**: Dropdown animations 0.15s ease cho consistency
- **Responsive Design**: Tương thích mobile và desktop
- **No Border Radius**: Form inputs sử dụng border-bottom only
- **Silent Operations**: Không có toast notifications khi move tasks

## 🏗️ Kiến trúc kỹ thuật

### Database Schema (MockAPI)
Sử dụng single table approach với field `type` để phân biệt:

**Notes Table:**
```json
{
  "id": "string",
  "title": "string",
  "content": "string (HTML)",
  "type": "note|vocabulary|code|course",
  "language": "vi|en",
  "source": "string",
  "tags": "string (comma-separated)",
  "example": "string",
  "url1": "string",
  "url2": "string",
  "url3": "string",
  "url4": "string", 
  "url5": "string",
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}
```

**Tasks Table (chứa cả tasks và lists):**
```json
{
  "id": "string",
  "type": "task|list",
  "title": "string",
  "name": "string", // For lists compatibility
  "description": "string", // Tasks only
  "parentId": "string", // Tasks: parent list ID, Lists: null
  "status": "pending|completed", // Tasks only
  "priority": "normal|high", // Tasks only
  "dueDate": "ISO string", // Tasks only
  "category": "string", // Tasks only
  "recurring": boolean, // Tasks only - daily recurring
  "url1": "string", // Tasks only
  "url2": "string", // Tasks only
  "url3": "string", // Tasks only
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "completedDate": "ISO string" // Tasks only
}
```

### File Structure
```
├── index.html              # Notes page
├── tasks.html             # Tasks page  
├── app.js                 # Notes logic
├── tasks.js               # Tasks logic
├── style.css              # Base styles + Notes styles
├── tasks.css              # Tasks-specific styles (extends style.css)
├── richtext-editor.js     # Rich text editor class
├── richtext-editor.css    # Rich text editor styles
├── storage.js             # LocalStorage utilities
├── config.js              # API configuration (encoded)
├── encoder.html           # API URL encoding tool
└── README.md              # Documentation
```

### API Configuration
File `config.js` chứa centralized API endpoints (encoded):
```javascript
const API_CONFIG = {
    NOTES: 'encoded_url_here',
    TASKS: 'encoded_url_here'
};
```

**Cách update API URL:**
1. Mở `encoder.html` trong browser
2. Nhập API URL mới
3. Click "Encode" 
4. Copy mã đã encode vào `config.js`

## 🎯 Key Implementation Details

### Tasks Management Architecture
- **Single Table Design**: Tasks và Lists cùng table, phân biệt bằng `type` field
- **Parent-Child Relationship**: Tasks có `parentId` trỏ đến List ID
- **Event Delegation**: Sử dụng event delegation cho task interactions
- **Optimistic UI**: Update UI trước, sync API sau
- **Auto-save**: Move tasks giữa lists tự động lưu và refresh task list
- **Smart Counts**: Custom list counts được update real-time

### My Day Logic
```javascript
case 'today':
    filtered = filtered.filter(task => 
        task.status !== 'completed' && (
            task.recurring === true ||  // Daily recurring tasks always show
            (task.dueDate && new Date(task.dueDate).toDateString() === today) ||
            isOverdue(task.dueDate)
        )
    );
```

### Rich Text Editor
- **ContentEditable**: Sử dụng contenteditable với execCommand API
- **Fullscreen Mode**: Toggle với nút ⛶/🗗 hoặc phím F11
- **Window Controls**: `.window-controls` div chứa fullscreen + close buttons
- **Toolbar State**: Dynamic update button states theo selection
- **Keyboard Shortcuts**: 
  - Ctrl+B/I/U (formatting)
  - Ctrl+S (save)
  - Escape (close)
  - F11 (toggle fullscreen)
  - Tab (insert 4 spaces)

### UI Consistency Patterns
- **Hover Colors**: Tất cả elements sử dụng `var(--color-bg-elevated)` (#2d2d30)
- **Animation Timing**: Dropdowns sử dụng `0.15s ease` cho consistency
- **Form Styling**: Không border-radius, chỉ border-bottom cho inputs
- **Navigation**: Edge-style tabs với `margin-left: -1px` để sát nhau
- **Context Menu**: Delete items có màu bình thường, không đỏ

### Performance Optimizations
- **Event Delegation**: Tránh attach nhiều event listeners
- **Debounced Search**: Search với 300ms delay
- **Optimistic UI**: Update UI trước, API sau
- **Cache Strategy**: LocalStorage cache để instant load
- **Minimal DOM Manipulation**: Batch updates khi có thể

## 🚀 Cách sử dụng

### Notes
1. **Tạo note mới**: Click "+" trong sidebar
2. **Chỉnh sửa**: 
   - Double-click title để inline edit
   - Double-click content để mở rich text editor
   - Click "Edit" để mở form mode
3. **Rich text editing**: 
   - Sử dụng toolbar hoặc keyboard shortcuts
   - Click nút ⛶ hoặc nhấn F11 để fullscreen
   - Ctrl+S để save, Escape để close
4. **Tìm kiếm**: Gõ trong search box để filter notes
5. **URLs**: Thêm tối đa 5 URLs vào mỗi note

### Tasks  
1. **Default View**: App mở với "My Day" view
2. **Tạo list**: Click "+ New list" trong sidebar
   - Lists tự động đặt tên "Untitled list", "Untitled list (1)", etc.
   - Click vào tên để edit inline, auto-save khi blur/enter
   - Right-click để rename/delete (màu bình thường)
3. **Tạo task**: Click "Add a task" ở bottom của task list
4. **Edit task**: Click vào task để mở editor bên phải
   - **Auto-save**: Không cần nút Save/Cancel
   - **Inputs**: Tự động lưu khi click ra ngoài (blur)
   - **Dropdowns**: Tự động lưu khi chọn option
   - **Toggle buttons**: Tự động lưu khi click
5. **Move task**: Trong editor, click "In list: [Name]" để chọn list khác
6. **Due date**: Click "Pick a date" để set due date với dropdown
7. **Daily Recurring**: Check để task luôn xuất hiện trong My Day
8. **Complete**: Click circular checkbox để mark complete

### My Day Logic
- **Tasks hôm nay**: Tasks có due date = today
- **Overdue tasks**: Tasks quá hạn chưa complete
- **Daily recurring tasks**: Luôn hiện mỗi ngày (bất kể due date)

## 🎨 Customization

### Theme Colors
```css
:root {
  --color-accent-primary: #007acc;    /* Màu chủ đạo */
  --color-bg-primary: #1e1e1e;        /* Màu nền chính */
  --color-bg-elevated: #2d2d30;       /* Màu hover (consistent) */
  --color-text-primary: #d4d4d4;      /* Màu chữ chính */
  --color-bg-secondary: #252526;      /* Màu nền phụ */
  --color-border: #3e3e42;            /* Màu viền */
}
```

### Animation Timing
```css
:root {
  --transition-fast: 0.15s ease;      /* Dropdowns, quick interactions */
  --transition-normal: 0.2s ease;     /* Modals, standard transitions */
  --transition-slow: 0.3s ease;       /* Complex animations */
}
```

## ⌨️ Keyboard Shortcuts

### Global
- `Escape` - Cancel/Close
- `Double Click` - Edit title hoặc content

### Rich Text Editor
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text  
- `Ctrl + U` - Underline text
- `Tab` - Insert 4 spaces
- `F11` - Toggle fullscreen
- `Ctrl + S` - Save và close
- `Escape` - Close (không save)

## 🔧 Development Notes

### LocalStorage Keys
- `notes_currentNoteId` - ID của note đang mở
- `notes_editorState` - Trạng thái editor và form data
- `notes_cachedNote` - Cache note data để instant display

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **ContentEditable**: Rich text editor requires modern browser support
- **CSS Variables**: Sử dụng CSS custom properties
- **Backdrop Filter**: Modal blur effect (có thể không support older browsers)

### Known Limitations
- **MockAPI Rate Limits**: Free tier có giới hạn requests
- **Rich Text**: Không support images, chỉ text formatting
- **Mobile UX**: Tối ưu cho desktop, mobile experience cơ bản
- **Offline**: Không có offline support (cần internet)

## 📱 Responsive Design

### Breakpoints
- **Desktop**: > 768px - Full 3-column layout
- **Tablet**: 768px - Sidebar thu gọn  
- **Mobile**: < 768px - Stack layout, always show task actions

### Mobile Optimizations
- Task actions luôn visible (không cần hover)
- Sidebar width giảm xuống 240px
- Form elements stack vertically
- Touch-friendly button sizes (min 44px)

## 🚀 Future Enhancements

### Planned Features
- **Drag & Drop**: Reorder tasks và lists
- **Keyboard Navigation**: Full keyboard support
- **Export/Import**: JSON/CSV export
- **Collaboration**: Real-time sharing
- **Offline Support**: PWA với service worker
- **Advanced Search**: Filters, date ranges
- **Themes**: Multiple color schemes
- **Attachments**: File upload support
- **Recurring Logic**: Auto-recreate completed recurring tasks

### Technical Improvements
- **TypeScript**: Type safety
- **State Management**: Centralized state (Redux/Zustand)
- **Testing**: Unit và integration tests
- **Build Process**: Webpack/Vite setup
- **API Optimization**: GraphQL hoặc optimized REST
- **Caching**: Smart caching strategies
- **Performance**: Virtual scrolling cho large lists

## 🛠️ Setup & Deployment

### Local Development
1. Clone repository
2. Mở `index.html` hoặc `tasks.html` trong browser
3. Không cần build process (vanilla JS)

### API Setup
1. Tạo MockAPI account tại mockapi.io
2. Tạo 2 tables: `notes` và `tasks`
3. Copy API URLs
4. Mở `encoder.html`, encode URLs
5. Paste vào `config.js`

### Deployment
- **Static Hosting**: Vercel, Netlify, GitHub Pages
- **No Backend Required**: Chỉ cần serve static files
- **HTTPS Required**: Để CORS với MockAPI hoạt động

## 🐛 Troubleshooting

### Common Issues
1. **"No tasks found"**: Kiểm tra My Day logic - cần tasks có due date hôm nay hoặc recurring
2. **List counts không update**: Đã fix với `updateTaskCounts()` cho custom lists
3. **New list không save**: Đã fix logic để luôn save dù tên trống
4. **Hover colors khác nhau**: Đã unify tất cả thành `#2d2d30`
5. **Animation chậm**: Đã optimize thành `0.15s ease`

### Debug Tips
- Mở browser console để xem logs
- Kiểm tra API calls trong Network tab
- Verify localStorage data
- Test với `encoder.html` nếu API issues

---

**Phiên bản**: 2.2.0  
**Cập nhật cuối**: February 2026  
**Tech Stack**: Vanilla JavaScript, MockAPI, CSS Variables  
**License**: MIT  
**Tác giả**: BiBo Development Team

## 📞 Support

Nếu gặp vấn đề hoặc có câu hỏi:
1. Kiểm tra README này trước
2. Kiểm tra browser console để debug
3. Verify API URLs trong `config.js`
4. Test với `encoder.html` nếu cần update API