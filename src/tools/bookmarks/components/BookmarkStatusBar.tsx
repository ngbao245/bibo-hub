// ============================================================
// BookmarkStatusBar — shared status bar (Public/Private + slug URL + actions)
// ============================================================
// Used by:
//   - Owner route (`route.tsx` bên trong <header>): cần cả 2 case Public/Private,
//     wrapper có `border-t border-border/50 px-4 py-1.5`
//   - Public route via BookmarkHeader (`BookmarkHeader.tsx` StatusBar mode default/both):
//     chỉ Public case, wrapper `mb-3`
//
// Public case: Globe badge + URL pill (copy) + Preview link (open new tab).
// Private case: Lock badge + hint text + "Bật public" button (owner only,
// trigger onEnablePublic).
// ============================================================

import { Globe, Copy, ExternalLink, Lock } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/cn';
import { getBasename } from '@/lib/basename';

interface Props {
  isPublic: boolean;
  slug: string;
  publicUrl: string;
  /** Only invoked when isPublic=false. If omitted, "Bật public" button hidden. */
  onEnablePublic?: () => void;
  className?: string;
}

export function BookmarkStatusBar({
  isPublic,
  slug,
  publicUrl,
  onEnablePublic,
  className,
}: Props) {
  // Detect basename để hiển thị path đúng
  const basename = window.location.pathname.startsWith('/hubibo') ? '/hubibo' : '';
  const displayPath = `${basename}/bookmarks/${slug}`;

  function copy() {
    if (!publicUrl) return;
    navigator.clipboard
      .writeText(publicUrl)
      .then(() => toast.success('Đã copy link'))
      .catch(() => { });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2 text-xs', className)}>
      {isPublic ? (
        <>
          <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
            <Globe className="h-3 w-3" /> Public
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors duration-150 hover:border-primary hover:text-primary"
            title="Copy public URL"
          >
            <Copy className="h-3 w-3" />
            {displayPath}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 items-center gap-1 rounded-lg px-2 text-[11px] font-medium text-muted-foreground transition-colors duration-150 hover:bg-foreground/5 hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" /> Preview
          </a>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Lock className="h-3 w-3" /> Private
          </span>
          <span className="text-muted-foreground/70">
            Bookmark page riêng tư. Bật public trong Settings để share.
          </span>
          {onEnablePublic && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px]"
              onClick={onEnablePublic}
            >
              Bật public
            </Button>
          )}
        </>
      )}
    </div>
  );
}
