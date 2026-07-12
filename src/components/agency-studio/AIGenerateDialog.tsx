// ============================================================
// AIGenerateDialog — chọn tone rồi gen template qua Gemini (streaming)
// ============================================================
// User click preset → dialog close ngay → gen chạy background.
// Callbacks:
//   - onStart(tone): parent hiển thị "AI đang gen" state
//   - onDelta(partial): parent update subject/body incremental
//   - onDone(final, tone): parent finalize + show undo toast
//   - onError(msg): parent show toast error
// ============================================================

import { Sparkles, Briefcase, MessageCircle, Heart } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/cn';
import type { EmailTone } from '@/api/agency-studio/ai-generate';

interface Preset {
  tone: EmailTone;
  label: string;
  description: string;
  icon: React.ElementType;
}

const PRESETS: Preset[] = [
  {
    tone: 'formal',
    label: 'Formal',
    description: 'Trang trọng, business-like. Dùng cho enterprise, first-touch.',
    icon: Briefcase,
  },
  {
    tone: 'casual',
    label: 'Casual',
    description: 'Đối thoại, ngắn gọn, tự nhiên. Dùng cho startup, SMB.',
    icon: MessageCircle,
  },
  {
    tone: 'friendly',
    label: 'Friendly',
    description: 'Nồng ấm, gần gũi. Dùng cho re-engagement, community.',
    icon: Heart,
  },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** User đã chọn tone — parent sẽ close dialog + start streaming. */
  onSelect: (tone: EmailTone) => void;
  hasCurrentDraft?: boolean;
}

export function AIGenerateDialog({
  open,
  onOpenChange,
  onSelect,
  hasCurrentDraft,
}: Props) {
  function handleSelect(tone: EmailTone) {
    onOpenChange(false);
    onSelect(tone);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="text-sm">AI Generate Email</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            {hasCurrentDraft
              ? 'AI sẽ cải thiện draft hiện tại theo tone bạn chọn.'
              : 'Chọn tone để AI tạo email template mới theo phong cách bạn hay dùng.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.tone}
                type="button"
                onClick={() => handleSelect(p.tone)}
                className={cn(
                  'flex items-start gap-3 rounded border border-border p-3 text-left transition-colors',
                  'hover:border-primary/50 hover:bg-muted/30',
                )}
              >
                <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}