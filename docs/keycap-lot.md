# Keycap Lot System

File: `src/lib/keycap/lotMath.ts`

## Concept

Lot = 1 lô mua chung nhiều item. Tổng vốn (totalBuyPrice + shippingCost) chia cho items theo tỷ lệ sellPrice.

## Formula

```
itemBuyPrice = totalCost * (item.sellPrice / sumSellPrice)
```

Trong đó `totalCost = lot.totalBuyPrice + lot.shippingCost`.

## Edge Cases

1. sumSellPrice = 0 (tất cả chưa biết giá bán) -> chia đều
2. Item có sellPrice = 0 -> allocated 0 buyPrice
3. Floating rounding -> item cuối nhận phần dư
4. Xoá item khỏi lot -> item thành standalone, giữ buyPrice snapshot
5. Xoá lot -> tất cả items thành standalone, giữ buyPrice snapshot
6. Sửa sellPrice 1 item -> toàn bộ lot re-allocate
7. Sửa lot.totalBuyPrice -> toàn bộ items re-allocate

## Re-allocation Timing

Gọi `reallocateAllLots()` sau MỌI mutation (add/update/delete item hoặc lot). Function này:
1. Group items theo lotId
2. Với mỗi lot: tính allocation mới
3. Items standalone (lotId=null): giữ nguyên buyPrice
4. Orphan items (lotId trỏ tới lot không tồn tại): set lotId=null, giữ buyPrice

## Integration với Expense

- Item lẻ (lotId=null): tạo expense entry riêng
- Item trong lot: KHÔNG tạo expense riêng
- Lot: tạo 1 expense entry cho cả lot (amount = totalBuyPrice + shippingCost)
