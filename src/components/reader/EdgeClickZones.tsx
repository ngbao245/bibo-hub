import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Click rìa trái/phải để paginate. Là 2 button absolute-positioned;
 * cần đặt trong 1 container `relative` (body của reader, không phải scroll
 * area), để zones cố định theo viewport reader chứ không trôi theo scroll.
 *
 * Width 8% (min 48px). Hover hiện chevron mờ. Pointer-events chỉ trên 2
 * vùng → text selection ở giữa vẫn hoạt động.
 */
export default function EdgeClickZones({
  onPrev,
  onNext,
}: {
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous page"
        className="group absolute inset-y-0 left-0 z-20 flex w-[8%] min-w-[48px] items-center justify-center bg-transparent text-zinc-600 transition-colors hover:bg-zinc-950/40 hover:text-zinc-100"
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