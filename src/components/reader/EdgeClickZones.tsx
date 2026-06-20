import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Click rìa trái/phải để paginate. Là 2 button absolute-positioned;
 * cần đặt trong 1 container `relative` (body của reader, không phải scroll
 * area), để zones cố định theo viewport reader chứ không trôi theo scroll.
 *
 * Width 8% (min 48px). Hover hiện chevron mờ. Pointer-events chỉ trên 2
 * vùng → text selection ở giữa vẫn hoạt động.
 *
 * Left zone shifts right khi sidebar open để không conflict với sidebar.
 */
export default function EdgeClickZones({
  onPrev,
  onNext,
  sidebarOpen = false,
}: {
  onPrev: () => void;
  onNext: () => void;
  sidebarOpen?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous page"
        className={cn(
          'group absolute inset-y-0 z-20 flex w-[8%] min-w-[48px] items-center justify-center bg-transparent text-zinc-600 transition-all hover:bg-zinc-950/40 hover:text-zinc-100',
          sidebarOpen ? 'left-80' : 'left-0',
        )}
      >
        <ChevronLeft className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next page"
        className="group absolute inset-y-0 right-0 z-20 flex w-[8%] min-w-[48px] items-center justify-center bg-transparent text-zinc-600 transition-colors hover:bg-zinc-950/40 hover:text-zinc-100"
      >
        <ChevronRight className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </>
  );
}