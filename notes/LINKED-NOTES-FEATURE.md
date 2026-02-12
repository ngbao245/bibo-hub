# Tính năng Liên kết Notes (Linked Notes) & Child Notes

## Mô tả
Tính năng này cho phép bạn liên kết các notes với nhau và tạo "child notes" (notes con) - các note sẽ bị ẩn khỏi danh sách chính và chỉ hiển thị khi xem note cha.

## Use Case Thực Tế

### Ví dụ: IELTS Writing với bài sửa

1. **Note cha**: "IELTS Writing Task 2 - Technology"
   - Nội dung: Bài writing gốc của bạn
   - Type: IELTS

2. **Child notes** (bị ẩn khỏi danh sách):
   - "Correction 1 - Grammar" (sửa lỗi ngữ pháp)
   - "Correction 2 - Vocabulary" (sửa từ vựng)
   - "Teacher Feedback" (nhận xét của giáo viên)

**Lợi ích**: 
- Danh sách notes bên trái chỉ hiển thị bài writing chính
- Các bài sửa không làm rối danh sách
- Khi xem bài writing, click vào linked notes để xem các bài sửa

## Cách sử dụng

### 1. Tạo Child Note mới (Cách nhanh)

1. Mở note cha (ví dụ: bài writing)
2. Click "Edit"
3. Cuộn xuống phần "Linked Notes (Child Notes)"
4. Click nút "+ Create New Child Note"
5. Nhập tên cho child note (ví dụ: "Correction - 12/02/2026")
6. Child note sẽ được tạo và tự động link vào note cha
7. Click "Save" để lưu note cha
8. Click vào child note trong danh sách linked notes để chỉnh sửa

### 2. Link note hiện có vào note cha

1. Mở note cha
2. Click "Edit"
3. Cuộn xuống phần "Linked Notes (Child Notes)"
4. Click "Select Linked Notes (0)"
5. Trong modal:
   - Tìm kiếm notes (bao gồm cả child notes)
   - Child notes có icon 📄 và badge "Child Note"
   - Click để chọn/bỏ chọn
6. Click "Done"
7. Click "Save"

### 3. Xem Linked Notes & Child Notes

Khi xem note cha:
- Phần "Linked Notes" hiển thị tất cả notes liên kết
- Child notes có icon 📄 và badge "Child"
- Click vào bất kỳ note nào để mở

### 4. Điều hướng

- Click vào linked note/child note để xem
- Child notes có thể được xem và chỉnh sửa bình thường
- Child notes KHÔNG hiển thị trong danh sách notes bên trái

## Cấu trúc dữ liệu

### Note cha
```javascript
{
  id: "note-123",
  title: "IELTS Writing Task 2 - Technology",
  content: "...",
  type: "ielts",
  linkedNotes: ["child-456", "child-789"], // Array of child note IDs
  // ... other fields
}
```

### Child Note
```javascript
{
  id: "child-456",
  title: "Correction - Grammar",
  content: "...",
  type: "ielts",
  isChildNote: true,           // ✅ Đánh dấu là child note
  parentNoteId: "note-123",    // Reference đến note cha
  linkedNotes: [],
  // ... other fields
}
```

## Tính năng kỹ thuật

- **Auto-hide**: Child notes (có `isChildNote: true`) tự động bị ẩn khỏi danh sách
- **Quick create**: Tạo child note nhanh với nút "+ Create New Child Note"
- **Search**: Tìm kiếm cả regular notes và child notes trong modal
- **Visual indicators**: Icon 📄 và badge "Child" để phân biệt
- **Bidirectional reference**: Child note có `parentNoteId`, parent có `linkedNotes`

## Lưu ý

- Child notes chỉ bị ẩn khỏi danh sách, vẫn có thể xem/edit bình thường
- Một note cha có thể có nhiều child notes
- Child notes có thể có type khác note cha
- Xóa note cha không tự động xóa child notes
- Child notes có thể được link vào nhiều note cha khác
