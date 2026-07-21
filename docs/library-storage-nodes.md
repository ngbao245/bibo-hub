# Library Storage Pool — Multi-Node Architecture

Hệ thống mở rộng capacity bằng cách phân tán file PDF/cover qua nhiều Supabase project (storage nodes), thay vì chỉ dùng 1 Core project.

## Concepts

| Term | Description |
|---|---|
| **Storage Node** | 1 Supabase project cung cấp Storage bucket, cấu hình qua `service_credentials` table |
| **Core (Legacy)** | Supabase project gốc (`VITE_SUPABASE_URL`). File cũ chưa migrate nằm ở đây |
| **Best-fit allocation** | Chọn node active có remaining nhỏ nhất mà vẫn fit file size |
| **Usage tracking** | Cập nhật `storage_used_bytes` trên `service_credentials` row sau mỗi upload/delete |

## Node Resolution

Source: `src/tools/library-storage-pool/lib/pool.ts`

1. Query `tool_service_bindings` lấy profile_id cho `tool_code=library`, `capability=storage.files`.
2. Query `service_credentials` theo profile_id, filter status `active`/`disabled`.
3. Parse thành `StorageNode[]` — chứa URL, keys, bucket name, capacity/used.

Nếu không có node nào (user chưa config) -> mọi flow fallback về Core.

## Upload Flow (Upload + Replace)

Source: `src/api/library/books.ts` — `prepareAndUploadBook()`

1. File qua compress (nếu eligible) -> extract cover -> sẵn sàng upload.
2. `loadStorageNodes()` -> nếu có nodes:
   - `pickNodeOrThrow(nodes, file.size)` -> chọn best-fit.
   - Nếu throw `StoragePoolFullError` -> propagate lên UI ("hết dung luong, thêm node").
3. Upload PDF + cover lên node được chọn (dùng `service_role_key` qua `getUploadClient`).
4. INSERT/UPDATE DB row voi `storage_node_id = node.id`.
5. `updateUsage(node.id, +fileSize)` — best-effort, không throw.

### Replace-specific rules

- File mới upload lên node mới (re-pick best-fit, có thể khác node cũ).
- Row update: `storage_node_id` trỏ về node mới.
- Usage tracking cross-node: `+fileSize` ở node mới, `-oldFileSize` ở node cũ (nếu `book.storage_node_id` + `book.file_size_bytes` tồn tại).
- Cleanup file cũ: resolve node cũ qua `book.storage_node_id`, dùng client riêng để xoá.

## Read Flow (Signed URL)

Source: `src/api/library/books.ts` — `getBookFileUrl()`

1. Nếu `book.storage_node_id` exists -> load nodes, tìm node, dùng `getReadClient(node)` (anon_key) tạo signed URL.
2. Nếu null -> legacy Core signed URL.

## Delete Flow

Source: `src/api/library/books.ts` — `useDeleteBook()`

1. Nếu `book.storage_node_id` -> load node, xoá files qua `getUploadClient`.
2. `updateUsage(node.id, -file_size_bytes)` — best-effort.
3. Nếu null -> legacy Core delete.
4. Xoá DB row + evict IndexedDB blob cache.

## Rollback (DB insert/update fail)

Cả upload lẫn replace: nếu DB step fail sau khi file đã lên Storage:

- Nếu có `storageNode` -> dùng `getUploadClient(storageNode)` xoá file + cover mới upload.
- Nếu null (legacy Core) -> xoá qua Core client.

Purpose: không để file rác trên Storage khi DB không consistent.

## Client Caching

`pool.ts` cache Supabase clients theo `Map<string, SupabaseClient>`:
- Key `upload:{nodeId}` -> service_role_key client (upload/delete).
- Key `read:{nodeId}` -> anon_key client (signed URL).
- `clearClientCache()` khi node config thay đổi.

## Error Handling

| Case | Behavior |
|---|---|
| `loadStorageNodes()` network fail | Fallback to Core (silent, không throw) |
| No node fits file size | Throw `StoragePoolFullError` -> UI hiển thị thông báo |
| `updateUsage()` fail | Silent catch — usage tracking là best-effort |
| Node disabled | Không được pick bởi `pickNode` (filter `status=active`) |

## DB Schema

Relevant columns on `books` table:
- `storage_node_id` (uuid, nullable) — FK tới `service_credentials.id`. Null = legacy Core.
- `file_size_bytes` (bigint, nullable) — dùng cho usage tracking khi delete/replace.

Relevant on `service_credentials`:
- `storage_capacity_bytes` — tổng dung lượng node.
- `storage_used_bytes` — đã dùng, cập nhật qua `updateUsage()`.