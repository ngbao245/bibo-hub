# 🎨 Base CSS & Common Components

## CSS Architecture

### Theme Variables (src/styles/index.css)

App dùng **HSL-based token system** (shadcn/ui style):

```css
:root {
  /* Backgrounds */
  --background: 0 0% 12%;          /* Main bg - #1e1e1e */
  --card: 240 1% 15%;              /* Card bg - #252526 */
  --popover: 240 2% 18%;           /* Popover bg - #2d2d30 */
  --muted: 240 2% 20%;             /* Hover/disabled - #292929 */

  /* Text */
  --foreground: 0 0% 83%;          /* Primary text - #d4d4d4 */
  --muted-foreground: 0 0% 52%;    /* Secondary text - #858585 */

  /* Interactive */
  --primary: 204 100% 40%;         /* Main brand - #007acc VSCode blue */
  --primary-foreground: 0 0% 100%; /* Text on primary */
  --accent: 204 100% 40%;          /* Accent (same as primary) */

  /* Borders & Focus */
  --border: 240 4% 25%;            /* Border color - #3e3e42 */
  --input: 240 4% 25%;             /* Input border */
  --ring: 204 100% 40%;            /* Focus ring color */

  /* Status */
  --destructive: 358 64% 51%;      /* Error/delete - #d13438 red */

  /* Secondary brand (có thể unused) */
  --secondary: 240 1% 15%;
  --secondary-foreground: 0 0% 80%;
}
```

### Tailwind Color Mapping

`tailwind.config.ts` mapping CSS vars → Tailwind classes:

```ts
colors: {
  border: 'hsl(var(--border))',
  input: 'hsl(var(--input))',
  ring: 'hsl(var(--ring))',
  background: 'hsl(var(--background))',
  foreground: 'hsl(var(--foreground))',
  
  primary: {
    DEFAULT: 'hsl(var(--primary))',
    foreground: 'hsl(var(--primary-foreground))',
  },
  // ... etc
}
```

### Base Styles (Global Reset)

```css
@layer base {
  * {
    @apply border-border;  /* Default border color */
  }

  html, body, #root {
    @apply h-full;
  }

  body {
    @apply bg-background text-foreground;
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
  }

  /* Disable text selection on UI elements */
  button, .no-select {
    user-select: none;
  }

  /* Allow selection in editable areas */
  input, textarea, [contenteditable='true'] {
    user-select: text;
  }

  /* Hide scrollbar (CSS standard) */
  ::-webkit-scrollbar { display: none; }
  * { scrollbar-width: none; }
}
```

### Component Layer

```css
@layer components {
  .btn {
    @apply inline-flex cursor-pointer items-center justify-center
           border border-border bg-card px-4 py-2 text-foreground
           transition-colors;
  }
  .btn:hover {
    @apply border-primary bg-popover;
  }
}
```

---

## 🧩 shadcn/ui Components

### Available Components

Project cài sẵn các shadcn primitives:

| Component | File | Use Case |
|-----------|------|----------|
| **Button** | `ui/button.tsx` | Primary action |
| **Input** | `ui/input.tsx` | Text input |
| **Dialog** | `ui/dialog.tsx` | Modal window |
| **Tabs** | `ui/tabs.tsx` | Tab panels |
| **Checkbox** | `ui/checkbox.tsx` | Toggle multiple |
| **Tooltip** | `ui/tooltip.tsx` | Hover hint |
| **Skeleton** | `ui/skeleton.tsx` | Loading placeholder |
| **Sonner** | `ui/sonner.tsx` | Toast notification |

### Button Component

```tsx
import { Button } from '@/components/ui/button';

<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button disabled>Disabled</Button>
```

Variants qua CVA (class-variance-authority):
- `default` — solid primary
- `outline` — bordered
- `ghost` — text-only
- `destructive` — red background

### Input Component

```tsx
import { Input } from '@/components/ui/input';

<Input placeholder="Type something..." />
<Input type="password" placeholder="Password" />
<Input type="number" placeholder="123" />
<Input disabled placeholder="Disabled" />
```

### Dialog Component

```tsx
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Modal</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Toast (Sonner)

```tsx
import { toast } from '@/components/ui/sonner';

toast.success('Saved!');
toast.error('Something went wrong');
toast.info('Info');
toast.loading('Loading...');
```

---

## 🔧 cn() Helper

Merge CSS classes + resolve Tailwind conflicts:

```ts
import { cn } from '@/lib/cn';

// Merge + resolve conflict (p-4 wins)
const classes = cn('p-2 p-4');  // → 'p-4'

// Conditional
cn('px-2', isActive && 'bg-primary');  // → 'px-2 bg-primary' (if isActive)

// Object
cn({ 'text-red': isError, 'text-green': isSuccess });

// Mix all
cn(
  'px-4 py-2',
  status === 'active' && 'bg-primary',
  { 'opacity-50': isDisabled }
)
```

---

## 📐 Layout Patterns

### Flexbox Shortcuts

```tsx
// Center both axes (vertical + horizontal)
<div className="flex items-center justify-center h-screen">
  Content centered
</div>

// Space between (left/right at edges)
<div className="flex items-center justify-between">
  <span>Left</span>
  <span>Right</span>
</div>

// Vertical stack with gap
<div className="flex flex-col gap-4">
  <Item />
  <Item />
</div>

// Inline elements with gap
<div className="flex items-center gap-2">
  <Icon />
  <span>Label</span>
</div>
```

### Grid Patterns

```tsx
// 2 column
<div className="grid grid-cols-2 gap-4">
  <Item />
  <Item />
</div>

// Responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => <Item key={item.id} {...item} />)}
</div>

// Auto-fit columns
<div className="grid auto-cols-max gap-4">
  <Item />
  <Item />
</div>
```

### Text Truncation

```tsx
// Single line truncate
<div className="truncate">Long text will be truncated with...</div>

// Multi-line (max 3 lines)
<div className="line-clamp-3">
  Long text will be truncated after 3 lines...
</div>

// Custom line clamp
<div className="line-clamp-5">Multi-line text...</div>
```

---

## ♿ Accessibility Patterns

### Focus Ring

```tsx
<button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
  Accessible Button
</button>
```

### Semantic HTML

```tsx
// ✅ DO use semantic elements
<button onClick={handleClick}>Click me</button>
<nav>Navigation</nav>
<main>Main content</main>

// ❌ DON'T use divs for interactive
// <div onClick={...}>Click me</div>  ← bad, no keyboard access
```

### Labels & Descriptions

```tsx
<label htmlFor="email">Email</label>
<input id="email" type="email" />

<button aria-label="Close dialog" onClick={handleClose}>
  ✕
</button>
```

---

## 🎯 Common UI Patterns

### Loading State

```tsx
import { Skeleton } from '@/components/ui/skeleton';

function NoteListLoading() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}
```

### Empty State

```tsx
import { FileText } from 'lucide-react';

function EmptyNotes() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <FileText className="h-12 w-12 text-muted-foreground" />
      <p className="text-muted-foreground">No notes yet</p>
      <Button>Create first note</Button>
    </div>
  );
}
```

### Error State

```tsx
import { AlertCircle } from 'lucide-react';

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 rounded border border-destructive bg-destructive/10 p-3 text-destructive">
      <AlertCircle className="h-5 w-5" />
      <span>{message}</span>
    </div>
  );
}
```

### Spinner/Loader

```tsx
// Built-in spinner
<div className="h-8 w-8 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />

// Or use React component
function Spinner() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-5 animate-spin border-2 border-primary border-transparent border-t-current" />
      <span>Loading...</span>
    </div>
  );
}
```

### Badge/Pill

```tsx
// Simple badge
<span className="inline-block rounded-full bg-primary px-3 py-1 text-sm text-primary-foreground">
  New
</span>

// Dismissible badge
<div className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1">
  <span>Tag</span>
  <button onClick={dismiss} className="ml-1 hover:text-foreground">
    ✕
  </button>
</div>
```

### Card

```tsx
// Simple card
<div className="rounded border border-border bg-card p-4">
  <h3 className="font-semibold">Title</h3>
  <p className="text-sm text-muted-foreground">Description</p>
</div>

// Interactive card
<div className="cursor-pointer rounded border border-border bg-card p-4 transition-colors hover:border-primary hover:bg-popover">
  Content
</div>
```

---

## 🎨 Color Usage Guidelines

### When to Use Each Token

| Token | Usage |
|-------|-------|
| `bg-primary` / `text-primary` | Main CTA, active state, highlight |
| `bg-card` / `text-foreground` | Default bg, content area, text |
| `bg-popover` / `text-foreground` | Dropdown, popover, elevated surface |
| `bg-muted` | Hover state, disabled bg, subtle bg |
| `text-muted-foreground` | Secondary text, hint, disabled text |
| `border-border` | Default border, divider |
| `border-input` | Input border |
| `focus:border-ring` | Focus state |
| `bg-destructive` | Error, delete button |
| `bg-primary/15` | Subtle bg variant |

### ❌ AVOID Hard-Coded Shades

```tsx
// ❌ DON'T
<div className="bg-blue-500 text-green-400 border-emerald-600">
  Content
</div>

// ✅ DO
<div className="bg-primary text-foreground border-border">
  Content
</div>
```

Hard-coded shades make theme switching impossible.

### Alpha Modifiers (OK)

```tsx
// ✅ Using alpha with tokens
<div className="bg-primary/15">Subtle primary bg</div>
<div className="border border-primary/40">Faint primary border</div>
<div className="text-foreground/80">Slightly dimmed text</div>
```

Alpha still follows token, easy to theme.

### Special Case: User Data Colors

Highlight color dari user input (yellow/red/green/blue) — **hard-code specific**:

```tsx
// ✅ OK hard-code (user's choice, not theme)
const highlightColor = {
  yellow: 'bg-yellow-500/20',
  red: 'bg-red-500/20',
  green: 'bg-green-500/20',
};

<div className={highlightColor[userChoice]}>
  Highlighted text
</div>
```

User data colors != app theme.

---

## 🔌 Typography Utilities

### Font Sizes

Tailwind defaults (modified by base CSS):

```tsx
<h1 className="text-4xl font-bold">Heading 1</h1>
<h2 className="text-3xl font-bold">Heading 2</h2>
<h3 className="text-2xl font-bold">Heading 3</h3>
<h4 className="text-lg font-semibold">Heading 4</h4>
<p className="text-base">Normal text (14px from base CSS)</p>
<p className="text-sm text-muted-foreground">Secondary text</p>
<code className="font-mono text-xs bg-muted px-1">Code</code>
```

### Font Weights

```tsx
<span className="font-thin">Thin</span>       {/* 100 */}
<span className="font-light">Light</span>     {/* 300 */}
<span className="font-normal">Normal</span>   {/* 400 */}
<span className="font-medium">Medium</span>   {/* 500 */}
<span className="font-semibold">Semibold</span> {/* 600 */}
<span className="font-bold">Bold</span>       {/* 700 */}
```

### Line Height

```tsx
<p className="leading-tight">Tight spacing</p>    {/* 1.25 */}
<p className="leading-normal">Normal spacing</p>  {/* 1.5 */}
<p className="leading-relaxed">Relaxed spacing</p> {/* 1.625 */}
<p className="leading-loose">Loose spacing</p>    {/* 2 */}
```

---

## 🎭 Transitions & Animations

### Built-in Animations

```tsx
// Spin (loading)
<div className="animate-spin border-2 border-primary border-b-transparent" />

// Pulse (subtle attention)
<div className="animate-pulse bg-muted" />

// Bounce
<div className="animate-bounce">Bouncing element</div>

// Custom accordion
<div className="animate-accordion-down">Expanding content</div>
```

### Transition Classes

```tsx
<button className="transition-colors duration-200 hover:bg-primary">
  Smooth color transition
</button>

<div className="transition-all duration-300 hover:scale-105">
  Scale + all properties
</div>

<div className="transition-opacity duration-fast">
  Fast opacity change (150ms)
</div>
```

Durations:
- `duration-fast` — 150ms
- `duration-normal` — 200ms
- `duration-slow` — 300ms

---

## 📱 Responsive Design

### Breakpoints

Tailwind standard breakpoints:

```tsx
// Mobile first (base = mobile)
<div className="px-2">Mobile (< 640px)</div>

// Tablet
<div className="sm:px-4">Tablet (≥ 640px)</div>

// Desktop
<div className="md:px-6">Desktop (≥ 768px)</div>

// Large desktop
<div className="lg:px-8">Large (≥ 1024px)</div>

// Full width
<div className="xl:px-12">XL (≥ 1280px)</div>
```

### Responsive Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

### Mobile-First Pattern

```tsx
// ✅ DO: Start from mobile, enhance
<div className="flex flex-col gap-4 md:flex-row md:gap-8">
  <aside className="md:w-1/4">Sidebar</aside>
  <main className="md:flex-1">Content</main>
</div>

// ❌ AVOID: Desktop-first (harder to read mobile)
// <div className="md:flex-col lg:flex-row">...
```

---

## 🎯 Custom Component Examples

### Custom Input with Icon

```tsx
function IconInput({ icon: Icon, ...props }) {
  return (
    <div className="relative flex items-center">
      <Icon className="absolute left-3 h-5 w-5 text-muted-foreground" />
      <Input className="pl-10" {...props} />
    </div>
  );
}
```

### Custom Select Dropdown

```tsx
function CustomSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full border border-border bg-card px-3 py-2 text-left"
      >
        {options.find(o => o.value === value)?.label}
      </button>
      {open && (
        <div className="absolute top-full mt-1 w-full border border-border bg-popover">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left hover:bg-muted"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Custom Alert

```tsx
function Alert({ variant = 'info', children }) {
  const styles = {
    info: 'bg-primary/10 text-primary border-primary/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    success: 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  return (
    <div className={`rounded border p-3 ${styles[variant]}`}>
      {children}
    </div>
  );
}
```

### Custom Tab Component

```tsx
function Tabs({ tabs, defaultActive = 0 }) {
  const [active, setActive] = useState(defaultActive);

  return (
    <div>
      <div className="flex border-b border-border">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              'px-4 py-2 font-medium transition-colors',
              active === i
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tabs[active].content}
      </div>
    </div>
  );
}
```

---

## ✨ Dark Mode Setup

Project **dark mode only** (không có light mode toggle):

```css
/* src/styles/index.css */
@layer base {
  :root {
    /* Dark theme mặc định */
    --background: 0 0% 12%;
    --foreground: 0 0% 83%;
    /* ... */
  }
}
```

Nếu sau này thêm light mode:

```ts
// tailwind.config.ts
export default {
  darkMode: ['class'],  // ← Thêm này
  // ...
}

// HTML
<html class="dark">  {/* Light: bỏ class */}
</html>
```

---

## 📋 CSS Classes Quick Reference

### Spacing

```tsx
p-4          /* padding all sides */
px-4         /* padding left + right */
py-2         /* padding top + bottom */
pl-4         /* padding left */
gap-4        /* gap between flex/grid children */
mx-auto      /* margin left + right auto (center) */
```

### Sizing

```tsx
w-full       /* 100% width */
w-1/2        /* 50% width */
h-full       /* 100% height */
min-h-screen /* min height viewport */
max-w-2xl    /* max width container */
```

### Display & Visibility

```tsx
hidden       /* display none */
invisible    /* visibility hidden (space still taken) */
flex         /* display flex */
inline-flex  /* display inline-flex */
grid         /* display grid */
block        /* display block */
```

### Borders & Shadows

```tsx
border       /* border 1px */
border-2     /* border 2px */
rounded      /* border radius (0 in this project) */
shadow       /* box shadow */
shadow-lg    /* large shadow */
```

### Text

```tsx
text-center      /* text align center */
text-sm          /* font size small */
font-bold        /* font weight bold */
uppercase        /* text transform uppercase */
line-clamp-2     /* max 2 lines */
truncate         /* single line truncate */
```

### Hover & Focus

```tsx
hover:bg-primary   /* background on hover */
focus:outline-none /* remove focus outline */
focus:ring-2       /* add ring on focus */
disabled:opacity-50  /* dim when disabled */
```