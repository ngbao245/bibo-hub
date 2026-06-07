# Cache Inspector

Files:
- `src/modals/CacheInspector.tsx` — modal wrapper với 2 tabs
- `src/components/cache/QueryCacheTab.tsx` — view/refetch/remove TanStack Query
- `src/components/cache/LocalStorageTab.tsx` — view/edit/delete localStorage
- `src/lib/cacheInspect.ts` — helpers (list entries, format bytes)

## Mục đích

Debug + cho user clear khi gặp lỗi cache.

## Phím tắt

`Alt + I`

## Tabs

### Query Cache

List tất cả TanStack Query entries:
- queryKey (JSON string)
- status: success / pending / error
- fetchStatus: idle / fetching / paused
- size (bytes)
- last fetch time

Actions per row:
- Expand → xem JSON data
- Refetch (invalidate)
- Remove (xoá khỏi cache)

Bulk: Clear all queries.

### LocalStorage

List tất cả keys:
- key
- size + preview text

Actions per row:
- Expand → xem formatted JSON
- Edit (textarea, validate JSON khi save)
- Delete

Bulk: Clear all keys.

## Top header

- Cảnh báo trước khi xoá
- Refresh — reload data trong modal (không reload trang)
- Clear All + Reload — xoá Query + LocalStorage rồi reload trang

## Lưu ý

- Edit JSON: nếu raw value là JSON valid thì save phải parse được, không sẽ báo lỗi
- Refetch dùng `invalidateQueries` — TanStack Query tự refetch background
- Clear All KHÔNG xoá session cookies hay browser cache (chỉ JS-accessible storage)
