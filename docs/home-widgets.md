# Home Widgets — Developer Guide

Widget system embedded trên HubPro homepage. User add/remove widget qua menu, config persist Supabase `app_settings`.

## Architecture

```
src/tools/home-widgets/
  types.ts           — WidgetDefinition interface + UserWidgetConfig
  registry.ts        — WIDGET_REGISTRY array (source of truth cho available widgets)
  store.ts           — Zustand store (activeWidgets state)
  api.ts             — Load/save config via Supabase app_settings
  components/
    WidgetArea.tsx   — Container render trên HubPro
    WidgetWrapper.tsx— Shared chrome (header + remove button) wrap mỗi widget
    AddWidgetMenu.tsx— Dropdown menu thêm widget
  widgets/
    DailyReminderWidget.tsx
    FocusWidget.tsx
```

## Tạo widget mới — 3 bước

### Bước 1: Tạo component

File: `src/tools/home-widgets/widgets/{WidgetName}Widget.tsx`

```tsx
// ============================================================
// {Widget Name} Widget — {mô tả ngắn}
// ============================================================

export default function {WidgetName}Widget() {
  // Logic + UI ở đây

  return (
    <div>
      {/* Widget content */}
    </div>
  );
}
```

Rules:
- Export default (bắt buộc — registry import trực tiếp component).
- Widget nhận KHÔNG props — data tự fetch bên trong (hooks, store, query).
- Loading state: dùng `<Skeleton />` match footprint (xem `ui-patterns.md`).
- Empty state: text muted ngắn gọn, không cần `<EmptyState />` full vì widget nhỏ.
- Theme: token-based (`bg-card`, `text-foreground`, `border-border`), không hard-code color.

### Bước 2: Register vào registry

File: `src/tools/home-widgets/registry.ts`

```tsx
import { YourIcon } from 'lucide-react';
import YourWidget from './widgets/YourWidget';

// Thêm entry vào WIDGET_REGISTRY:
{
  id: 'your-widget-id',        // kebab-case, unique
  label: 'Tên hiển thị',
  description: 'Mô tả ngắn cho menu chọn widget',
  icon: YourIcon,              // Lucide icon
  component: YourWidget,
},
```

### Bước 3: (Optional) Thêm vào default config

Nếu muốn widget mới active mặc định cho user mới, update `DEFAULT_WIDGET_CONFIG` trong `types.ts`:

```ts
export const DEFAULT_WIDGET_CONFIG: UserWidgetConfig = {
  activeWidgets: ['daily-reminder', 'your-widget-id'],
};
```

Lưu ý: thay đổi default KHÔNG affect user đã có config saved. Chỉ user mới (chưa có record `app_settings` key `home_widgets_config`) mới nhận default.

## Xong

Không cần update `App.tsx`, `tools.ts`, hay routing. Widget tự xuất hiện trong AddWidgetMenu sau khi register. User add qua menu, remove qua nút X trên header widget.

## Data flow

```
HubPro mount
  → <WidgetArea />
    → useLoadWidgetConfig() — fetch Supabase app_settings[home_widgets_config]
    → store.config.activeWidgets = ['focus', 'daily-reminder']
    → for each id: getWidgetById(id) → render <WidgetWrapper><Widget /></WidgetWrapper>

User add widget (AddWidgetMenu)
  → store.addWidget(id)
  → saveWidgetConfig(newConfig) — upsert Supabase

User remove widget (WidgetWrapper X button)
  → store.removeWidget(id)
  → saveWidgetConfig(newConfig)
```

## Conventions

| Concern | Rule |
|---|---|
| Size | Widget nên compact — tối đa ~200px height. Nếu data nhiều → show top 3-5 items + link "Xem tất cả" |
| Data fetching | Dùng TanStack Query hooks nếu có. Tự quản lifecycle, không nhờ parent |
| Side effects | Không mutate data ngoài scope widget khi mount. Mutation chỉ khi user interact |
| Error | `try/catch` + fallback text. Không crash toàn HubPro vì 1 widget lỗi |
| Performance | Lazy query (chỉ fetch khi widget active). Memoize expensive compute |

## Ví dụ: Quick Expense Widget (ý tưởng)

```tsx
export default function QuickExpenseWidget() {
  const { data, isLoading } = useExpenseSummary(); // TanStack Query hook

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-xs text-muted-foreground">Chi tiêu tháng này</div>
        <div className="text-lg font-semibold text-foreground">
          {formatCurrency(data.total)}
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={() => navigate('/expense')}>
        Chi tiết
      </Button>
    </div>
  );
}
```

Register:
```ts
{ id: 'quick-expense', label: 'Chi tiêu nhanh', description: 'Tổng chi tiêu tháng', icon: Wallet, component: QuickExpenseWidget }
```