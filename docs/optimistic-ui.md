
# Optimistic UI

File chính: src/lib/optimistic.ts

## Mục đích

UI update ngay khi user action, API save background. User không phải đợi network round-trip.

## Pattern

```

User action → onMutate (optimistic update cache)

↓

API call ở background

↓

success → onSettled (refetch để sync server)

error → onError (rollback cache về snapshot)

```

## Helper optimisticList()

```ts

useMutation({

mutationFn: async (input) => fetchJson(...),

...optimisticList(qc, ['tasks'], (old, input) => [...old, input]),

})

```

3 callback tự sinh:

- onMutate: cancel queries đang chạy, snapshot cache, update cache với data mới

- onError: rollback về snapshot

- onSettled: invalidate queries → refetch sync với server

## Beforeunload Warning

Khi có pending mutations (pendingCount > 0), gắn listener beforeunload. User đóng tab → browser hỏi xác nhận. Khi tất cả mutations xong → tự gỡ listener.

```ts

incrementPending() // gọi trong onMutate

decrementPending() // gọi trong onSettled

```

## Áp dụng

Tất cả mutations trong:

- api/tasks.ts — create/update/toggle/important/delete + lists

- api/notes.ts — create/update/delete

- api/movies.ts — create/update/delete

- api/expense.ts — add/update/delete

- api/savings.ts — create/update/delete (manual onMutate vì không phải list)

- api/keycap.ts — useSaveKeycap (manual vì 1 record duy nhất)

## Lưu ý

- Optimistic update tạo entry với id: 'temp_' + Date.now() — sẽ được thay bằng id thật khi server response

- Sau invalidate + refetch, temp entry bị thay bằng entry thật từ server

- Nếu API fail giữa chừng, cache rollback về snapshot ban đầu
