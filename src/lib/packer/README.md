# `lib/packer/` — Project Packer Logic

Pack folder → text/zip để paste qua chat. Unpack ngược lại.

## Doc

**[docs/project-packer.md](../../../docs/project-packer.md)** — full format spec + thuật toán. Đọc trước khi sửa.

## File

| File | Mô tả |
|---|---|
| `types.ts` | `PackedFile`, `PackOptions`, ... |
| `format.ts` | Encode / decode format (delimiter, header, chunk merge...). |
| `filter.ts` | Rule lọc file kiểu gitignore. |
| `presets.ts` | Config mặc định cho từng loại project (React, Node...). |
| `pack.ts` | Folder → packed text. Tự chunk file lớn trong whitelist. |
| `unpack.ts` | Packed text → folder ZIP. |
| `analyze.ts` | Phân tích cây file (đếm, sort theo size...). |

## Large-file chunking (package-lock.json)

`package-lock.json` thường vài MB → vượt `MAX_FILE_SIZE` 200KB hoặc `maxCharsPerPart` 50K → trước đây bị skip / không pack được.

Giờ flow:

1. `readFiles` nâng giới hạn lên `WHITELIST_MAX_SIZE` (50MB) cho file basename nằm trong `LARGE_FILE_WHITELIST` (hiện chỉ `package-lock.json`).
2. `packFiles` thấy file whitelist quá lớn → cắt thành N chunks (mỗi chunk ~85% maxCharsPerPart) qua `chunkLargeFile`.
3. Mỗi chunk serialize thành 1 block riêng có thêm dòng `CHUNK: i/N` giữa `PATH:` và `CONTENT_START:`.
4. `parsePackedContent` thấy nhiều block trùng path có `CHUNK:` → gom theo `i`, sort, concat content → 1 `PackedFile` duy nhất.

Format vẫn backward compat: file thường không có `CHUNK:` line → parser cũ + mới đều đọc đúng.

Khi cần whitelist thêm file (vd `yarn.lock`):
- Thêm basename vào `CHUNKABLE_BASENAMES` (pack.ts) + `LARGE_FILE_WHITELIST` (pack.ts read guard).
- Cập nhật `COMMON_EXCLUDES` ở `presets.ts` để không bị filter mặc định.

## Lưu ý

- Format phải sống sót qua copy-paste / chat (escape ký tự đặc biệt).
- Heavy work: caller bọc `setBusyMessage(...) + await setTimeout(0)` để yield render.