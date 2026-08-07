import { cn } from '@/lib/cn';

export interface ServiceBadge {
  label: string;
  status: 'online' | 'updating' | 'offline';
}

interface MaintenanceStateProps {
  /** Tiêu đề chính. Default: "Đang nâng cấp hệ thống" */
  title?: string;
  /** Mô tả phụ. */
  description?: string;
  /** Status badges hiển thị dưới description. */
  services?: ServiceBadge[];
  /** Compact mode cho panel nhỏ / sidebar. */
  compact?: boolean;
  className?: string;
}

const STATUS_DOT: Record<ServiceBadge['status'], string> = {
  online: 'bg-success',
  updating: 'bg-warning animate-pulse',
  offline: 'bg-destructive',
};

const STATUS_TEXT: Record<ServiceBadge['status'], string> = {
  online: 'text-success',
  updating: 'text-warning',
  offline: 'text-destructive',
};

/**
 * Maintenance state — hiển thị khi feature tạm ngưng.
 * Illustration: mèo ngủ trên server box (CSS div drawing, solid colors).
 *
 * @example
 * <MaintenanceState />
 *
 * @example
 * <MaintenanceState
 *   title="AI Assistant đang bảo trì"
 *   description="Hệ thống đang được nâng cấp."
 * />
 */
export function MaintenanceState({
  title = 'Đang nâng cấp hệ thống',
  description = 'Tính năng tạm thời không khả dụng. Vui lòng thử lại sau.',
  services,
  compact,
  className,
}: MaintenanceStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-4 py-6' : 'gap-6 py-12',
        className,
      )}
    >
      <CatOnServer compact={compact} />

      <div className="flex flex-col items-center gap-2">
        <p className={cn(
          'font-semibold text-foreground/80',
          compact ? 'text-sm' : 'text-xl',
        )}>
          {title}
        </p>
        {description && (
          <p
            className={cn(
              'mx-auto max-w-[240px] text-muted-foreground',
              compact ? 'text-[10px]' : 'text-xs leading-relaxed',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {services && services.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {services.map((svc) => (
            <span
              key={svc.label}
              className={cn(
                'inline-flex items-center gap-1.5 border border-border px-2 py-1 text-[11px]',
                STATUS_TEXT[svc.status],
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[svc.status])} />
              {svc.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cat sleeping on server — CSS div illustration.
 * Solid colors (amber/orange for cat, slate for server).
 * No transparency on main shapes.
 */
function CatOnServer({ compact }: { compact?: boolean }) {
  const scale = compact ? 'scale-[0.55]' : 'scale-90';
  return (
    <div className={cn('relative', scale)} style={{ width: 300, height: 160 }} aria-hidden="true">
      {/* Ground shadow */}
      <div className="absolute bottom-[2px] left-1/2 h-[8px] w-[200px] -translate-x-1/2 rounded-full bg-black/15 animate-shadow-pulse" />

      {/* Server box */}
      <div className="absolute bottom-[10px] left-[40px] h-[40px] w-[220px] rounded-[4px] border-2 border-[#4a5568] bg-[#2d3748]">
        {/* Vent lines */}
        <div className="absolute left-[12px] top-[8px] flex gap-[4px]">
          <div className="h-[24px] w-[2px] rounded-full bg-[#4a5568]" />
          <div className="h-[24px] w-[2px] rounded-full bg-[#4a5568]" />
          <div className="h-[24px] w-[2px] rounded-full bg-[#4a5568]" />
          <div className="h-[24px] w-[2px] rounded-full bg-[#4a5568]" />
          <div className="h-[24px] w-[2px] rounded-full bg-[#4a5568]" />
        </div>
        {/* LED */}
        <div className="absolute right-[14px] top-1/2 h-[6px] w-[6px] -translate-y-1/2 rounded-full bg-[#48bb78] animate-pulse" />
        {/* Panel label */}
        <div className="absolute left-1/2 top-1/2 h-[14px] w-[50px] -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-[#4a5568] bg-[#1a202c]" />
      </div>

      {/* Cat — centered on top of server */}
      <div className="absolute bottom-[48px] left-[170px]">
        {/* Tail (behind body) */}
        <div className="absolute -left-[60px] bottom-0 z-0 h-[14px] w-[65px] rounded-l-[14px] bg-[#c05621]" />

        {/* Body */}
        <div className="absolute -left-[80px] bottom-0 z-10 h-[55px] w-[95px] rounded-t-[45px] bg-[#dd6b20] origin-bottom-right animate-breathe">
          {/* Paws */}
          <div className="absolute bottom-0 left-[14px] h-[8px] w-[20px] rounded-[4px] bg-[#fff5eb]" />
          <div className="absolute bottom-0 left-[44px] h-[8px] w-[20px] rounded-[4px] bg-[#fff5eb]" />
        </div>

        {/* Head */}
        <div className="relative z-20 h-[44px] w-[54px] rounded-[0_44px_44px_0] bg-[#dd6b20]">
          {/* Ears */}
          <div className="absolute -top-[10px] left-[5px] h-[12px] w-[12px] rounded-tl-[12px] bg-[#dd6b20]" />
          <div className="absolute -top-[10px] left-[22px] h-[12px] w-[12px] rounded-tl-[12px] bg-[#dd6b20]" />

          {/* Eyes — closed arcs */}
          <div className="absolute left-[10px] top-[14px] h-[5px] w-[8px] rounded-b-[8px] border-[1.5px] border-t-0 border-[#1a202c]" />
          <div className="absolute left-[30px] top-[14px] h-[5px] w-[8px] rounded-b-[8px] border-[1.5px] border-t-0 border-[#1a202c]" />

          {/* Muzzle */}
          <div className="absolute left-[16px] top-[22px] z-10">
            <div className="h-[9px] w-[9px] rounded-full bg-[#fff5eb]" />
            <div className="absolute left-[8px] top-0 h-[9px] w-[9px] rounded-full bg-[#fff5eb]" />
            {/* Nose */}
            <div className="absolute -top-[1px] left-[4px] h-0 w-0 border-l-[3.5px] border-r-[3.5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#e8836a]" />
          </div>

          {/* Mouth (behind muzzle via z-index) */}
          <div className="absolute left-[19px] top-[29px] z-0 h-[9px] w-[11px] rounded-b-[4px] bg-[#1a202c] origin-top animate-mouth" />

          {/* Zzz bubble */}
          <div className="absolute -top-[6px] left-[46px] h-[16px] w-[16px] rounded-[50px_50px_50px_3px] bg-white/30 animate-bubble" />
        </div>
      </div>
    </div>
  );
}
