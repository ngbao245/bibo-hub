README.md

# Share Notes

Ứng dụng ghi chú học tập với giao diện giống Notepad++, sử dụng MockAPI để lưu trữ dữ liệu.

## Tổng quan

Single-page application (SPA) được xây dựng bằng Vanilla JavaScript, không sử dụng framework. App có giao diện 2 panel (sidebar + editor) với theme tối giống VS Code, hỗ trợ tạo/sửa/xóa ghi chú, tìm kiếm, và lưu trạng thái vào localStorage để tiếp tục làm việc sau khi refresh.

## API Configuration

**MockAPI Endpoint:** Encoded trong code (xem encoder.html để update)

### Cách update API URL

1. Mở file `encoder.html` trong browser
2. Nhập API URL mới
3. Click "Encode"
4. Copy đoạn mã đã encode
5. Paste vào `config.js` thay thế giá trị `ENCODED` trong object `API_CONFIG`

### Tables

#### 1. `notes` table
- `id` - auto-generated
- `title` - tiêu đề ghi chú
- `content` - nội dung chi tiết
- `type` - loại (note, vocabulary, code, course)
- `language` - ngôn ngữ (vi, en)
- `source` - nguồn (Udemy, YouTube, Book...)
- `tags` - từ khóa (phân cách bằng dấu phẩy)
- `example` - ví dụ minh họa
- `url1` - link tài liệu 1
- `url2` - link tài liệu 2
- `url3` - link tài liệu 3
- `url4` - link tài liệu 4
- `url5` - link tài liệu 5
- `createdAt` - datetime
- `updatedAt` - datetime

#### 2. `tags` table
- `id` - auto-generated
- `name` - tên tag
- `color` - màu sắc
- `count` - số lượng notes
- `createdAt` - datetime

## Tính năng

- ✅ Tạo/sửa/xóa ghi chú
- ✅ Tìm kiếm theo tiêu đề và nội dung
- ✅ Giao diện 2 panel: sidebar (danh sách) + editor (xem/sửa)
- ✅ Theme tối giống code editor
- ✅ Hỗ trợ 5 URL để đính kèm tài liệu
- ✅ Phân loại theo type, language, tags
- ✅ Keyboard shortcuts
- ✅ LocalStorage - Lưu trạng thái note đang mở và form đang edit
- ✅ Inline editing - Double click để edit title
- ✅ Rich Text Editor - contenteditable với toolbar (Bold, Italic, Underline, Lists)
- ✅ Auto-save form data khi đang edit
- ✅ CSS Variables - Dễ dàng customize theme
- ✅ API Encoding - Mã hóa API URL trong code

## Keyboard Shortcuts

### Global
- `Ctrl + S` - Lưu note (khi đang edit form)
- `Esc` - Hủy edit
- `Double Click` - Edit title (ở header) hoặc content (mở rich text editor)

### Rich Text Editor (Modal)
- `Ctrl + B` - Bold text
- `Ctrl + I` - Italic text
- `Ctrl + U` - Underline text
- `Tab` - Insert 4 spaces
- `Ctrl + S` - Save và đóng editor
- `Esc` - Đóng editor (không save)

## Cách sử dụng

1. Mở file `index.html` trong trình duyệt
2. Click nút `+` để tạo note mới
3. Click vào note trong sidebar để xem
4. Click `Edit` để sửa note (form mode)
5. Double click vào title để edit nhanh
6. Double click vào content để mở Rich Text Editor
7. Trong Rich Text Editor:
   - Dùng toolbar hoặc Ctrl+B/I/U để format text
   - Click nút "• List" hoặc "1. List" để tạo danh sách
   - Tab để insert spaces
   - Phải click Save/Cancel hoặc Esc để đóng (không đóng khi click outside)
8. Nhập URL vào các trường url1-url5 để đính kèm tài liệu
9. Tắt tab và mở lại - note đang xem sẽ tự động hiển thị

## Files

- `index.html` - giao diện chính
- `config.js` - cấu hình API chung cho tất cả tính năng (có mã hóa API)
- `app.js` - logic xử lý chính
- `storage.js` - quản lý localStorage (lưu trạng thái)
- `richtext-editor.js` - Rich Text Editor class với contenteditable
- `richtext-editor.css` - Styles cho rich text editor
- `style.css` - theme với CSS variables
- `encoder.html` - tool để mã hóa API URL (không cần deploy, chỉ dùng local)
- `README.md` - tài liệu này

## Tech Stack

- Vanilla JavaScript (no framework)
- MockAPI (CRUD operations với REST API)
- CSS Variables (theme customization)
- LocalStorage (state persistence + cache)
- contenteditable API (rich text editing)
- document.execCommand (text formatting - deprecated nhưng vẫn work)

## LocalStorage Keys

- `notes_currentNoteId` - ID của note đang mở
- `notes_editorState` - Trạng thái editor và form data khi đang edit
- `notes_cachedNote` - Cache note data để hiển thị ngay khi refresh (không cần đợi API)

## CSS Variables

Có thể customize theme bằng cách thay đổi CSS variables trong `:root`:
- `--color-accent-primary` - Màu chủ đạo (#007acc)
- `--color-bg-primary` - Màu nền chính (#1e1e1e)
- `--color-text-primary` - Màu chữ chính (#d4d4d4)
- Và nhiều biến khác...

## Kiến trúc & Flow

### Init Flow
1. **Instant Load**: Restore state từ localStorage cache ngay lập tức (không đợi API)
2. **Background Sync**: Fetch notes từ MockAPI
3. **Update**: Cập nhật UI với data mới nhất từ API

### State Management
- **Optimistic UI**: Update UI ngay lập tức, sync API ở background
- **Cache Strategy**: LocalStorage cache note data để instant display khi refresh
- **Auto-save**: Form data tự động lưu vào localStorage khi đang edit

### Performance
- **Debounced Search**: 300ms delay để tránh search quá nhiều lần
- **Smooth Animations**: CSS transitions với will-change optimization
- **Lazy Rendering**: Chỉ render filtered notes, không render toàn bộ

## Technical Details

### API Integration
- **MockAPI**: REST API với CRUD operations
- **Error Handling**: Try-catch với fallback UI
- **Optimistic Updates**: UI update trước, API call sau

### Storage Strategy
- **Cache-First**: Hiển thị cached data ngay, update sau
- **State Persistence**: Lưu currentNoteId, editorState, cachedNote
- **Auto-save**: Form fields auto-save mỗi khi input change

### UI/UX Features
- **Inline Editing**: Double-click title để edit nhanh (inline input)
- **Rich Text Editor**: Double-click content để mở modal editor với toolbar
- **Modal Behavior**: Rich text modal KHÔNG đóng khi click outside (phải click Save/Cancel/X hoặc Esc)
- **Keyboard Shortcuts**: Ctrl+B/I/U (format), Ctrl+S (save), Esc (cancel)
- **Responsive**: Sidebar collapse trên mobile
- **Toolbar State**: Buttons highlight khi cursor ở text có format đó

## Notes

- Ứng dụng lưu trữ dữ liệu trên MockAPI (miễn phí, tối đa 2 tables)
- Không cần backend hay database riêng
- Có thể truy cập từ bất kỳ đâu có internet
- LocalStorage lưu trạng thái để tiếp tục làm việc sau khi tắt tab
- Instant load khi refresh nhờ cache strategy
- Content được lưu dưới dạng HTML (rich text) trong database
- Rich text editor KHÔNG có indent/outdent (đã bỏ vì UX phức tạp)
- API URL được encode trong config.js để bảo mật (dùng encoder.html để update)
