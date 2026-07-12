# TODO

## Pending

- [ ] Upgrade `lucide-react` và thay `src/components/icons/PencilSparkles.tsx` (inline SVG) bằng import chính thức từ lucide-react. Version hiện tại (`^1.17.0`) chưa export `PencilSparkles`. Khi lucide release version có icon này → `npm install lucide-react@latest` → đổi file thành `export { PencilSparkles } from 'lucide-react';`