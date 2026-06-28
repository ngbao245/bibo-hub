d# Expense Integration

File: `src/lib/keycap/expenseSync.ts`

## Flow

Keycap thêm/sửa item hoặc lot → tự động tạo/update expense entry.

## Rules

| Action | Expense |
|---|---|
| Thêm item lẻ (lotId=null, buyPrice>0) | Tạo entry `{category:'keycap', amount: buyPrice+shipping}` |
| Thêm lot (totalBuyPrice>0) | Tạo entry `{category:'keycap', amount: total+shipping}` |
| Sửa buyPrice item lẻ | Update entry tương ứng |
| Sửa totalBuyPrice lot | Update entry lot |
| Xoá item/lot | KHÔNG xoá expense (tiền đã chi) |
| Mark sold (actualPrice) | KHÔNG tạo income entry |

## Linking

Expense entries có field `meta`:
```ts
{ meta: { keycapItemId: 'kc_123' } }  // item lẻ
{ meta: { keycapLotId: 'lot_456' } }   // lot
```

Entry ID convention: `exp_kc_item_{itemId}` hoặc `exp_kc_lot_{lotId}`.

## Expense Categories

10 categories. `keycap` là category riêng (icon ⌨️, màu #7e57c2).

Auto-detect từ chat input: keyword "keycap", "switch", "keyboard", "gmk"... → category `keycap`.

## Money Parser

File: `src/lib/moneyParse.ts`

| Input | Output |
|---|---|
| "35k" | 35000 |
| "1.5tr" | 1500000 |
| "150" | 150 |
| "150.000" | 150000 |
| "800k" | 800000 |
| "?" | 0 (special: sellPrice unknown) |

## Expense Chat Parser

File: `src/lib/expenseParser.ts`

Parse "cà phê 35k" → `{name: "cà phê", amount: 35000, category: "food"}`.

Logic:
1. Regex tách số cuối → amount
2. Phần còn lại → name
3. Normalize name (bỏ dấu Vietnamese) → match keywords → category
4. Số 1-3 chữ số không suffix → ×1000 (vd "50" = 50000)