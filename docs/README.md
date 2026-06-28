# 📚 BiBo Tools v2 - Documentation Hub

Chào mừng! Tài liệu này giúp bạn hiểu, xây dựng, và mở rộng BiBo Tools v2.

---

## 🗂️ Tài Liệu Chính

### 📐 **[PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md)** — START HERE

**Tổng quan toàn bộ kiến trúc project**, bao gồm:
- Tech stack (React, Tailwind, TanStack Query, Zustand...)
- Cấu trúc folder chi tiết
- Data flow (TanStack Query cache, Zustand store, localStorage)
- Optimistic UI pattern
- Code splitting strategy
- Common patterns (Modal, Shortcut, API, Component)

👉 **Nên đọc**: First time, cần overview toàn project.

---

### 🎨 **[BASE_CSS_COMPONENTS.md](./BASE_CSS_COMPONENTS.md)** — CSS & Components

**Hệ thống theme, styling, và shadcn/ui components**, bao gồm:
- Theme token system (CSS variables)
- Quy tắc dùng semantic colors
- Base CSS + reset
- shadcn/ui component examples (Button, Input, Dialog, Tabs...)
- Layout patterns (Flexbox, Grid, Responsive)
- Accessibility best practices
- Custom component examples
- Tailwind utilities quick reference

👉 **Nên đọc**: Building UI, styling components, theme-related tasks.

---

### 🚀 **[ADDING_NEW_FEATURE.md](./ADDING_NEW_FEATURE.md)** — How to Add Features

**Step-by-step hướng dẫn thêm feature mới từ đầu**, bao gồm:
- Checklist feature bao gồm
- Schema definition (Zod)
- API hooks (TanStack Query)
- Route page component
- Integration (router, tool registry)
- Testing checklist
- Common issues & solutions
- Real example: Recipe Manager

👉 **Nên đọc**: Adding new CRUD feature, tool, or page.

---

### 🛠️ **[ADDING_NEW_TOOL.md](./ADDING_NEW_TOOL.md)** — How to Add Utility Tools

**Recipe ngắn cho utility 1-page** (không CRUD), gồm:
- Folder layout chuẩn (`routes/` + `lib/` + `types/`)
- 10 step từ install dep đến verify
- Anti-patterns thường gặp
- Khi nào dùng modal vs route
- Templates copy-paste
- Case study: Markdown Preview

👉 **Nên đọc**: Build tool dạng utility như Markdown Preview, Code Compare, Project Packer.

---

### ⚡ **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** — Cheat Sheet

**Tóm tắt nhanh**, bao gồm:
- Folder shortcuts
- Commands
- Naming conventions
- Theme tokens
- Common imports
- API pattern
- Component template
- Common CSS patterns
- Common mistakes to avoid

👉 **Nên đọc**: Quick lookup, syntax reference.

---

### 📂 **[FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md)** — Index các README ở folder

Mỗi folder trong `src/` có README riêng (mục đích + convention ngắn). File này tổng hợp link tất cả + mapping README ↔ doc chi tiết.

👉 **Nên đọc**: Mở 1 folder lần đầu, không biết bắt đầu từ đâu.

---

## 📖 Tài Liệu Bổ Sung

### ✅ **[conventions.md](./conventions.md)** — Coding Standards

- File naming conventions
- Component patterns (page, reusable, modal)
- State management scope
- API hooks pattern
- Styling rules
- TypeScript guidelines
- Comment style
- Import order
- Error handling

### 🔄 **[optimistic-ui.md](./optimistic-ui.md)** — Optimistic Update Pattern

Chi tiết về optimistic UI:
- Cách TanStack Query `onMutate` → `onError` → `onSettled` work
- `optimisticList` helper sử dụng
- `beforeunload` warning khi pending mutations
- Real-world examples

### 💾 **[database.md](./database.md)** — Backend Setup

- MockAPI vs live backend (Supabase, Firebase)
- API URL config (env decode)
- Authentication setup
- Data persistence
- Reader module (PDF storage)

### 📦 **[blob-cache.md](./blob-cache.md)** — IndexedDB Caching (Reader)

- IndexedDB LRU cache strategy
- PDF file + cover caching
- Cache eviction policy
- Performance optimization

### 🎯 **[modal-system.md](./modal-system.md)** — Modal Architecture

- Modal store (Zustand)
- ToolModal component
- Global modal mount pattern
- Registering new modals

---

## 🎯 Reading Paths by Role

### 👶 **I'm New to This Project**

1. Start: [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) — understand overall design
2. Read: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — get key shortcuts
3. Explore: `src/` folder, read some existing components
4. Try: [ADDING_NEW_FEATURE.md](./ADDING_NEW_FEATURE.md) — implement a small feature

### 🎨 **I'm Building UI**

1. Ref: [BASE_CSS_COMPONENTS.md](./BASE_CSS_COMPONENTS.md) — theme tokens, components
2. Ref: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) — CSS patterns
3. Search: "Component example" in docs
4. Check: Existing components in `src/components/`

### 🔧 **I'm Adding a Feature**

1. Guide: [ADDING_NEW_FEATURE.md](./ADDING_NEW_FEATURE.md) — step-by-step
2. Ref: [conventions.md](./conventions.md) — coding standards
3. Ref: [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) → "Data Flow" section
4. Optimize: [optimistic-ui.md](./optimistic-ui.md) — setup optimistic updates

### 🚀 **I'm Optimizing/Debugging**

1. Ref: [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) → "Debugging Tips"
2. Ref: [optimistic-ui.md](./optimistic-ui.md) — mutation patterns
3. Check: React DevTools, TanStack Query DevTools
4. Profile: Webpack Bundle Analyzer

### 📚 **I'm Documenting/Reviewing Code**

1. Check: [conventions.md](./conventions.md) — standards compliance
2. Check: [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) → "Quality Standards"
3. Commands: Run `npm run lint`, `npm run format`

---

## 🔑 Key Concepts Quick Intro

### 🎮 State Management

- **UI State** (Modal, shortcuts, temp form): Zustand store
- **Server State** (Notes, tasks, movies): TanStack Query
- **Local State** (Form input, toggle): `useState`
- **Persistent** (Across sessions): `useLocalStorage`

### 📡 Data Flow

```
User action → Component hook (useNotes) → TanStack Query
    ↓
fetchJson(API) → Zod.parse() → validate
    ↓
Cache store → Component re-render
```

### 🎨 Styling

```
Semantic token (--primary: blue)
    ↓
Tailwind class (bg-primary)
    ↓
CSS variable (hsl(var(--primary)))
    ↓
Dark theme applied
```

**Golden Rule**: Use `bg-primary`, not `bg-blue-500`.

### ⚡ Optimistic UI

```
User action → onMutate (update cache ngay)
    ↓
API call background
    ↓
Error → onError (rollback) | OK → onSettled (refetch)
```

### 🔗 Component Composition

```
Page (route) → Sub-components (functional UI)
    ↓
Props down (data), callbacks up (actions)
    ↓
Hooks for data (useNotes, useLocalStorage)
```

---

## 📊 Architecture at a Glance

```
┌─────────────────────────────────────────┐
│          src/App.tsx                    │  ← Entry point
│  Routes (lazy) + Global modals          │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        ↓                     ↓
    Routes                Modals
    (pages)          (Calculator, 
     │               Translate...)
     ├─ HubPro       
     ├─ Notes        
     ├─ Tasks        
     ├─ Recipes      ← New feature
     └─ ...          
        │
        ├─ API hooks (useNotes, useRecipes...)
        │  ↓ TanStack Query (cache + fetch)
        │  
        ├─ Components (NoteList, NoteEditor...)
        │  ↓ shadcn UI + Tailwind
        │
        ├─ Hooks (useGlobalShortcuts, useLocalStorage...)
        │
        └─ Stores (modalStore, shortcutStore)
           ↓ Zustand (global state)
```

---

## 🛠️ Development Setup

### First Time Setup

```bash
# Clone repo
git clone <repo>
cd bibo-tools-v2

# Install dependencies
npm install

# Start dev server
npm run dev
# → Open http://localhost:3000
```

### Build & Deploy

```bash
# Type check + build
npm run build
# → dist/ folder ready

# Lint
npm run lint

# Format
npm run format
```

---

## 🎓 Learning Resources

### Inside Repo

- `src/components/ui/` — shadcn components usage examples
- `src/api/notes.ts` — Real API hooks implementation
- `src/routes/Notes.tsx` — Full page example
- `src/stores/modalStore.ts` — Zustand store example
- `src/lib/optimistic.ts` — Optimistic UI pattern

### External

- [React Docs](https://react.dev) — React concepts
- [TanStack Query](https://tanstack.com/query/latest) — Data fetching
- [Zustand](https://github.com/pmndrs/zustand) — State management
- [Tailwind CSS](https://tailwindcss.com) — Utility CSS
- [shadcn/ui](https://ui.shadcn.com) — Component library
- [Zod](https://zod.dev) — Schema validation

---

## 🤝 Contributing Guidelines

1. **Before starting**: Read [ADDING_NEW_FEATURE.md](./ADDING_NEW_FEATURE.md)
2. **Code style**: Follow [conventions.md](./conventions.md)
3. **Build check**: `npm run build`
4. **Lint check**: `npm run lint`
5. **Format**: `npm run format`
6. **Test**: Manual CRUD testing
7. **PR**: Clear title + description

---

## 📝 FAQ

### Q: Where do I put my new component?

**A**: 
- Page-level: `src/routes/MyPage.tsx`
- Reusable: `src/components/MyComponent.tsx`
- Feature-specific: `src/components/{feature}/MyComponent.tsx`

### Q: How do I fetch data from API?

**A**: Use TanStack Query hook (see [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) → "API & Query Pattern").

### Q: How do I share state across components?

**A**: 
- Global UI state → Zustand store
- Server state → TanStack Query
- Persist across sessions → useLocalStorage

### Q: My component re-renders too often?

**A**: 
1. Check hook dependencies
2. Use Zustand selector (not entire store)
3. Memoize expensive computations
4. See [PROJECT_ARCHITECTURE.md](./PROJECT_ARCHITECTURE.md) → "Debugging Tips"

### Q: How do I add keyboard shortcut?

**A**: Register in `useGlobalShortcuts` or use `useShortcutStore` directly.

### Q: Where do I add theme color?

**A**: Edit `src/styles/index.css` CSS variable + `tailwind.config.ts` mapping.

---

## 📞 Support

- **Questions**: Check FAQ section above
- **Documentation**: Read relevant .md file (see "Reading Paths by Role")
- **Code examples**: See `src/` folder
- **Issues**: See "Common Mistakes to Avoid" in [QUICK_REFERENCE.md](./QUICK_REFERENCE.md)

---

**Last updated**: June 2026  
**Project**: BiBo Tools v2  
**Documentation version**: 1.0