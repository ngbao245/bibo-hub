import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// BookmarksSkeleton — grid skeleton for bookmark page loading.
// Matches real layout footprint (column wrapper + inner spacing).
// Shimmer beam sweeps across content area.
// ============================================================

const COLUMNS: number[][] = [
  [5, 3, 6],
  [4, 5],
  [6, 4, 3],
];

export default function BookmarksSkeleton() {
  return (
    <div className="relative mx-auto w-[90%] max-w-[2250px] overflow-hidden rounded-xl">
      {/* Shimmer beam */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.06] to-transparent motion-reduce:hidden"
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((sizes, colIdx) => (
          <div
            key={colIdx}
            className="flex min-h-[120px] flex-col gap-6 rounded-xl border border-dashed border-transparent p-2"
          >
            {sizes.map((count, g) => (
              <div key={g} className="rounded-md p-1 -m-1">
                {/* Category badge header row */}
                <div className="mb-2 flex items-center gap-1.5">
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                {/* Favicon grid */}
                <div
                  className="flex flex-wrap items-center gap-1.5 p-0.5"
                  style={{ minHeight: 36 }}
                >
                  {Array.from({ length: count }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-8 rounded-full" />
                  ))}
                </div>
                {/* Hover title spacer (min-h-[14px]) */}
                <div className="mt-1.5 min-h-[14px]" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
