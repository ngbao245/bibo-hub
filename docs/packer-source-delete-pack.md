# Xóa Pack - Tự động xóa tất cả parts

## Tính năng

Khi xem 1 source từ Project Packer, nút **"Xoá"** tự động upgrade thành **"Xoá Pack"** và xóa tất cả parts cùng lúc.

## UX

### Source thường (không phải packed):
```
Button: "Xoá"
Action: Xóa source này thôi
```

### Packed project (có pack-id):
```
Button: "Xoá Pack"  
Action: Xóa TẤT CẢ parts cùng pack-id
```

## Demo

### Tình huống: Pack ra 5 parts

```
Sources List:
- Project Packed (1/5) - pack-id:abc123
- Project Packed (2/5) - pack-id:abc123
- Project Packed (3/5) - pack-id:abc123
- Project Packed (4/5) - pack-id:abc123
- Project Packed (5/5) - pack-id:abc123
```

### Flow xóa CŨ (thủ công):
1. Click vào part 1 → Xoá
2. Click vào part 2 → Xoá
3. Click vào part 3 → Xoá
4. Click vào part 4 → Xoá
5. Click vào part 5 → Xoá

**5 lần click!**

### Flow xóa MỚI (tự động):
1. Click vào **BẤT KỲ part nào** (ví dụ part 3)
2. Nhấn **"Xoá Pack"**
3. Confirm dialog hiện:
   ```
   Xóa tất cả 5 parts của pack này?
   
   - Project Packed (1/5)
   - Project Packed (2/5)
   - Project Packed (3/5)
   - Project Packed (4/5)
   - Project Packed (5/5)
   ```
4. OK → **TẤT CẢ 5 parts bị xóa**

**1 lần click!**

## Logic

```typescript
async function handleDeletePack() {
  // 1. Nếu không phải packed project → xóa thường
  if (!isPackedProject || !packId) {
    return handleDelete();
  }
  
  // 2. Fetch tất cả sources cùng pack-id
  const samePack = allSources.filter(
    s => s.tags?.includes(`pack-id:${packId}`)
  );
  
  // 3. Confirm với danh sách đầy đủ
  const confirmMsg = `Xóa tất cả ${samePack.length} parts của pack này?\n\n${
    samePack.map(s => s.title).join('\n')
  }`;
  
  if (!window.confirm(confirmMsg)) return;
  
  // 4. Xóa tất cả parts
  for (const part of samePack) {
    await fetchJson(`${API.NOTES}/${part.id}`, { method: 'DELETE' });
  }
  
  toast.success(`Đã xóa ${samePack.length} parts`);
  onDeleted();
}
```

## Button Label

Button tự động thay đổi text dựa vào context:

```typescript
<Button onClick={handleDeletePack}>
  <Trash2 />
  {isPackedProject && packId ? 'Xoá Pack' : 'Xoá'}
</Button>
```

- Source thường: "Xoá"
- Packed project: "Xoá Pack"

## Confirm Dialog

### Single part hoặc source thường:
```
Delete source "My Source"?
```

### Multiple parts:
```
Xóa tất cả 5 parts của pack này?

- Project Packed (1/5)
- Project Packed (2/5)
- Project Packed (3/5)
- Project Packed (4/5)
- Project Packed (5/5)
```

## Error Handling

Nếu 1 part bị lỗi khi xóa → continue xóa các parts còn lại:

```typescript
let deleted = 0;
for (const part of samePack) {
  try {
    await delete(part);
    deleted++;
  } catch {
    // Continue với parts còn lại
  }
}

toast.success(`Đã xóa ${deleted}/${samePack.length} parts`);
```

## Edge Cases

### 1. Pack chỉ có 1 part:
- Button vẫn là "Xoá Pack" (consistent)
- Confirm dialog: "Delete source..." (như xóa thường)

### 2. Không có pack-id (source cũ):
- Fallback về `handleDelete()` thường
- Button: "Xoá"

### 3. Một số parts đã bị xóa thủ công trước:
- Xóa các parts còn lại
- Toast: "Đã xóa X/Y parts" (X < Y)

## Files thay đổi

- `src/components/sources/SourceEditor.tsx`:
  - Thêm `handleDeletePack()`
  - Button "Xoá" → `onClick={handleDeletePack}`
  - Dynamic label: "Xoá Pack" vs "Xoá"
