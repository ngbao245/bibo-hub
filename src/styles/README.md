# Theme Toggles — Lift & Rounded

User toggle trong Setting / Design System / HubPro avatar menu. Apply qua `data-*` attributes tren `<html>`.

## Attributes

| Attribute | Effect | Toggle store |
|---|---|---|
| `data-3d` | Lift elevation cho surfaces (buttons, cards) | `useThemeStore.is3d` |
| `data-rounded` | Tang border-radius toan app (Subtle) | `useThemeStore.isRounded` |
| `data-pill` | Border-radius manh hon (Pill) — loai tru voi rounded | `useThemeStore.isPill` |
| `data-retro` | Lift shadow xam thay vi themed (chi khi 3d) | `useThemeStore.isRetro` |

## Elevation tokens (kieu Apple/ChatGPT — minimal polished)

Shadow mem ro, blur rong (8-40px), alpha thap, tone den trung tinh (khong tint theo primary). Khong glow, khong glass, khong gradient.

| Var | Role |
|---|---|
| `--elevation-surface` | Card/panel: 1px+10px double-layer, blur mem |
| `--elevation-floating` | Dropdown/popover/tooltip: 6px+24px, ro hon |
| `--elevation-overlay` | Dialog/modal: 12px+48px, ambient |
| `--hover-lift` | `-2px` translateY khi hover (.lift-on-hover) |

Dark theme override: alpha shadow tang len (0.30-0.55) de van thay tren nen toi.

Utility tieu thu var (thay hardcode shadow-[...] trong TSX):
- `.elev-surface` / `.elev-floating` / `.elev-overlay` — box-shadow
- `.lift-on-hover` — hover translateY + shadow tang (respect reduced-motion)

Control UI: logic o hook `useThemeControls` (`src/tools/theme/use-theme-controls.ts`), dung boi DesignSystemV2 (chip) va HubPro (card). Subtle/Pill la 2 nut mutual exclusive (bat 1 → tat kia).

## Lift Eligibility

Lift chi ap dung cho **surfaces** — xem `docs/lift-design-guidelines.md`.

### Always (nhan lift tu dong)

- Button (`<button>` element)
- Card (can them class hoac wrapper)
- Dialog / Modal
- Dropdown / Popover

### Never (tu dong exclude boi CSS)

- Checkbox (`role='checkbox'`)
- Radio (`role='radio'`)
- Switch (`role='switch'`)
- Tab (`role='tab'`)
- Table / List items
- Badge / Chip
- Text / Icon

### Opt-out per element: `data-flat`

Gan `data-flat` len button hoac **parent container** de exclude:

```tsx
// Single button flat
<Button data-flat>No lift</Button>

// Entire dropdown flat
<div data-flat>
  <button>All buttons inside = no lift</button>
  <button>This too</button>
</div>
```

CSS selector: `:not([data-flat]):not([data-flat] *)` — element co `data-flat` hoac nam trong parent co `data-flat` deu bi exclude.

## Opt-out Rounded

Dung Tailwind `!rounded-none`:

```tsx
<Button className="!rounded-none">Square</Button>
```

Checkbox/switch: luon vuong bat ke rounded mode (CSS force `border-radius: 0 !important`).

## Lift mechanics (box-shadow approach)

- `box-shadow: 0 3px 0 0 color, 0 2px 4px shadow` — tao raised visual.
- **Khong dung border-bottom** — khong anh huong layout.
- Active: `box-shadow: none` = pressed flat.
- Outline/secondary buttons: shadow dung `hsl(var(--border))` thay vi den.
- Toggle on/off: khong shift layout.

## File reference

- CSS rules: `src/styles/index.css` (section "Toggle: Lift")
- Guidelines: `docs/lift-design-guidelines.md`
- Store: `src/tools/theme/store.ts`
- Apply attributes: `src/App.tsx` (`useApplyThemeAttributes`)
