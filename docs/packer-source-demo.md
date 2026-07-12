# Demo: Flow Tự Động Project Packer + Source

## Máy BỊ CHẶN PROXY (Máy code)

### Bước 1: Pack project
1. Mở tool **Project Packer**
2. Chọn folder chứa file changes
3. Nhấn **Pack**
4. Đợi pack xong → giả sử output **5 parts**

### Bước 2: Nhấn "Lưu vào Source"
```
✓ Lưu part 1/5 vào database
✓ Lưu part 2/5 vào database  
✓ Lưu part 3/5 vào database
✓ Lưu part 4/5 vào database
✓ Lưu part 5/5 vào database
Toast: "Đã lưu 5 part vào Source! Vào trang Sources để download."
```

**XONG!** 5 sources được tạo với cùng pack-id.

---

## Máy KHÔNG BỊ CHẶN (Máy deploy)

### Bước 3: Mở trang Sources
1. Vào trang **Sources** (menu bên trái)
2. Thấy 5 sources mới:
   ```
   - Project Packed - 12/7/2026 10:30 (1/5)
   - Project Packed - 12/7/2026 10:30 (2/5)
   - Project Packed - 12/7/2026 10:30 (3/5)
   - Project Packed - 12/7/2026 10:30 (4/5)
   - Project Packed - 12/7/2026 10:30 (5/5)
   ```

### Bước 4: Click vào BẤT KỲ part nào
Click vào **part 3/5** (hoặc part nào cũng được)

### Bước 5: Download tự động
Button **"Download Project"** màu xanh xuất hiện ở header

Nhấn **"Download Project"** → chờ:
```
Toast 1: "Đang chuẩn bị download..."
Toast 2: "Đang tìm các parts liên quan..."
Toast 3: "Tìm thấy 5 parts, đang gộp..."
Toast 4: "Đang giải nén project..."
Toast 5: "Tìm thấy 100 file, đang tạo ZIP..."
Toast 6: "Đã tải 100 file"
→ File project-unpacked.zip tự động download về
```

### Bước 6: Giải nén
```bash
unzip project-unpacked.zip
```

**1 FILE ZIP DUY NHẤT CHỨA ĐỦ 100 FILES!**
```
src/
  components/
    Button.tsx
    Modal.tsx
  utils/
    helper.ts
package.json
```

---

## Điểm Quan Trọng

### ✅ KHÔNG cần tải 5 file ZIP riêng!

Dù pack ra **5 parts** (5 sources), nhưng khi download:
- Click vào **BẤT KỲ part nào** (1, 2, 3, 4, hay 5)
- Tự động tìm **TẤT CẢ 5 parts** cùng pack-id
- Gộp lại theo thứ tự → **1 FILE ZIP duy nhất**

### ✅ Tránh giới hạn MockAPI

Mỗi part lưu riêng → không bị reject vì request body quá lớn

### ✅ UX đơn giản

Không cần biết "phải download part 1 trước", click part nào cũng download đủ!

---

## So sánh Flow Cũ vs Mới

### ❌ Flow CŨ (thủ công):
```
Máy chặn:
1. Pack → output 5 parts
2. Copy part 1 → paste vào Unpack → download ZIP 1
3. Copy part 2 → paste vào Unpack → download ZIP 2
4. Copy part 3 → paste vào Unpack → download ZIP 3
5. Copy part 4 → paste vào Unpack → download ZIP 4
6. Copy part 5 → paste vào Unpack → download ZIP 5

Máy không chặn:
7. Upload 5 ZIP thủ công
8. Giải nén 5 ZIP riêng
9. Merge files (dễ sai thứ tự)
```

### ✅ Flow MỚI (tự động):
```
Máy chặn:
1. Pack → nhấn "Lưu vào Source" → XONG (5 sources tạo tự động)

Máy không chặn:
2. Vào Sources → click BẤT KỲ part nào
3. Nhấn "Download Project" → XONG (1 ZIP chứa đủ tất cả)
4. Giải nén 1 file ZIP
```

**Tiết kiệm:** ~15 bước thủ công → 4 bước tự động!

---

## Kỹ thuật Behind the Scenes

### Pack-ID System
```typescript
// Khi lưu:
const packId = `pack_${Date.now()}_abc123def`;

// Tất cả parts có cùng pack-id
tags: `packed, pack-id:${packId}, part:1/5`
tags: `packed, pack-id:${packId}, part:2/5`
tags: `packed, pack-id:${packId}, part:3/5`
...
```

### Auto-Group Logic
```typescript
// Khi download:
const packId = note.tags.match(/pack-id:([^\s,]+)/)?.[1];

// Tìm tất cả parts cùng pack-id
const allParts = sources.filter(s => 
  s.tags?.includes(`pack-id:${packId}`)
);

// Sort theo part number
allParts.sort(...);

// Gộp content
const merged = allParts.map(p => p.content).join('\n\n');

// Unpack → 1 ZIP
const { files } = unpackText(merged);
const blob = await buildZip(files);
```

---

## Test Case

### Pack 200 files → 10 parts
```
Máy chặn: Lưu 10 sources

Máy không chặn:
- Click part 7/10
- Tự động tìm 10 parts
- Gộp lại
- Download 1 ZIP chứa 200 files
```

### Pack 20 files → 1 part
```
Máy chặn: Lưu 1 source

Máy không chặn:
- Click source đó
- Download 1 ZIP chứa 20 files
```

Đơn giản, nhất quán, không lỗi!
