# BiBo Tools v2

Refactor toàn bộ project từ vanilla JS sang React + TypeScript.

## Stack

- **Vite** — build tool, dev server siêu nhanh
- **React 18** + **TypeScript** strict mode
- **Tailwind CSS v3** — styling, design system vuông vức (no border-radius)
- **React Router v6** — SPA routing
- **Zustand** — state toàn cục (modal đang mở, theme...)
- **TanStack Query v5** — fetch + cache MockAPI
- **Zod** — validate schema runtime

## Lệnh

```bash
npm install        # cài deps lần đầu
npm run dev        # chạy dev server (http://localhost:5173)
npm run build      # build production ra dist/
npm run preview    # preview bản build
npm run format     # format code bằng Prettier
```

## Cấu trúc

```
src/
├── main.tsx              # Entry, setup React Query + Router
├── App.tsx               # Root + định nghĩa routes
├── routes/               # Mỗi file = 1 page
├── components/           # UI dùng chung (Modal, Sidebar...)
├── modals/               # Nội dung từng tool modal
├── stores/               # Zustand stores
├── api/                  # TanStack Query hooks
├── schemas/              # Zod schemas + types
├── hooks/                # Custom React hooks
├── lib/                  # Utility thuần (encoder, config...)
└── styles/index.css      # Tailwind + CSS variables
```

## Design system

- **Vuông vức**: tailwind config override `borderRadius` chỉ cho `0`. Không dùng `rounded-*`.
- **Theme**: VSCode dark, kế thừa từ `common.css` cũ.
- **Token màu**: `bg-bg-primary`, `text-text-muted`, `border-border`...

## Hub có 2 bản

- `/` — bản original (giữ nguyên UI cũ)
- `/pro` — bản redesigned chuyên nghiệp

## Migration progress

- [x] Bước 1: Setup Vite + React + TS + Tailwind
- [ ] Bước 2: Theme + design tokens
- [ ] Bước 3: Core components (Modal, Sidebar, MobileHeader, ToolButton)
- [ ] Bước 4: Providers + global shortcuts + modal store
- [ ] Bước 5: API client + Zod schemas
- [ ] Bước 6: Hub (original + pro)
- [ ] Bước 7: Calculator modal
- [ ] Bước 8: Translate, Encoder, Backup modals
- [ ] Bước 9: Notes
- [ ] Bước 10: Tasks
- [ ] Bước 11: Secret, Savings, SpxTracking, DailyReminder, Shortcuts modals
- [ ] Bước 12: Sources, Movies, Expense, Keycap, ProjectPacker, Orders pages
- [ ] Bước 13: Mobile responsive
- [ ] Bước 14: Xoá file cũ
- [ ] Bước 15: Deploy Vercel
