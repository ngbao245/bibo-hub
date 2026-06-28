
# Modal System

## Pattern

```

App.tsx mount → <Calculator /> <Translate /> ... (tất cả cùng lúc)

↓

Mỗi modal component:

1. useShortcut() → đăng ký phím tắt (alt+c, alt+t...)

2. <ToolModal id="calculator">...</ToolModal>

↓

ToolModal:

- Đọc useModalStore: isOpen = (current === id)

- Render shadcn <Dialog open={isOpen}>

- onOpenChange(false) → store.close()

```

## Mở modal

3 cách:

1. Phím tắt (Alt+C) → useGlobalShortcuts bắt → gọi handler → store.toggle('calculator')

2. Click button Hub → useToolAction → store.open('calculator')

3. Code trực tiếp: useModalStore.getState().open('calculator')

## Đóng modal

- Phím Escape → useShortcut ở App level → store.close()

- Click overlay → Dialog onOpenChange(false) → store.close()

- Click nút X → Dialog built-in close → store.close()

- Bấm lại shortcut → store.toggle → close nếu đang mở

## Thêm modal mới

1. Tạo file src/modals/MyModal.tsx

2. Import useShortcut, useModalStore, ToolModal

3. Đăng ký shortcut + render ToolModal

4. Thêm ID vào MODAL_IDS trong stores/modalStore.ts

5. Import + mount trong App.tsx

Template:

```tsx

import { useCallback } from 'react';

import { useShortcut } from '@/hooks/useShortcut';

import { useModalStore } from '@/stores/modalStore';

import ToolModal from '@/components/ToolModal';

export default function MyModal() {

const toggle = useModalStore((s) => s.toggle);

const handler = useCallback(() => toggle('myModal'), [toggle]);

useShortcut({ key: 'alt+m', label: 'My Modal', group: 'Tools', handler });

return (

<ToolModal id="myModal" title="My Modal">

{/* content */}

</ToolModal>

);

}

```

## Lưu ý

- Chỉ 1 modal mở tại 1 thời điểm (store.current là string | null, không phải Set)

- Modal content vẫn mount khi đóng (chỉ Dialog hide), state bên trong giữ nguyên

- Nếu cần reset state khi đóng: dùng useEffect deps [isOpen]