
import {
  StickyNote,
  ListTodo,
  FolderOpen,
  Lock,
  PiggyBank,
  Wallet,
  Truck,
  Film,
  Languages,
  Calculator,
  KeyRound,
  Package,
  Briefcase,
  ShoppingCart,
  Send,
  Settings2,
  ShieldCheck,
  GitCompareArrows,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// Map tool ID → lucide icon
// ============================================================
//
// Thay vì dùng emoji (📝 📋 ...), dùng icon vector từ lucide-react.
// Icon thống nhất stroke-width, kích thước, theme-aware.
// ============================================================

const ICON_MAP: Record<string, LucideIcon> = {
  notes: StickyNote,
  tasks: ListTodo,
  sources: FolderOpen,
  secret: Lock,
  savings: PiggyBank,
  expense: Wallet,
  spx: Truck,
  movies: Film,
  translate: Languages,
  calculator: Calculator,
  encoder: KeyRound,
  backup: Package,
  'project-packer': Briefcase,
  'p2p-transfer': Send,
  keycap: ShoppingCart,
  setting: Settings2,
  crypto: ShieldCheck,
  'code-compare': GitCompareArrows,
};

interface ToolIconProps {
  id: string;
  className?: string;
}

export function ToolIcon({ id, className }: ToolIconProps) {
  const Icon = ICON_MAP[id] ?? StickyNote;
  return <Icon className={className} />;
}