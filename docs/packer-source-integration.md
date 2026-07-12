# Tích hợp Project Packer với Source Management

## Vấn đề

Khi code trên máy bị chặn proxy upload, workflow hiện tại rất mệt:
1. Đưa file change vào folder
2. Dùng Project Packer sinh nhiều script nhỏ
3. **Phải làm tay:** paste từng script vào Unpack panel, download từng file ZIP riêng
4. Giải nén từng ZIP trên máy không bị chặn

## Giải pháp

### 1. Pack → Lưu vào Source (tự động, mỗi part = 1 source)

Khi pack xong, thay vì download thủ công:
- Nhấn button **"Lưu vào Source"**
- **Mỗi part được lưu thành 1 source riêng** (tránh vượt giới hạn MockAPI)
- Tất cả parts có cùng `pack-id` để sau này group lại
- Tags: `packed, pack-id:xxx, part:1/3, Y files`

### 2. Source → Download Project (tự động gộp parts)

Khi vào trang Sources:
- Click vào **BẤT KỲ part nào** của pack
- Button **"Download Project"** tự động:
  1. Detect `pack-id` từ tags
  2. Fetch tất cả parts cùng `pack-id`
  3. Sort theo thứ tự `part:X/Y`
  4. Gộp content của tất cả parts
  5. Unpack → tạo ZIP với cấu trúc folder nguyên vẹn
  6. Download 1 file ZIP duy nhất

## Flow mới

```
Máy bị chặn:
1. Chọn files changed → Pack (output 5 parts)
2. Nhấn "Lưu vào Source" → lưu 5 sources vào database
   - Project Packed (1/5) - pack-id:abc123
   - Project Packed (2/5) - pack-id:abc123
   - Project Packed (3/5) - pack-id:abc123
   - Project Packed (4/5) - pack-id:abc123
   - Project Packed (5/5) - pack-id:abc123

Máy không bị chặn:
3. Vào trang Sources
4. Click vào BẤT KỲ part nào (ví dụ part 3/5)
5. Nhấn "Download Project" → tự động:
   - Tìm 5 parts cùng pack-id:abc123
   - Gộp content theo thứ tự
   - Tạo 1 file ZIP duy nhất
6. Giải nén → xong!
```

## Kỹ thuật

### Lưu Parts (Pack Panel)

**Mỗi part = 1 source riêng:**
```typescript
const packId = `pack_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

for (let i = 0; i < parts.length; i++) {
  await fetchJson(API.NOTES, {
    method: 'POST',
    body: JSON.stringify({
      type: 'source',
      title: `${baseTitle} (${i + 1}/${parts.length})`,
      content: parts[i].content,  // Mỗi part riêng
      tags: `packed, pack-id:${packId}, part:${i + 1}/${parts.length}`,
      source: 'project-packer',
    })
  });
}
```

### Gộp Parts (Source Editor)

**Tự động tìm và gộp:**
```typescript
// 1. Extract pack-id từ tags
const packId = note.tags.match(/pack-id:([^\s,]+)/)?.[1];

// 2. Fetch tất cả sources cùng pack-id
const samePack = allSources.filter(
  s => s.tags?.includes(`pack-id:${packId}`)
);

// 3. Sort theo part number
samePack.sort((a, b) => {
  const aNum = parseInt(a.tags.match(/part:(\d+)/)?.[1] || '0');
  const bNum = parseInt(b.tags.match(/part:(\d+)/)?.[1] || '0');
  return aNum - bNum;
});

// 4. Gộp content
const merged = samePack.map(s => s.content).join('\n\n');

// 5. Unpack → ZIP
const { files } = unpackText(merged);
const blob = await buildZip(files);
downloadBlob(blob, 'project.zip');
```

## Ưu điểm

- **Tránh giới hạn MockAPI:** mỗi part lưu riêng, không bị reject vì quá lớn
- **Click bất kỳ part nào:** không cần phải tìm "part 1", click part nào cũng download đủ
- **Tự động gộp:** logic tự tìm và sắp xếp đúng thứ tự
- **1 file ZIP duy nhất:** dù có 10 parts, cuối cùng chỉ download 1 ZIP
- **Giữ cấu trúc folder:** unpack.ts xử lý path hierarchy

## Lịch sử Packs

Mỗi lần pack tạo nhiều sources với cùng timestamp + pack-id:
```
Sources List:
- Project Packed - 12/7/2026 10:30 (1/5) - pack-id:abc123
- Project Packed - 12/7/2026 10:30 (2/5) - pack-id:abc123
- Project Packed - 12/7/2026 10:30 (3/5) - pack-id:abc123
- Project Packed - 12/7/2026 10:30 (4/5) - pack-id:abc123
- Project Packed - 12/7/2026 10:30 (5/5) - pack-id:abc123
```

Click vào bất kỳ cái nào → download đủ 5 parts gộp lại.

## Files thay đổi

- `src/components/packer/PackPanel.tsx` - lưu từng part riêng với pack-id
- `src/components/sources/SourceEditor.tsx` - tự động group và gộp parts theo pack-id

