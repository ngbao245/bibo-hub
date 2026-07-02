# Focus Algorithm

File: `src/lib/focus.ts`

## Mục đích

Chọn tasks và notes đáng hiển thị trên Focus Layer (HubPro) để user thấy ngay việc cần làm.

## Tasks: Score-based

Mỗi task pending được tính score. Score > 0 → hiện. Sort giảm dần.

### Bảng score

| Điều kiện | Score | Ghi chú |
|---|---|---|
| Quá hạn (dueDate < today) | +100 | Ưu tiên cao nhất |
| Due hôm nay | +80 | |
| Mới tạo hôm nay (createdAt = today, không có dueDate) | +60 | Fallback cho task không có due |
| Due ngày mai | +50 | |
| Recurring (lặp hàng ngày) | +40 | Luôn có giá trị |
| Due trong 3 ngày | +30 | |
| Priority high | +20 | Cộng thêm vào các điều kiện khác |
| Không match gì | 0 | Không hiện |

Score cộng dồn: task recurring + priority high + due today = 40 + 20 + 80 = 140.

### Fallback

Nếu sau khi tính score KHÔNG có task nào > 0 (vd timezone issue, dueDate format lạ), lấy N task pending mới nhất (sort createdAt desc). Đảm bảo luôn hiện gì đó nếu có task pending.

### Edge cases

- **dueDate null** + **createdAt hôm nay** → score 60 (task vừa tạo, đáng focus)
- **dueDate null** + **createdAt cũ** + **không recurring** + **không high priority** → score 0 (bỏ qua)
- **status = "completed"** → score -1 (loại ngay)

## Notes: Recent-based

Đơn giản: lấy N note type="note" sort theo `updatedAt` desc.

Không dùng score. Chỉ hiện note thường (không hiện secret/source/savings/movie...).

## Date comparison

```ts
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0); // LOCAL timezone
  return d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}
```

**Lưu ý timezone**: `setHours(0,0,0,0)` dùng local timezone. `new Date(isoString)` parse UTC → convert local. Nếu user ở UTC+7 và dueDate là "2026-06-04T16:59:59.999Z" (= local 23:59 Jun 4) → startOfDay = Jun 4 00:00 local → daysBetween = 0 (today). Đúng.

## Config

- Focus tasks limit: default **5** (top 5 task đáng focus nhất)
- Focus notes limit: default **3** (3 note gần nhất)
- Limit là parameter của `getFocusTasks(tasks, limit)` / `getFocusNotes(notes, limit)`. Caller (`FocusLayer`) truyền explicit `5`/`3`. Muốn configurable UI thì đổi ở caller, không đụng `focus.ts`.

## formatDueDate helper

Output format cho UI:

| Condition | Label | Tone |
|---|---|---|
| days < 0 | "Quá hạn X ngày" | overdue (red) |
| days = 0 | "Hôm nay" | today (blue) |
| days = 1 | "Ngày mai" | soon |
| days ≤ 7 | "Còn X ngày" | soon |
| days > 7 | "dd/MM" | normal (gray) |