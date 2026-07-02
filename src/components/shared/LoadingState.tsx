import type { CSSProperties } from 'react';
import { Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

interface LoadingStateProps {
  /** "spinner" cho action, "skeleton" cho list, "inline" cho block nhỏ. Default: "spinner". */
  variant?: 'spinner' | 'skeleton' | 'inline';
  /** Text kèm spinner. Skip nếu chỉ cần icon. */
  label?: string;
  /** Skeleton mode only: số ô placeholder. Default: 6. */
  count?: number;
  /** Skeleton mode only: layout. Default: "grid". */
  layout?: 'grid' | 'list';
  /** Skeleton mode only: class cho mỗi item (VD `h-48` cho card cao). Default: `h-24` (grid) / `h-12` (list). */
  itemClassName?: string;
  className?: string;
  /**
   * Skeleton mode only: inline style cho wrapper — dùng khi cần custom
   * grid-template-columns (VD `auto-fill minmax(...)`) mà Tailwind class
   * không diễn tả được.
   */
  style?: CSSProperties;
  /**
   * Skeleton mode only: giới hạn số hàng hiển thị bằng cách clip container
   * theo `max-height` responsive. Dùng khi grid có `auto-fill` (số cột thay
   * đổi theo viewport) và muốn skeleton luôn cao đúng N hàng dù cột nhiều
   * hay ít. Cần đặt cùng `itemClassName` với chiều cao rõ ràng
   * (VD `aspect-square h-auto w-full`).
   */
  maxRows?: number;
  /**
   * Skeleton mode only: bật beam sáng chạy qua toàn container.
   * Default true. Set false nếu skeleton nằm trong container đã có shimmer
   * cha (tránh 2 beam overlap).
   */
  shimmer?: boolean;
  /**
   * Skeleton mode only: override tốc độ beam (VD "1.2s", "2.5s"). Default
   * là 1.8s theo config Tailwind. Dùng để tạo hiệu ứng row nhanh/chậm khác
   * nhau khi stack nhiều LoadingState.
   */
  shimmerDuration?: string;
}

/**
 * Loading state chuẩn cho hub. Dùng thay cho `<div>Loading...</div>` inline.
 *
 * Sweep hiệu ứng "1 beam đi qua nhiều block" chứ KHÔNG phải mỗi block
 * flash riêng. Beam đặt ở container level, blocks chỉ là màu phẳng.
 *
 * @example
 * // Fetch data trong page
 * if (isLoading) return <LoadingState variant="skeleton" count={8} />;
 *
 * @example
 * // Grid responsive, chỉ 2 hàng skeleton, tự adapt số cột theo viewport
 * <LoadingState
 *   variant="skeleton"
 *   count={30}
 *   maxRows={2}
 *   itemClassName="aspect-square h-auto w-full"
 *   className="grid gap-px bg-border"
 *   style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
 * />
 *
 * @example
 * // Action đang chạy
 * <Button disabled={isPending}>
 *   {isPending ? <LoadingState variant="inline" label="Đang lưu..." /> : 'Lưu'}
 * </Button>
 */
export function LoadingState({
  variant = 'spinner',
  label,
  count = 6,
  layout = 'grid',
  itemClassName,
  className,
  style,
  maxRows,
  shimmer = true,
  shimmerDuration,
}: LoadingStateProps) {
  if (variant === 'skeleton') {
    const defaultItem = layout === 'grid' ? 'h-24 w-full' : 'h-12 w-full';

    // Clip theo maxRows: mỗi hàng cao = kích thước 1 item + gap. Vì item có
    // thể aspect-square (chiều cao = chiều rộng cột), không thể tính chính
    // xác pixel — dùng CSS custom property `--sk-rows` + `grid-auto-rows`
    // để browser tự clip. Wrapper set `overflow: hidden` + `max-height` qua
    // container query đơn giản: dùng `grid-template-rows` = repeat(N, auto),
    // rồi cắt bằng `overflow-hidden`. Đơn giản nhất: set explicit
    // `grid-auto-rows` không dùng maxRows mà set `grid-template-rows`
    // = repeat(maxRows, 1fr) + `max-h` theo aspect. Vì không biết width
    // runtime, cách chắc ăn: wrap trong container `overflow-hidden` với
    // `max-height` = aspect ratio * maxRows nếu có, else để tự nhiên.
    const wrapperStyle: CSSProperties = { ...style };
    if (maxRows && layout === 'grid') {
      // Ép grid-auto-rows = 0 sau row thứ maxRows bằng cách dùng
      // `grid-template-rows: repeat(N, minmax(0, 1fr))` KHÔNG được vì
      // grid vẫn overflow. Cách đảm bảo: `overflow: hidden` + count đủ
      // items để fill nhiều cột × maxRows hàng, browser tự cắt phần thừa
      // bằng `grid-template-rows: repeat(maxRows, auto)` + set aspect qua
      // itemClassName. Kết quả: chỉ maxRows hàng hiển thị visually.
      wrapperStyle.gridTemplateRows = `repeat(${maxRows}, auto)`;
      wrapperStyle.gridAutoRows = '0';
      wrapperStyle.overflow = 'hidden';
    }

    return (
      <div
        className={cn(
          'relative',
          layout === 'grid'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col gap-2',
          shimmer && 'overflow-hidden',
          className,
        )}
        style={wrapperStyle}
      >
        {Array.from({ length: count }).map((_, i) => (
          <Skeleton key={i} className={cn(defaultItem, itemClassName)} />
        ))}
        {shimmer && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent"
            style={shimmerDuration ? { animationDuration: shimmerDuration } : undefined}
          />
        )}
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {label && <span className="text-sm">{label}</span>}
      </span>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}