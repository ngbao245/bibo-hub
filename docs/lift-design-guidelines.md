# Lift (Elevation) Design Guidelines

## Muc tieu

**Lift** khong phai la viec them shadow cho moi component.

Lift bieu thi rang mot thanh phan **dang noi len khoi be mat**, mang y nghia:
- Co the tuong tac
- Quan trong hon nen
- La mot surface doc lap

---

## Nguyen tac cot loi

### 1. Lift chi danh cho **Surface**

Ap dung:
- Card
- Button
- Dialog / Modal
- Drawer
- Dropdown
- Popover
- Tooltip
- Floating Action Button (FAB)

Khong ap dung:
- Text
- Icon
- Badge
- Checkbox
- Radio
- Switch
- Breadcrumb
- Pagination

---

### 2. Khong phai moi component deu can shadow

SAI ΓÇö tat ca deu co shadow:
- Sidebar
- Table
- Tabs
- Badge
- Input
- Checkbox

DUNG ΓÇö chi surface noi bat:
- Card
- Button
- Dialog
- Dropdown

---

## Nen ap dung

### Button

- Shadow nhe o trang thai binh thuong.
- Hover: tang shadow.
- Pressed: shadow bien mat (active state).

### Card (clickable)

- Hover moi nang nhe.
- Card tinh co the chi dung border hoac shadow rat nhe.

### Dialog / Modal

- Luon co elevation cao hon nen.

### Dropdown / Popover / Tooltip

- Luon noi hon component goc.

### Floating Action Button

- Luon co elevation.

---

## Co the ap dung rat nhe

- Search Bar
- Command Palette
- Floating Navbar
- Input Group (shadow rat nhe, khong lift khi hover)

---

## Khong nen ap dung

- Table
- Table Row
- List Item
- Sidebar Item
- Tabs
- Checkbox
- Radio
- Switch
- Badge
- Chip
- Breadcrumb
- Pagination
- Text
- Icon

Cac component nay nen thay doi bang mau nen, border hoac animation thay vi elevation.

---

## Ty le ap dung

Khong nen co qua 15-20% component tren mot man hinh su dung lift.

---

## Cac muc Elevation

| Level | Role |
|---|---|
| 0 | Background |
| 1 | Card |
| 2 | Dropdown / Popover |
| 3 | Dialog |
| 4 | Toast / Overlay noi |

Khong nen tao qua nhieu cap do.

---

## Khi co Theme "Lift"

Khong hieu la:
> Them shadow cho toan bo giao dien.

Ma hieu la:
> Tang elevation cho nhung component von da la surface.

| Component | Minimal | Lift |
|---|---|---|
| Button | Flat | Shadow + hover lift |
| Card | Border | Shadow |
| Dialog | Shadow | Shadow lon hon |
| Dropdown | Shadow nhe | Shadow ro hon |
| Input | Border | Border + shadow rat nhe hoac giu nguyen |
| Table | Khong doi | Khong doi |
| Sidebar | Khong doi | Khong doi |
| Tabs | Khong doi | Khong doi |
| Badge | Khong doi | Khong doi |

---

## Lift Eligibility Matrix

### Always

- Button
- Card
- Dialog
- Modal
- Drawer
- Dropdown
- Popover
- Tooltip
- FAB

### Optional

- Search Bar
- Input Group
- Command Palette
- Floating Navbar

### Never

- Table
- Table Row
- List Item
- Sidebar Item
- Tabs
- Badge
- Chip
- Checkbox
- Radio
- Switch
- Progress Bar
- Breadcrumb
- Pagination
- Text
- Icon

---

## Ket luan

Lift la mot **semantic elevation system**, khong phai hieu ung thi giac ap dung dong loat.

Chi nhung component dai dien cho mot **surface** moi nen tham gia vao he thong Lift. Dieu nay giup giao dien giu duoc cam giac premium, ro thu bac va tranh roi mat.