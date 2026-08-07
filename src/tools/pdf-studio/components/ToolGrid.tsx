// ============================================================
// PDF Studio — Toolbox grid
// ============================================================

import { Combine, Scissors, Minimize2, Trash2, Unlock, Lock, Crop, Stamp, FileEdit, RotateCw, Image as ImageIcon, FileOutput, Hash } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { ToolOperation } from '../store';

interface ToolCardProps {
  op: ToolOperation;
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}

function ToolCard({ icon, label, description, onClick }: ToolCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-card p-5 text-center elev-surface',
        'transition-[color,background-color,border-color,box-shadow] duration-150 ease-in-out hover:border-primary/50 hover:bg-primary/5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground leading-tight">{description}</span>
    </button>
  );
}

interface ToolGridProps {
  onSelectOp: (op: ToolOperation) => void;
}

const TOOLS: Array<{ op: ToolOperation; icon: React.ReactNode; label: string; description: string }> = [
  { op: 'edit', icon: <FileEdit className="h-5 w-5" />, label: 'Edit PDF', description: 'Chỉnh sửa nội dung PDF' },
  { op: 'merge', icon: <Combine className="h-5 w-5" />, label: 'Gộp PDF', description: 'Gộp nhiều file PDF thành 1' },
  { op: 'split', icon: <Scissors className="h-5 w-5" />, label: 'Tách PDF', description: 'Tách PDF theo range trang' },
  { op: 'convert', icon: <FileOutput className="h-5 w-5" />, label: 'Chuyển đổi', description: 'Chuyển PDF sang Word/Excel/PNG...' },
  { op: 'compress', icon: <Minimize2 className="h-5 w-5" />, label: 'Nén PDF', description: 'Giảm dung lượng PDF' },
  { op: 'remove_pages', icon: <Trash2 className="h-5 w-5" />, label: 'Xóa trang', description: 'Xóa trang khỏi PDF' },
  { op: 'rotate', icon: <RotateCw className="h-5 w-5" />, label: 'Xoay trang', description: 'Xoay trang PDF 90°/180°/270°' },
  { op: 'unlock', icon: <Unlock className="h-5 w-5" />, label: 'Mở khóa', description: 'Mở PDF có mật khẩu' },
  { op: 'lock', icon: <Lock className="h-5 w-5" />, label: 'Khóa PDF', description: 'Đặt mật khẩu cho PDF' },
  { op: 'crop', icon: <Crop className="h-5 w-5" />, label: 'Cắt xén', description: 'Cắt margins PDF' },
  { op: 'watermark', icon: <Stamp className="h-5 w-5" />, label: 'Watermark', description: 'Thêm watermark text lên PDF' },
  { op: 'page_numbers', icon: <Hash className="h-5 w-5" />, label: 'Thêm số trang', description: 'Đánh số trang (text selectable)' },
  { op: 'to_images', icon: <ImageIcon className="h-5 w-5" />, label: 'PDF → Ảnh', description: 'Chuyển trang PDF thành PNG/JPG' },
];

export function ToolGrid({ onSelectOp }: ToolGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
      {TOOLS.map((t) => (
        <ToolCard key={t.op} {...t} onClick={() => onSelectOp(t.op)} />
      ))}
    </div>
  );
}
