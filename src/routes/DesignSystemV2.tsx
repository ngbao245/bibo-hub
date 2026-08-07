// ============================================================
// Design System V2 — Hardened Component Catalog
// ============================================================
// Route: /design-system-v2
// Production primitives, semantic Tabs, responsive header,
// accessible controls, calm motion. See specs/design-system-v2-hardening/.
// ============================================================

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  AlertCircle,
  FileText,
  Search,
  Inbox,
  Music,
  BookOpen,
  MessageSquare,
  LayoutDashboard,
  Users,
  Bookmark,
  Plus,
  Palette,
  Settings2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
  MoreVertical,
  Download,
  Trash2,
  Pencil,
  Copy,
  Share2,
  Info,
  Check,
  X,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  LoadingState,
  EmptyState,
  ErrorState,
  IconButton,
  FileDropzone,
} from '@/components/shared';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { FloatingInput } from '@/components/ui/floating-input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

// ============================================================
// Design tokens
// ============================================================

const RADIUS = {
  chip: 'rounded-full',
  input: 'rounded-lg',
  card: 'rounded-xl',
  dialog: 'rounded-2xl',
  skel: 'rounded',
} as const;

const MOTION = {
  // Explicit properties only — never transition-all.
  fast: 'transition-[color,background-color,border-color] duration-150 ease-in-out',
  smooth: 'transition-[border-color,box-shadow,transform] duration-200 ease-in-out',
  fade: 'animate-in fade-in duration-150',
  pulse: 'animate-pulse [animation-duration:2s] motion-reduce:animate-none',
  // Interactive card micro-interaction. Lift via --hover-lift (Minimal -2px / Expressive -4px).
  hoverCard: 'lift-on-hover',
} as const;

/** Stagger delay per index — cards arrive sequentially (50ms step). */
const stagger = (i: number): React.CSSProperties => ({ animationDelay: `${i * 50}ms` });

const ICON = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
} as const;

/**
 * Shadow scale — 3 levels only (Surface / Floating / Overlay).
 * "Border nhẹ > Shadow" — shadow chỉ dùng để tạo layer, không decoration.
 */
// Utility classes backed by CSS var — phản ứng [data-expressive] (Minimal glow-off / Expressive glow-on).
const SHADOW = {
  surface: 'elev-surface',
  floating: 'elev-floating',
  overlay: 'elev-overlay',
} as const;

const TEXT = {
  title: 'text-sm font-semibold tracking-tight text-foreground',
  subtitle: 'text-xs leading-relaxed text-muted-foreground',
  body: 'text-xs text-muted-foreground',
  label: 'text-xs font-medium text-muted-foreground',
  caption: 'text-xs text-muted-foreground/80',
  code: 'rounded bg-muted px-1.5 py-0.5 text-xs font-mono',
} as const;

const SECTION_GAP = 'space-y-12';

// ============================================================
// Main component — glass header + pill tabs + isolated toggle
// ============================================================

type TabId = 'loading' | 'empty' | 'error' | 'skeleton' | 'inputs' | 'overlays' | 'tokens' | 'composite';

const TABS: { id: TabId; label: string }[] = [
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
  { id: 'skeleton', label: 'Skeletons' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'composite', label: 'Composite' },
];

import { useThemeControls, THEMES } from '@/tools/theme';

export default function DesignSystemV2({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>('loading');

  const tabsList = (
    <TabsList className="h-auto w-max justify-start gap-1 bg-transparent p-0">
      {TABS.map((t) => (
        <TabsTrigger
          key={t.id}
          value={t.id}
          className={`${RADIUS.chip} px-3.5 py-1.5 text-xs font-medium text-muted-foreground/80 shadow-none ${MOTION.fast} data-[state=active]:bg-foreground/[0.08] data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-border/60`}
        >
          {t.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );

  const contentWrapClass = embedded ? SECTION_GAP : `mx-auto max-w-5xl ${SECTION_GAP} px-6 py-10`;

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabId)}>
      <div className={embedded ? '' : 'min-h-screen bg-background'}>
        {!embedded && (
          <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
              <Button variant="ghost" size="icon" asChild aria-label="Ve trang chu" className="h-11 w-11 sm:h-8 sm:w-8">
                <Link to="/">
                  <ArrowLeft className={ICON.sm} />
                </Link>
              </Button>
              <div className="flex flex-col leading-none">
                <h1 className="text-sm font-semibold text-foreground [letter-spacing:-0.03em]">Design System</h1>
                <span className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/60">
                  v2 · catalog
                </span>
              </div>
              <div className="ml-auto">
                <PreviewSettingsPopover />
              </div>
            </div>
            <div className="overflow-x-auto px-4 pb-3 sm:px-6">{tabsList}</div>
          </header>
        )}

        {embedded && (
          <div className="mb-6 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="overflow-x-auto">{tabsList}</div>
              <PreviewSettingsPopover />
            </div>
          </div>
        )}

        <div className={contentWrapClass}>
          <TabsContent value="loading" className="mt-0 space-y-12 focus-visible:outline-none"><LoadingSection /></TabsContent>
          <TabsContent value="empty" className="mt-0 space-y-12 focus-visible:outline-none"><EmptySection /></TabsContent>
          <TabsContent value="error" className="mt-0 space-y-12 focus-visible:outline-none"><ErrorSection /></TabsContent>
          <TabsContent value="skeleton" className="mt-0 space-y-12 focus-visible:outline-none"><SkeletonSection /></TabsContent>
          <TabsContent value="inputs" className="mt-0 space-y-12 focus-visible:outline-none"><InputsSection /></TabsContent>
          <TabsContent value="overlays" className="mt-0 space-y-12 focus-visible:outline-none"><OverlaysSection /></TabsContent>
          <TabsContent value="tokens" className="mt-0 space-y-12 focus-visible:outline-none"><TokensSection /></TabsContent>
          <TabsContent value="composite" className="mt-0 space-y-12 focus-visible:outline-none"><CompositeSection /></TabsContent>
        </div>
      </div>
    </Tabs>
  );
}

/** Preview Settings — theme/lift/corner controls in a popover (not on header). */
function PreviewSettingsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="mr-1.5 h-3.5 w-3.5" />
          Preview settings
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end">
        <ThemeControls />
      </PopoverContent>
    </Popover>
  );
}

function ThemeControls() {
  const tc = useThemeControls();

  const chip = (active: boolean, disabled = false) =>
    `${RADIUS.chip} px-2.5 py-1 text-xs font-medium ${MOTION.fast} ${
      disabled
        ? 'cursor-not-allowed text-muted-foreground opacity-40'
        : active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
    }`;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Palette className="h-3.5 w-3.5" /> Theme
        </p>
        <div className="flex flex-wrap gap-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => tc.setTheme(t.id)}
              className={chip(tc.theme === t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={tc.toggleLift} className={chip(tc.is3d)}>
          Lift
        </button>

        <button type="button" onClick={tc.toggleRounded} className={chip(tc.isRounded)}>
          Subtle
        </button>

        <button type="button" onClick={tc.togglePill} className={chip(tc.isPill)}>
          Pill
        </button>

        <button
          type="button"
          disabled={!tc.is3d}
          onClick={tc.toggleRetro}
          className={chip(tc.isRetro, !tc.is3d)}
        >
          Retro
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Atom components
// ============================================================

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 scroll-mt-24">
      {/* Thin accent bar left of title — structural depth cue, not decoration. */}
      <div className="space-y-1 border-l-2 border-primary/40 pl-3">
        <h2 className={TEXT.title}>{title}</h2>
        <p className={TEXT.subtitle}>{description}</p>
      </div>
      {children}
    </section>
  );
}

function SubgroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
        {children}
      </h3>
      <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
    </div>
  );
}

function PreviewCard({
  children,
  className = '',
  shimmer = false,
  fadeMask = false,
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  shimmer?: boolean;
  fadeMask?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={`relative ${RADIUS.card} border border-border/60 bg-card ${SHADOW.surface} p-5 ${MOTION.smooth} ${interactive ? 'cursor-pointer hover:border-border' : ''} ${shimmer ? 'overflow-hidden' : ''} ${className}`}
    >
      <div style={fadeMask ? { maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' } : undefined}>
        {children}
      </div>
      {shimmer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent motion-reduce:hidden"
        />
      )}
    </div>
  );
}

function IconBadge({
  icon: Icon,
  size = 'md',
  tone = 'muted',
}: {
  icon: LucideIcon;
  size?: 'sm' | 'md';
  tone?: 'muted' | 'destructive';
}) {
  const box = size === 'md' ? 'h-12 w-12' : 'h-9 w-9';
  const iconSize = size === 'md' ? ICON.md : ICON.sm;
  const bgClass = tone === 'destructive' ? 'bg-destructive/10' : 'bg-muted/60';
  const iconColor = tone === 'destructive' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className={`flex ${box} items-center justify-center ${RADIUS.chip} ${bgClass}`}>
      <Icon className={`${iconSize} ${iconColor}`} aria-hidden="true" />
    </div>
  );
}

function EmptyPreview({
  icon,
  title,
  description,
  action,
  size = 'md',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: 'sm' | 'md';
}) {
  const py = size === 'md' ? 'py-12' : 'py-8';
  const gap = size === 'md' ? 'gap-4' : 'gap-2.5';
  const titleClass = size === 'md'
    ? 'text-sm font-medium text-foreground'
    : 'text-xs font-medium text-foreground';
  return (
    <div className={`flex items-center justify-center ${py}`}>
      <div className={`flex max-w-xs flex-col items-center ${gap} text-center`}>
        <IconBadge icon={icon} size={size} />
        <div className="space-y-1">
          <p className={titleClass}>{title}</p>
          {description && <p className={TEXT.subtitle}>{description}</p>}
        </div>
        {action}
      </div>
    </div>
  );
}

function PulseDot({
  color,
  animated = false,
}: {
  color: 'success' | 'warning' | 'destructive' | 'muted';
  animated?: boolean;
}) {
  const colorClass = {
    success: 'bg-success',
    warning: 'bg-warning',
    destructive: 'bg-destructive',
    muted: 'bg-muted-foreground/30',
  }[color];
  return <div className={`h-2 w-2 ${RADIUS.chip} ${colorClass} ${animated ? MOTION.pulse : ''}`} />;
}

function AlphaSwatch({ value }: { value: 5 | 10 | 15 | 20 | 30 | 50 | 80 | 100 }) {
  const bg: Record<number, string> = {
    5: 'bg-primary/5',
    10: 'bg-primary/10',
    15: 'bg-primary/15',
    20: 'bg-primary/20',
    30: 'bg-primary/30',
    50: 'bg-primary/50',
    80: 'bg-primary/80',
    100: 'bg-primary',
  };
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className={`h-10 w-10 ${RADIUS.input} ${bg[value]}`} />
      <span className={TEXT.caption}>/{value}</span>
    </div>
  );
}

function TokenSwatch({ name, desc, bg }: { name: string; desc: string; bg: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(bg);
        toast.success(`Copied: ${bg}`);
      }}
      className={`group flex items-center gap-3 ${RADIUS.card} border border-border/60 bg-card p-3 text-left ${SHADOW.surface} ${MOTION.smooth} hover:border-border`}
    >
      <div className={`h-9 w-9 shrink-0 ${RADIUS.input} ${bg} ${MOTION.smooth} group-hover:scale-110`} />
      <div>
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </button>
  );
}

/**
 * Conic-gradient spinner with trail effect.
 * Smooth rotation, gradient fades from primary to transparent = "trail" feel.
 * Single div, no extra DOM. reduced-motion: stops spinning.
 */
function TrailSpinner({ size = 'h-5 w-5' }: { size?: string }) {
  return (
    <div
      className={`${size} animate-spin rounded-full motion-reduce:animate-none`}
      style={{
        background: 'conic-gradient(from 0deg, transparent 0%, transparent 30%, hsl(var(--primary)) 100%)',
        mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
        WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2px))',
      }}
    />
  );
}

// ============================================================
// Tab: Loading States
// ============================================================

function LoadingSection() {
  return (
    <>
      <SubgroupHeader>Spinners</SubgroupHeader>

      <Section
        title="System Spinner"
        description="Single spinner for all contexts: Suspense fallback, action feedback, inline loading. Conic-gradient trail, scale via h/w class."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Full-page (h-5 w-5)</p>
            <div className="flex h-32 items-center justify-center">
              <TrailSpinner size="h-5 w-5" />
            </div>
          </PreviewCard>
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Inline small (h-3.5 w-3.5)</p>
            <div className="flex h-32 items-center justify-center">
              <TrailSpinner size="h-3.5 w-3.5" />
            </div>
          </PreviewCard>
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Micro (h-3 w-3)</p>
            <div className="flex h-32 items-center justify-center">
              <TrailSpinner size="h-3 w-3" />
            </div>
          </PreviewCard>
        </div>
      </Section>

      <SubgroupHeader>Skeletons</SubgroupHeader>

      <Section
        title="LoadingState Skeleton Grid"
        description="List/grid content. Single shimmer beam sweeps across all blocks simultaneously."
      >
        <PreviewCard shimmer fadeMask>
          <LoadingState variant="skeleton" count={6} />
        </PreviewCard>
      </Section>

      <Section
        title="LoadingState Skeleton List"
        description="Vertical list items. Consistent height per row."
      >
        <PreviewCard shimmer fadeMask>
          <LoadingState variant="skeleton" layout="list" count={5} itemClassName="h-14" />
        </PreviewCard>
      </Section>

      <Section
        title="LoadingState Responsive Grid"
        description="Auto-fill columns capped at 2 visible rows. Adapts to viewport width."
      >
        <PreviewCard>
          <LoadingState
            variant="skeleton"
            count={30}
            maxRows={2}
            itemClassName="aspect-square h-auto w-full"
            className="grid gap-px bg-border/50"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}
          />
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Empty States
// ============================================================

function EmptySection() {
  return (
    <>
      <SubgroupHeader>Standard patterns</SubgroupHeader>

      <Section
        title="With primary CTA"
        description="First-time empty. Circular icon container, constrained description width, prominent CTA."
      >
        <PreviewCard>
          <EmptyPreview
            icon={FileText}
            title="No notes yet"
            description="Create your first note to start capturing ideas."
            action={
              <Button size="sm">
                <Plus className={`mr-1.5 ${ICON.sm}`} />
                Create note
              </Button>
            }
          />
        </PreviewCard>
      </Section>

      <Section
        title="No CTA (search / filter)"
        description="Zero results from search or filter. Guidance only, no action button."
      >
        <PreviewCard>
          <EmptyPreview
            icon={Search}
            title='No results for "quantum physics"'
            description="Try a different keyword or clear your filters."
          />
        </PreviewCard>
      </Section>

      <Section
        title="With secondary CTA"
        description="Empty collection with outline (secondary) action."
      >
        <PreviewCard>
          <EmptyPreview
            icon={Bookmark}
            title="No bookmarks"
            description="Save your favorite films, anime, and manga here."
            action={
              <Button size="sm" variant="outline">
                <Plus className={`mr-1.5 ${ICON.sm}`} />
                Add item
              </Button>
            }
          />
        </PreviewCard>
      </Section>

      <SubgroupHeader>Compact variants</SubgroupHeader>

      <Section
        title="Sidebar & panels"
        description="Reduced padding for narrow containers (sidebars, popover panels)."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PreviewCard>
            <EmptyPreview size="sm" icon={Inbox} title="Empty" />
          </PreviewCard>
          <PreviewCard>
            <EmptyPreview
              size="sm"
              icon={Users}
              title="No users"
              description="Create one in Settings."
            />
          </PreviewCard>
        </div>
      </Section>

      <Section
        title="Icon variations"
        description="Different context icons maintaining the same visual weight."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Music, label: 'No audio' },
            { icon: BookOpen, label: 'Library empty' },
            { icon: MessageSquare, label: 'No messages' },
            { icon: LayoutDashboard, label: 'No widgets' },
          ].map(({ icon, label }) => (
            <PreviewCard key={label}>
              <EmptyPreview size="sm" icon={icon} title={label} />
            </PreviewCard>
          ))}
        </div>
      </Section>

      <SubgroupHeader>Shared component</SubgroupHeader>

      <Section
        title="Using EmptyState from @/components/shared"
        description="Actual API preserved. Compare rendering with the ideal patterns above."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PreviewCard>
            <EmptyState
              icon={FileText}
              title="No notes yet"
              description="Create your first note to get started."
              action={
                <Button size="sm">
                  <Plus className={`mr-1.5 ${ICON.sm}`} />
                  Create
                </Button>
              }
            />
          </PreviewCard>
          <PreviewCard>
            <EmptyState compact icon={Inbox} title="Empty" />
          </PreviewCard>
        </div>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Error States
// ============================================================

function ErrorSection() {
  return (
    <>
      <SubgroupHeader>Shared component variants</SubgroupHeader>

      <Section
        title="With retry"
        description="Query failure with actionable retry. Destructive surface, icon visually distinct."
      >
        <PreviewCard>
          <ErrorState
            message="Unable to load data. Check your connection and try again."
            onRetry={() => {}}
          />
        </PreviewCard>
      </Section>

      <Section
        title="Without retry"
        description="Permission errors or unrecoverable states. No action available."
      >
        <PreviewCard>
          <ErrorState message="You don't have permission to access this resource." />
        </PreviewCard>
      </Section>

      <Section
        title="Custom retry label"
        description="Context-specific retry action label."
      >
        <PreviewCard>
          <ErrorState
            message="Upload failed. File exceeds the 50MB limit."
            onRetry={() => {}}
            retryLabel="Choose another file"
          />
        </PreviewCard>
      </Section>

      <Section
        title="Compact"
        description="Inline errors for cards and small panels. Reduced padding and font size."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <PreviewCard>
            <ErrorState compact message="Failed to load cover image" onRetry={() => {}} />
          </PreviewCard>
          <PreviewCard>
            <ErrorState compact message="Sync failed" />
          </PreviewCard>
        </div>
      </Section>

      <Section
        title="Long message"
        description="Technical error messages needing word-wrap. Contained width."
      >
        <PreviewCard className="max-w-lg">
          <ErrorState
            message="TypeError: Cannot read properties of undefined (reading 'map'). This usually happens when the API returns an unexpected response format. Check server logs and try again."
            onRetry={() => {}}
          />
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Skeleton Patterns
// ============================================================

function SkeletonSection() {
  return (
    <>
      <SubgroupHeader>Cards & content</SubgroupHeader>

      <Section
        title="Book cards (Library)"
        description="Match Library grid footprint. Cover aspect 3:4, title and author lines below."
      >
        <PreviewCard shimmer fadeMask>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className={`aspect-[3/4] w-full ${RADIUS.input}`} />
                <Skeleton className={`h-3 w-3/4 ${RADIUS.skel}`} />
                <Skeleton className={`h-2.5 w-1/2 ${RADIUS.skel}`} />
              </div>
            ))}
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Detail card"
        description="Single card with title, body lines, and tag badges."
      >
        <PreviewCard shimmer className="max-w-sm">
          <div className="space-y-3">
            <Skeleton className={`h-5 w-3/4 ${RADIUS.skel}`} />
            <Skeleton className={`h-3 w-full ${RADIUS.skel}`} />
            <Skeleton className={`h-3 w-2/3 ${RADIUS.skel}`} />
            <div className="flex gap-2 pt-2">
              <Skeleton className={`h-6 w-16 ${RADIUS.chip}`} />
              <Skeleton className={`h-6 w-20 ${RADIUS.chip}`} />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Widget cards (Home)"
        description="Home widget placeholders. Header with icon, content block, meta row."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <PreviewCard key={i} shimmer>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className={`h-4 w-24 ${RADIUS.skel}`} />
                  <Skeleton className={`h-4 w-4 ${RADIUS.skel}`} />
                </div>
                <Skeleton className={`h-16 w-full ${RADIUS.input}`} />
                <div className="flex gap-2">
                  <Skeleton className={`h-3 w-16 ${RADIUS.skel}`} />
                  <Skeleton className={`h-3 w-12 ${RADIUS.skel}`} />
                </div>
              </div>
            </PreviewCard>
          ))}
        </div>
      </Section>

      <SubgroupHeader>UI components</SubgroupHeader>

      <Section
        title="Stats / badge row"
        description="Compact inline info storage badges, stat counters."
      >
        <PreviewCard shimmer className="max-w-md">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className={`h-4 w-4 ${RADIUS.chip}`} />
              <Skeleton className={`h-3 w-24 ${RADIUS.skel}`} />
              <Skeleton className={`h-2 w-16 ${RADIUS.chip}`} />
              <Skeleton className={`h-3 w-12 ${RADIUS.skel}`} />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className={`h-4 w-4 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-32 ${RADIUS.skel}`} />
              <Skeleton className={`h-5 w-14 ${RADIUS.chip}`} />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Sidebar navigation"
        description="Matches tool list in sidebar. Icon + label per row."
      >
        <PreviewCard shimmer fadeMask className="w-56">
          <div className="space-y-1">
            {[72, 55, 88, 60, 45, 78, 50, 65].map((w, i) => (
              <div key={i} className={`flex items-center gap-2.5 px-2 py-1.5 ${RADIUS.input}`}>
                <Skeleton className={`h-4 w-4 ${RADIUS.skel}`} />
                <Skeleton className={`h-3 ${RADIUS.skel}`} style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Form fields"
        description="Label + input + textarea + submit button."
      >
        <PreviewCard shimmer className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-20 ${RADIUS.skel}`} />
              <Skeleton className={`h-9 w-full ${RADIUS.input}`} />
            </div>
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-16 ${RADIUS.skel}`} />
              <Skeleton className={`h-9 w-full ${RADIUS.input}`} />
            </div>
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-24 ${RADIUS.skel}`} />
              <Skeleton className={`h-24 w-full ${RADIUS.input}`} />
            </div>
            <Skeleton className={`h-9 w-28 ${RADIUS.input}`} />
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Complex layouts</SubgroupHeader>

      <Section
        title="Chat messages"
        description="RAG chat bubbles. User right-aligned, AI left-aligned with multi-line."
      >
        <PreviewCard shimmer className="max-w-md">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Skeleton className={`h-8 w-48 ${RADIUS.card}`} />
            </div>
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-full ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-5/6 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-2/3 ${RADIUS.skel}`} />
            </div>
            <div className="flex justify-end">
              <Skeleton className={`h-8 w-32 ${RADIUS.card}`} />
            </div>
            <div className="space-y-1.5">
              <Skeleton className={`h-3 w-3/4 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-1/2 ${RADIUS.skel}`} />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Audio player"
        description="Floating audio window footprint. Cover art, progress bar, controls."
      >
        <PreviewCard shimmer className="max-w-sm">
          <div className="flex items-center gap-3">
            <Skeleton className={`h-10 w-10 shrink-0 ${RADIUS.input}`} />
            <div className="flex-1 space-y-1.5">
              <Skeleton className={`h-3 w-3/4 ${RADIUS.skel}`} />
              <Skeleton className={`h-2 w-full ${RADIUS.chip}`} />
              <div className="flex justify-between">
                <Skeleton className={`h-2.5 w-8 ${RADIUS.skel}`} />
                <Skeleton className={`h-2.5 w-8 ${RADIUS.skel}`} />
              </div>
            </div>
            <Skeleton className={`h-8 w-8 ${RADIUS.chip}`} />
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Table rows"
        description="Data table with header and rows. Consistent column widths."
      >
        <PreviewCard shimmer fadeMask>
          <div className="space-y-1">
            <div className="flex gap-4 border-b border-border/50 pb-2">
              <Skeleton className={`h-3 w-24 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-32 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-16 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-20 ${RADIUS.skel}`} />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-2">
                <Skeleton className={`h-3 w-24 ${RADIUS.skel}`} />
                <Skeleton className={`h-3 w-32 ${RADIUS.skel}`} />
                <Skeleton className={`h-3 w-16 ${RADIUS.skel}`} />
                <Skeleton className={`h-3 w-20 ${RADIUS.skel}`} />
              </div>
            ))}
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Modal / dialog"
        description="Dialog body skeleton. Header, content block, footer actions."
      >
        <PreviewCard shimmer className="max-w-sm">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className={`h-5 w-2/3 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-full ${RADIUS.skel}`} />
            </div>
            <div className="space-y-2 border-t border-border/50 pt-4">
              <Skeleton className={`h-3 w-full ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-5/6 ${RADIUS.skel}`} />
              <Skeleton className={`h-3 w-4/6 ${RADIUS.skel}`} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
              <Skeleton className={`h-9 w-20 ${RADIUS.input}`} />
              <Skeleton className={`h-9 w-24 ${RADIUS.input}`} />
            </div>
          </div>
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Inputs (modern patterns — floating labels, validation, file upload)
// ============================================================

function InputsSection() {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    float_name: '',
    float_email: '',
    float_password: '',
    val_email: 'user@example.com',
    val_empty: '',
    val_error: 'not-an-email',
    char_bio: '',
    search_q: '',
  });
  const [showPw, setShowPw] = useState(false);
  const [btnLoading, setBtnLoading] = useState<string | null>(null);
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
  }, []);

  function updateField(key: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  }

  function simulateLoading(id: string) {
    if (btnLoading) return;
    setBtnLoading(id);
    loadingTimerRef.current = setTimeout(() => setBtnLoading(null), 2000);
  }

  return (
    <>
      <SubgroupHeader>Floating label inputs</SubgroupHeader>

      <Section
        title="Animated float label"
        description="Label starts as placeholder, floats up on focus/fill. Border animates from muted to primary. Modern SaaS pattern (Linear, Vercel)."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-5">
            <FloatingInput
              id="float_name"
              label="Full name"
              value={fieldValues.float_name}
              onChange={(e) => updateField('float_name', e.target.value)}
            />
            <FloatingInput
              id="float_email"
              label="Email address"
              type="email"
              icon={<Mail className="h-4 w-4" />}
              value={fieldValues.float_email}
              onChange={(e) => updateField('float_email', e.target.value)}
            />
            <FloatingInput
              id="float_password"
              label="Password"
              type={showPw ? 'text' : 'password'}
              icon={<Lock className="h-4 w-4" />}
              value={fieldValues.float_password}
              onChange={(e) => updateField('float_password', e.target.value)}
              trailing={
                <IconButton
                  icon={showPw ? EyeOff : Eye}
                  label={showPw ? 'An mat khau' : 'Hien mat khau'}
                  onClick={() => setShowPw(!showPw)}
                  className="h-6 w-6"
                  iconClassName="h-4 w-4"
                />
              }
            />
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Inline validation</SubgroupHeader>

      <Section
        title="Real-time validation states"
        description="Validate on blur. Success = green check + border. Error = red border + helper message. Neutral = default."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-5">
            {/* Success state */}
            <div className="space-y-1.5">
              <label className={TEXT.label}>Email (valid)</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <input
                  type="email"
                  value={fieldValues.val_email}
                  readOnly
                  className="flex h-10 w-full border border-success/50 bg-background pl-9 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-success/50"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-success/15">
                  <Check className="h-3 w-3 text-success" />
                </div>
              </div>
            </div>

            {/* Error state */}
            <div className="space-y-1.5">
              <label className={TEXT.label}>Email (invalid)</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive/70`} />
                <input
                  type="email"
                  value={fieldValues.val_error}
                  readOnly
                  aria-invalid="true"
                  aria-describedby="val-error-msg"
                  className="flex h-10 w-full border border-destructive/50 bg-destructive/5 pl-9 pr-10 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive/30"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive/15">
                  <X className="h-3 w-3 text-destructive" />
                </div>
              </div>
              <p id="val-error-msg" className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> Please enter a valid email address
              </p>
            </div>

            {/* Neutral (untouched) */}
            <div className="space-y-1.5">
              <label className={TEXT.label}>Email (untouched)</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`} />
                <Input type="email" placeholder="you@company.com" className="h-10 pl-9" />
              </div>
              <p className="text-xs text-muted-foreground">We'll never share your email.</p>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Character counter + helper</SubgroupHeader>

      <Section
        title="Textarea with character limit"
        description="Real-time character counter. Warning color near limit. Helper text below for guidance."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-1.5">
            <label className={TEXT.label}>Bio</label>
            <Textarea
              value={fieldValues.char_bio}
              onChange={(e) => updateField('char_bio', e.target.value.slice(0, 160))}
              placeholder="Tell us about yourself..."
              rows={3}
              className={fieldValues.char_bio.length > 140 ? 'border-warning/50' : undefined}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Short description for your profile.</p>
              <p className={`text-xs tabular-nums ${
                fieldValues.char_bio.length > 140
                  ? 'text-warning font-medium'
                  : 'text-muted-foreground'
              }`}>
                {fieldValues.char_bio.length}/160
              </p>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Search input</SubgroupHeader>

      <Section
        title="Search with clear affordance"
        description="Leading search icon. Trailing X button appears when field has value. Keyboard shortcut hint badge."
      >
        <PreviewCard className="max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={fieldValues.search_q}
              onChange={(e) => updateField('search_q', e.target.value)}
              placeholder="Search..."
              className="flex h-10 w-full border border-input bg-background pl-9 pr-20 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {fieldValues.search_q && (
                <button
                  type="button"
                  onClick={() => updateField('search_q', '')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
              <kbd className="hidden sm:inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                /
              </kbd>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>File upload</SubgroupHeader>

      <Section
        title="Drag & drop upload zone"
        description="Dashed border dropzone with real file input. Click/Enter/Space open the OS file picker via native label behavior."
      >
        <PreviewCard className="max-w-md">
          <FileDropzone
            accept="application/pdf,image/png,image/jpeg"
            hint="PDF, PNG, JPG up to 10MB"
            onFilesSelected={(files) => toast.success(`Selected ${files.length} file(s)`)}
          />

          {/* Uploaded file preview */}
          <div className="mt-4 space-y-2">
            <p className={TEXT.label}>Uploaded</p>
            <div className="flex items-center gap-3 border border-border bg-muted/30 p-3">
              <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10">
                <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">document-final.pdf</p>
                <p className={TEXT.caption}>2.4 MB</p>
              </div>
              <IconButton icon={Trash2} label="Xoa file" tone="destructive" />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Button states</SubgroupHeader>

      <Section
        title="Loading + success states"
        description="Button shows spinner during mutation. Transitions to success check on complete. Disabled while loading."
      >
        <PreviewCard>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" disabled={btnLoading !== null} onClick={() => simulateLoading('save')} className="w-[120px]">
              {btnLoading === 'save' ? <LoadingState variant="inline" label="Saving..." /> : 'Save changes'}
            </Button>

            <Button size="sm" variant="destructive" disabled={btnLoading !== null} onClick={() => simulateLoading('delete')} className="w-[90px]">
              {btnLoading === 'delete' ? <LoadingState variant="inline" label="Xoa..." /> : 'Delete'}
            </Button>

            <Button size="sm" variant="outline" disabled>
              <LoadingState variant="inline" label="Processing" />
            </Button>

            <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" disabled>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Saved
            </Button>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Input group (composite)</SubgroupHeader>

      <Section
        title="Input with attached button"
        description="Input + button as one visual unit. Shared border, no gap. Used for subscribe, invite by email, etc."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Subscribe to updates</label>
              <div className="flex">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="flex h-10 w-full border border-r-0 border-input bg-background pl-9 pr-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary focus-visible:z-10 relative"
                  />
                </div>
                <Button className="rounded-none border border-l-0 border-input shadow-sm">
                  Subscribe
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className={TEXT.label}>Invite team member</label>
              <div className="flex">
                <input
                  type="email"
                  placeholder="colleague@work.com"
                  className="flex h-10 flex-1 border border-r-0 border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary focus-visible:z-10 relative"
                />
                <Button size="sm" className="h-10 rounded-none border border-l-0 border-input px-4">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Invite
                </Button>
              </div>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Checkbox & Select</SubgroupHeader>

      <Section
        title="Checkbox states"
        description="Radix Checkbox — vuong vuc (khong bo tron khi Pill/Rounded mode). States: default, checked, disabled, disabled+checked."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="ck-default" />
              <label htmlFor="ck-default" className="text-sm text-foreground">Default (unchecked)</label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="ck-checked" defaultChecked />
              <label htmlFor="ck-checked" className="text-sm text-foreground">Checked</label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="ck-disabled" disabled />
              <label htmlFor="ck-disabled" className="text-sm text-muted-foreground">Disabled</label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="ck-disabled-checked" disabled defaultChecked />
              <label htmlFor="ck-disabled-checked" className="text-sm text-muted-foreground">Disabled + checked</label>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Switch & Radio</SubgroupHeader>

      <Section
        title="Switch"
        description="Radix Switch — toggle on/off tuc thi. Dung cho bat/tat setting (khac Checkbox dung cho chon nhieu)."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch id="sw-on" defaultChecked />
              <label htmlFor="sw-on" className="text-sm text-foreground">On</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sw-off" />
              <label htmlFor="sw-off" className="text-sm text-foreground">Off</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sw-dis-on" disabled defaultChecked />
              <label htmlFor="sw-dis-on" className="text-sm text-muted-foreground">Disabled (on)</label>
            </div>
            <div className="flex items-center gap-3">
              <Switch id="sw-dis-off" disabled />
              <label htmlFor="sw-dis-off" className="text-sm text-muted-foreground">Disabled (off)</label>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Radio group"
        description="Radix RadioGroup — chon 1 trong nhieu. Arrow Up/Down dieu huong, chi 1 tab stop."
      >
        <PreviewCard className="max-w-md">
          <RadioGroup defaultValue="comfortable">
            {[
              { value: 'default', label: 'Default spacing' },
              { value: 'comfortable', label: 'Comfortable spacing' },
              { value: 'compact', label: 'Compact spacing' },
            ].map((o) => (
              <div key={o.value} className="flex items-center gap-3">
                <RadioGroupItem value={o.value} id={`rg-${o.value}`} />
                <label htmlFor={`rg-${o.value}`} className="text-sm text-foreground">
                  {o.label}
                </label>
              </div>
            ))}
          </RadioGroup>
        </PreviewCard>
      </Section>

      <Section
        title="Select (styled dropdown)"
        description="Radix Select — custom styled form dropdown. Dung khi can scroll, grouped options, custom render. Native select dung SelectField cho case don gian."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Category</label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="design">Design</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Priority</label>
              <Select defaultValue="medium">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Disabled</label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Cannot change" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="x">X</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>All states at a glance</SubgroupHeader>

      <Section
        title="Input field state matrix"
        description="Every state an input can be in. Verify visual distinction between each."
      >
        <PreviewCard>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className={TEXT.caption}>Default</p>
              <input
                placeholder="Placeholder text"
                className="flex h-10 w-full border border-input bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Hover</p>
              <input
                placeholder="Hover state"
                className="flex h-10 w-full border border-muted-foreground/50 bg-background px-3 text-sm shadow-sm placeholder:text-muted-foreground"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Focused</p>
              <input
                defaultValue="Typing here..."
                className="flex h-10 w-full border border-primary bg-background px-3 text-sm shadow-sm ring-1 ring-ring"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Filled</p>
              <input
                defaultValue="john@example.com"
                className="flex h-10 w-full border border-input bg-background px-3 text-sm shadow-sm text-foreground"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Success</p>
              <input
                defaultValue="Valid input"
                className="flex h-10 w-full border border-success/50 bg-success/5 px-3 text-sm shadow-sm text-foreground"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Error</p>
              <input
                defaultValue="Invalid"
                className="flex h-10 w-full border border-destructive/50 bg-destructive/5 px-3 text-sm shadow-sm text-foreground"
                readOnly
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Disabled</p>
              <input
                defaultValue="Cannot edit"
                disabled
                className="flex h-10 w-full border border-input bg-muted px-3 text-sm shadow-sm text-muted-foreground opacity-60 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <p className={TEXT.caption}>Read-only</p>
              <input
                defaultValue="Read only"
                readOnly
                className="flex h-10 w-full border border-input bg-muted/50 px-3 text-sm shadow-sm text-foreground cursor-default"
              />
            </div>
          </div>
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Overlays (Dropdown, Dialog, Tooltip)
// ============================================================

function OverlaysSection() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <SubgroupHeader>Dropdown / Context menu</SubgroupHeader>

      <Section
        title="3-dot actions menu"
        description="Radix DropdownMenu — menu semantics, Arrow Up/Down, Escape. Used for book cards, list items."
      >
        <PreviewCard className="flex items-start gap-8">
          <div className="space-y-2">
            <p className={TEXT.label}>Default</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton icon={MoreVertical} label="Actions" variant="outline" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><Pencil className="h-3.5 w-3.5" /> Rename</DropdownMenuItem>
                <DropdownMenuItem><Copy className="h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                <DropdownMenuItem><Download className="h-3.5 w-3.5" /> Export</DropdownMenuItem>
                <DropdownMenuItem><Share2 className="h-3.5 w-3.5" /> Share</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="space-y-2">
            <p className={TEXT.label}>With disabled item</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Options <ChevronDown className="ml-1 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem><Pencil className="h-3.5 w-3.5" /> Edit</DropdownMenuItem>
                <DropdownMenuItem><Copy className="h-3.5 w-3.5" /> Duplicate</DropdownMenuItem>
                <DropdownMenuItem disabled><Share2 className="h-3.5 w-3.5" /> Share (coming soon)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive><Trash2 className="h-3.5 w-3.5" /> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Dropdown anatomy"
        description="Item structure: icon (h-3.5 w-3.5) + label. Hover = bg change. Danger items in destructive color. Separator between groups."
      >
        <PreviewCard className="max-w-xs">
          <div className="w-44 border border-border bg-card py-1 text-xs text-foreground shadow-lg">
            <DropdownItem icon={Pencil} label="Rename" />
            <DropdownItem icon={Copy} label="Duplicate" />
            <DropdownItem icon={Download} label="Export" />
            <div className="my-1 border-t border-border" />
            <DropdownItem icon={Trash2} label="Delete" danger />
          </div>
          <p className={`mt-3 ${TEXT.caption}`}>
            Static render (no trigger). Shows item layout, spacing, separator, danger style.
          </p>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Dialog / Modal</SubgroupHeader>

      <Section
        title="Standard dialog"
        description="shadcn Dialog. Centered, overlay bg-black/80, content bg-card, close X top-right. Max-width variants."
      >
        <PreviewCard>
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
            <Button size="sm" variant="outline" onClick={() => setConfirmOpen(true)}>
              Confirm action
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create new item</DialogTitle>
                <DialogDescription>
                  Fill in the details below to add a new item to your collection.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <label className={TEXT.label}>Title</label>
                  <Input placeholder="Enter title..." />
                </div>
                <div className="space-y-1.5">
                  <label className={TEXT.label}>Description</label>
                  <Textarea placeholder="Optional description..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => setDialogOpen(false)}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete item?</DialogTitle>
                <DialogDescription>
                  This action cannot be undone. The item will be permanently removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(false)}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </PreviewCard>
      </Section>

      <Section
        title="Dialog skeleton (loading body)"
        description="Dialog body shows skeleton while content loads. Header visible immediately."
      >
        <PreviewCard className="max-w-md">
          <div className="border border-border bg-card p-6 shadow-lg">
            <div className="space-y-1.5">
              <p className="text-lg font-semibold leading-none tracking-tight">Loading content</p>
              <p className="text-sm text-muted-foreground">Please wait...</p>
            </div>
            <div className="space-y-3 py-4">
              <Skeleton className={`h-4 w-3/4 ${RADIUS.skel}`} />
              <Skeleton className={`h-4 w-full ${RADIUS.skel}`} />
              <Skeleton className={`h-4 w-5/6 ${RADIUS.skel}`} />
              <Skeleton className={`h-9 w-full ${RADIUS.input}`} />
              <Skeleton className={`h-9 w-full ${RADIUS.input}`} />
            </div>
            <div className="flex justify-end gap-2">
              <Skeleton className={`h-9 w-20 ${RADIUS.input}`} />
              <Skeleton className={`h-9 w-24 ${RADIUS.input}`} />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Tooltip</SubgroupHeader>

      <Section
        title="Standard tooltip"
        description="Radix Tooltip. Appears on hover with short delay. Used for icon-only buttons."
      >
        <PreviewCard>
          <div className="flex items-center gap-4">
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Info className={ICON.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">More information</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Download className={ICON.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Download file</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" className="h-9 w-9">
                    <Trash2 className={ICON.sm} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Delete item</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <span className={TEXT.caption}>Hover each button to see tooltip position</span>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Popover (form inside)</SubgroupHeader>

      <Section
        title="Popover with form"
        description="Popover containing a small form. Stays open until submit/close. Used for quick-edit, filters."
      >
        <PreviewCard>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className={`mr-1.5 ${ICON.sm}`} />
                Quick add
              </Button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Add item</p>
                  <div className="space-y-1.5">
                    <label className={TEXT.label}>Name</label>
                    <Input placeholder="Item name..." className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1.5">
                    <label className={TEXT.label}>Category</label>
                    <div className="relative">
                      <select
                        className="flex h-8 w-full appearance-none border border-input bg-background px-3 py-1 pr-8 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        defaultValue=""
                      >
                        <option value="" disabled>Select...</option>
                        <option value="a">Category A</option>
                        <option value="b">Category B</option>
                      </select>
                      <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none`} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <PopoverClose asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Cancel</Button>
                    </PopoverClose>
                    <Button size="sm" className="h-7 text-xs">Add</Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
        </PreviewCard>
      </Section>
    </>
  );
}

/** Dropdown menu item */
function DropdownItem({
  icon: Icon,
  label,
  danger = false,
  disabled = false,
}: {
  icon: typeof Download;
  label: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left ${
        disabled
          ? 'cursor-not-allowed text-muted-foreground opacity-50'
          : danger
            ? 'text-destructive hover:bg-destructive/10'
            : 'hover:bg-muted'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ============================================================
// Tab: Theme Tokens
// ============================================================

function TokensSection() {
  return (
    <>
      <SubgroupHeader>Colors</SubgroupHeader>

      <Section
        title="Semantic colors"
        description="Token-based colors. Never use hardcoded Tailwind shades (bg-blue-500, text-green-600)."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TokenSwatch name="primary" desc="CTA, active, brand" bg="bg-primary" />
          <TokenSwatch name="primary/15" desc="Soft highlight surface" bg="bg-primary/15" />
          <TokenSwatch name="destructive" desc="Error, delete, danger" bg="bg-destructive" />
          <TokenSwatch name="destructive/10" desc="Error surface soft" bg="bg-destructive/10" />
          <TokenSwatch name="success" desc="Complete, profit, connected" bg="bg-success" />
          <TokenSwatch name="success/10" desc="Success surface soft" bg="bg-success/10" />
          <TokenSwatch name="warning" desc="Pending, conflict, caution" bg="bg-warning" />
          <TokenSwatch name="warning/10" desc="Warning surface soft" bg="bg-warning/10" />
        </div>
      </Section>

      <Section
        title="Alpha scale"
        description="Opacity variants of primary. Static Tailwind classes (safe for JIT)."
      >
        <PreviewCard>
          <div className="flex flex-wrap gap-3">
            <AlphaSwatch value={5} />
            <AlphaSwatch value={10} />
            <AlphaSwatch value={15} />
            <AlphaSwatch value={20} />
            <AlphaSwatch value={30} />
            <AlphaSwatch value={50} />
            <AlphaSwatch value={80} />
            <AlphaSwatch value={100} />
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Text hierarchy"
        description="Semantic text colors. Hierarchy comes from spacing + weight, not size."
      >
        <PreviewCard>
          <div className="space-y-2.5">
            {[
              { name: 'foreground', desc: 'Primary text', className: 'text-foreground' },
              { name: 'muted-foreground', desc: 'Secondary / helper', className: 'text-muted-foreground' },
              { name: 'primary', desc: 'Brand / link', className: 'text-primary' },
              { name: 'destructive', desc: 'Error', className: 'text-destructive' },
              { name: 'success', desc: 'Positive', className: 'text-success' },
              { name: 'warning', desc: 'Caution', className: 'text-warning' },
            ].map((t) => (
              <div key={t.name} className="flex items-baseline gap-3">
                <span className={`text-sm font-medium ${t.className}`}>
                  The quick brown fox {t.name}
                </span>
                <span className={TEXT.caption}>{t.desc}</span>
              </div>
            ))}
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Structure</SubgroupHeader>

      <Section
        title="Surfaces"
        description="Background levels. Each surface has a defined role in the elevation hierarchy."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { name: 'background', desc: 'Page base', className: 'bg-background' },
            { name: 'card', desc: 'Elevated card', className: 'bg-card shadow-xs' },
            { name: 'popover', desc: 'Dropdown/popover', className: 'bg-popover shadow-sm' },
            { name: 'muted', desc: 'Disabled/subtle', className: 'bg-muted' },
          ].map((t) => (
            <div
              key={t.name}
              className={`flex h-20 flex-col items-center justify-center ${RADIUS.card} ${t.className}`}
            >
              <p className="text-xs font-medium text-foreground">{t.name}</p>
              <p className={TEXT.caption}>{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Elevation system"
        description="3 semantic levels only: Surface / Floating / Overlay. Never use arbitrary shadow-xxl."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: 'Surface', desc: 'Cards, panels', className: `bg-card ${SHADOW.surface}` },
            { name: 'Floating', desc: 'Dropdowns, popovers', className: `bg-card ${SHADOW.floating}` },
            { name: 'Overlay', desc: 'Dialogs, modals', className: `bg-card ${SHADOW.overlay}` },
          ].map((t) => (
            <div
              key={t.name}
              className={`flex h-24 flex-col items-center justify-center ${RADIUS.card} ${t.className}`}
            >
              <p className="text-xs font-semibold text-foreground">{t.name}</p>
              <p className={TEXT.caption}>{t.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Radius scale"
        description="Consistent rounding. Cards=xl, buttons=lg, chips/avatars=full, dialogs=2xl."
      >
        <PreviewCard>
          <div className="flex flex-wrap items-end gap-4">
            {[
              { name: 'rounded', className: 'rounded' },
              { name: 'rounded-lg (input)', className: RADIUS.input },
              { name: 'rounded-xl (card)', className: RADIUS.card },
              { name: 'rounded-2xl (dialog)', className: RADIUS.dialog },
            ].map((r) => (
              <div key={r.name} className="flex flex-col items-center gap-1.5">
                <div className={`h-12 w-20 bg-muted ${r.className}`} />
                <span className={TEXT.caption}>{r.name}</span>
              </div>
            ))}
            <div className="flex flex-col items-center gap-1.5">
              <div className={`h-12 w-12 bg-muted ${RADIUS.chip}`} />
              <span className={TEXT.caption}>full (chip)</span>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Border & ring"
        description="Use borders sparingly inputs, tables, dividers, selected states only."
      >
        <PreviewCard>
          <div className="flex flex-wrap gap-4">
            <div className={`flex h-16 w-32 items-center justify-center ${RADIUS.card} border border-border`}>
              <span className={TEXT.body}>border</span>
            </div>
            <div className={`flex h-16 w-32 items-center justify-center ${RADIUS.card} border-2 border-input`}>
              <span className={TEXT.body}>input</span>
            </div>
            <div className={`flex h-16 w-32 items-center justify-center ${RADIUS.card} ring-2 ring-ring`}>
              <span className={TEXT.body}>ring (focus)</span>
            </div>
            <div className={`flex h-16 w-32 items-center justify-center ${RADIUS.card} ring-2 ring-primary`}>
              <span className={TEXT.body}>ring-primary</span>
            </div>
          </div>
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Tab: Composite (state flow + interaction demos)
// ============================================================

function CompositeSection() {
  const [demoState, setDemoState] = useState<'loading' | 'data' | 'empty' | 'error'>('loading');

  return (
    <>
      <SubgroupHeader>State flow</SubgroupHeader>

      <Section
        title="State toggle"
        description="Switch between 4 states. Content crossfades. Verify no layout shift (CLS)."
      >
        <div className="mb-4 flex gap-1.5">
          {(['loading', 'data', 'empty', 'error'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setDemoState(s)}
              className={`${RADIUS.chip} px-3 py-1.5 text-xs font-medium capitalize ${MOTION.fast} ${
                demoState === s
                  ? 'bg-foreground/10 text-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className={`min-h-[320px] overflow-hidden ${RADIUS.card} bg-muted/40 p-6 shadow-xs`}>
          <div key={demoState} className={MOTION.fade}>
            {demoState === 'loading' && (
              <div style={{ maskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)' }}>
                <LoadingState variant="skeleton" count={9} />
              </div>
            )}
            {demoState === 'data' && <DemoDataGrid />}
            {demoState === 'empty' && (
              <EmptyPreview
                icon={Inbox}
                title="No items yet"
                description="Add your first item to get started."
                action={
                  <Button size="sm">
                    <Plus className={`mr-1.5 ${ICON.sm}`} />
                    Add item
                  </Button>
                }
              />
            )}
            {demoState === 'error' && (
              <div className={`flex items-start gap-3 ${RADIUS.input} bg-destructive/5 p-4`}>
                <IconBadge icon={AlertCircle} size="sm" tone="destructive" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm text-foreground">Unable to load data</p>
                  <p className={TEXT.subtitle}>Server returned 500. This might be temporary.</p>
                  <Button size="sm" variant="outline" className="text-xs" onClick={() => setDemoState('loading')}>
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Section>

      <Section
        title="Skeleton vs data"
        description="Side-by-side to verify skeleton footprint exactly matches final content. Zero CLS."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className={TEXT.label}>Loading</p>
            <PreviewCard>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className={`h-10 w-10 ${RADIUS.chip}`} />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className={`h-4 w-3/4 ${RADIUS.skel}`} />
                    <Skeleton className={`h-3 w-1/2 ${RADIUS.skel}`} />
                  </div>
                </div>
                <Skeleton className={`h-3 w-full ${RADIUS.skel}`} />
                <Skeleton className={`h-3 w-5/6 ${RADIUS.skel}`} />
                <div className="flex gap-2 pt-1">
                  <Skeleton className={`h-6 w-16 ${RADIUS.chip}`} />
                  <Skeleton className={`h-6 w-12 ${RADIUS.chip}`} />
                </div>
              </div>
            </PreviewCard>
          </div>
          <div className="space-y-2">
            <p className={TEXT.label}>Loaded</p>
            <PreviewCard>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center ${RADIUS.chip} bg-primary/15 text-sm font-semibold text-primary`}>
                    BN
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Bao Nguyen</p>
                    <p className={TEXT.body}>baobibo</p>
                  </div>
                </div>
                <p className={TEXT.subtitle}>
                  Senior Developer working on BiBo Hub. Library management and productivity tools.
                </p>
                <div className="flex gap-2 pt-1">
                  <Badge variant="success">admin</Badge>
                  <Badge variant="primary">active</Badge>
                </div>
              </div>
            </PreviewCard>
          </div>
        </div>
      </Section>

      <SubgroupHeader>Interaction states</SubgroupHeader>

      <Section
        title="Card states"
        description="Every interactive card: default, hover (lift + shadow), focused, disabled. Hover to test."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            className={`cursor-pointer ${RADIUS.card} space-y-1.5 border border-border/60 bg-card p-4 ${SHADOW.surface} ${MOTION.hoverCard} hover:border-border`}
          >
            <p className="text-xs font-medium text-foreground">Default / Hover</p>
            <p className={TEXT.caption}>Hover: dich nhe len + border ro hon.</p>
          </div>
          <div
            className={`${RADIUS.card} space-y-1.5 border border-primary/50 bg-card p-4 ring-1 ring-primary/20`}
          >
            <p className="text-xs font-medium text-foreground">Focused</p>
            <p className={TEXT.caption}>Soft glow ring for keyboard users.</p>
          </div>
          <div
            className={`${RADIUS.card} space-y-1.5 border border-border/40 bg-card/30 p-4 opacity-50`}
          >
            <p className="text-xs font-medium text-foreground">Disabled</p>
            <p className={TEXT.caption}>Reduced opacity, no interaction.</p>
          </div>
        </div>
      </Section>

      <Section
        title="Button variants"
        description="Default, outline, secondary, destructive, ghost, disabled, loading."
      >
        <PreviewCard>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Motion</SubgroupHeader>

      <Section
        title="Motion guidelines"
        description="All transitions 150ms. No springy or bouncy motion. Only live indicators pulse."
      >
        <PreviewCard>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <PulseDot color="success" animated />
              <span>Recommended: <code className={TEXT.code}>150ms</code> for hover, focus, open/close</span>
            </div>
            <div className="flex items-center gap-3">
              <PulseDot color="warning" />
              <span>Max allowed: <code className={TEXT.code}>200ms</code></span>
            </div>
            <div className="flex items-center gap-3">
              <PulseDot color="destructive" />
              <span>Never: spring, bounce, ease-in-out longer than 250ms</span>
            </div>
            <div className="flex items-center gap-3">
              <PulseDot color="muted" />
              <span>Disabled elements: no animation, reduced opacity</span>
            </div>
          </div>
        </PreviewCard>
      </Section>
    </>
  );
}

// ============================================================
// Helper: demo data grid for composite state flow
// ============================================================

function DemoDataGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={stagger(i)}
          className={`cursor-pointer ${RADIUS.card} space-y-2 border border-border/60 bg-card p-4 ${SHADOW.surface} ${MOTION.hoverCard} hover:border-border animate-in fade-in slide-in-from-bottom-2 duration-300 [animation-fill-mode:both] motion-reduce:animate-none`}
        >
          <p className="text-sm font-medium text-foreground">Item {i + 1}</p>
          <p className={TEXT.subtitle}>Lorem ipsum dolor sit amet consectetur adipisicing.</p>
          <div className="flex gap-1.5 pt-1">
            <Badge variant="primary">tag-a</Badge>
            <Badge variant="success">done</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
