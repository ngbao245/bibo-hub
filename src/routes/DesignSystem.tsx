// ============================================================
// Design System Premium SaaS Component Catalog
// ============================================================
// Route: /design-system (also embedded in /config)
// Style: Linear ┬╖ Vercel ┬╖ Raycast calm, minimal, premium
// ============================================================
//
// Structure:
//   - Design tokens (RADIUS, MOTION, ICON, TEXT) as const maps
//   - Atom components (PreviewCard, IconBadge, EmptyPreview, ...)
//   - Section components grouped by tab
//
// Rule: never use ad-hoc Tailwind classes for radius/motion/icon size.
// Always reference token maps to prevent drift.
// ============================================================

import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
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
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { LoadingState, EmptyState, ErrorState } from '@/components/shared';

// ============================================================
// Design tokens ΓÇö cß╗⌐ng, kh├┤ng hard-code Tailwind classes rß╗¥i rß║íc
// ============================================================

/** Border radius scale. Map cß╗⌐ng theo role ΓÇö kh├┤ng t├╣y tiß╗çn. */
const RADIUS = {
  chip: 'rounded-full', // badges, pills, avatars
  input: 'rounded-lg',  // buttons, inputs, small blocks
  card: 'rounded-xl',   // cards, preview containers
  dialog: 'rounded-2xl',// modals, popovers
  skel: 'rounded',      // default text/line skeletons
} as const;

/** Motion presets. Tß║Ñt cß║ú transitions ß╗ƒ 150ms ─æß╗â ─æß╗ông bß╗Ö nhß╗ïp. */
const MOTION = {
  fast: 'transition-all duration-150',
  fade: 'animate-in fade-in duration-150',
  pulse: 'animate-pulse [animation-duration:2s]',
} as const;

/** Icon size scale ΓÇö chß╗ë 3 gi├í trß╗ï. */
const ICON = {
  sm: 'h-4 w-4',   // 16px inline, button icon
  md: 'h-5 w-5',   // 20px empty state, section header
  lg: 'h-6 w-6',   // 24px hero
} as const;

/** Text tokens hierarchy from spacing + weight, KH├âΓÇ¥NG spam font-size. */
const TEXT = {
  title: 'text-sm font-semibold tracking-tight text-foreground',
  subtitle: 'text-xs leading-relaxed text-muted-foreground',
  body: 'text-xs text-muted-foreground',
  label: 'text-[11px] font-medium text-muted-foreground',
  caption: 'text-[10px] text-muted-foreground',
  code: 'rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono',
} as const;

/** Section gap nhß║Ñt qu├ín giß╗»a tß║Ñt cß║ú tab. */
const SECTION_GAP = 'space-y-12';

// ============================================================
// Main component glass header + pill tabs + fade content
// ============================================================

type TabId = 'loading' | 'empty' | 'error' | 'skeleton' | 'inputs' | 'tokens' | 'composite';

const TABS: { id: TabId; label: string }[] = [
  { id: 'loading', label: 'Loading' },
  { id: 'empty', label: 'Empty' },
  { id: 'error', label: 'Error' },
  { id: 'skeleton', label: 'Skeletons' },
  { id: 'inputs', label: 'Inputs' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'composite', label: 'Composite' },
];

import { useThemeStore, useSaveTheme, THEMES } from '@/tools/theme';
import type { ThemeId } from '@/tools/theme';

export default function DesignSystem({ embedded }: { embedded?: boolean } = {}) {
  const [activeTab, setActiveTab] = useState<TabId>('loading');

  return (
    <div className={embedded ? '' : 'min-h-screen bg-background'}>
      {/* Glass header full page only */}
      {!embedded && (
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-6 py-3">
            <Button variant="ghost" size="icon" asChild className={`h-8 w-8 ${RADIUS.input}`}>
              <Link to="/">
                <ArrowLeft className={ICON.sm} />
              </Link>
            </Button>
            <h1 className={TEXT.title}>Design System</h1>
            <div className="ml-auto">
              <ThemeControls />
            </div>
          </div>
          <TabBar active={activeTab} onChange={setActiveTab} className="px-6 pb-3" />
        </header>
      )}

      {/* Inline tabs when embedded (Setting page has its own header) */}
      {embedded && (
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <TabBar active={activeTab} onChange={setActiveTab} />
            <ThemeControls />
          </div>
        </div>
      )}

      <div
        key={activeTab}
        className={`${MOTION.fade} ${embedded ? SECTION_GAP : `mx-auto max-w-5xl ${SECTION_GAP} px-6 py-10`}`}
      >
        {activeTab === 'loading' && <LoadingSection />}
        {activeTab === 'empty' && <EmptySection />}
        {activeTab === 'error' && <ErrorSection />}
        {activeTab === 'skeleton' && <SkeletonSection />}
        {activeTab === 'inputs' && <InputsSection />}
        {activeTab === 'tokens' && <TokensSection />}
        {activeTab === 'composite' && <CompositeSection />}
      </div>
    </div>
  );
}

function TabBar({
  active,
  onChange,
  className = '',
}: {
  active: TabId;
  onChange: (id: TabId) => void;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 ${className}`}>
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`${RADIUS.chip} px-3.5 py-1.5 text-xs font-medium ${MOTION.fast} ${
            active === t.id
              ? 'bg-foreground/10 text-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ThemeControls() {
  const theme = useThemeStore((s) => s.theme);
  const is3d = useThemeStore((s) => s.is3d);
  const isRounded = useThemeStore((s) => s.isRounded);
  const isRetro = useThemeStore((s) => s.isRetro);
  const isPill = useThemeStore((s) => s.isPill);
  const setTheme = useThemeStore((s) => s.setTheme);
  const setIs3d = useThemeStore((s) => s.setIs3d);
  const setIsRounded = useThemeStore((s) => s.setIsRounded);
  const setIsRetro = useThemeStore((s) => s.setIsRetro);
  const setIsPill = useThemeStore((s) => s.setIsPill);
  const saveTheme = useSaveTheme();

  const persist = (patch: Partial<{ theme: ThemeId; is3d: boolean; isRounded: boolean; isRetro: boolean; isPill: boolean }>) => {
    const next = {
      theme: patch.theme ?? theme,
      is3d: patch.is3d ?? is3d,
      isRounded: patch.isRounded ?? isRounded,
      isRetro: patch.isRetro ?? isRetro,
      isPill: patch.isPill ?? isPill,
    };
    saveTheme.save(next);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Theme dropdown as pill group */}
      <div className="flex items-center gap-1">
        <Palette className={`${ICON.sm} mr-1 text-muted-foreground`} />
        {THEMES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTheme(t.id);
              persist({ theme: t.id });
            }}
            className={`${RADIUS.chip} px-2.5 py-1 text-[11px] font-medium ${MOTION.fast} ${
              theme === t.id
                ? 'bg-primary/15 text-primary shadow-xs'
                : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-border" />

      {/* Raised toggle */}
      <button
        onClick={() => {
          setIs3d(!is3d);
          persist({ is3d: !is3d });
        }}
        className={`${RADIUS.chip} px-2.5 py-1 text-[11px] font-medium ${MOTION.fast} ${
          is3d
            ? 'bg-primary/15 text-primary shadow-xs'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        Lift
      </button>

      {/* Subtle toggle (was Rounded) ΓÇö radio with Pill */}
      <button
        onClick={() => {
          const next = !isRounded;
          setIsRounded(next);
          if (next) { setIsPill(false); }
          persist({ isRounded: next, isPill: next ? false : isPill });
        }}
        className={`${RADIUS.chip} px-2.5 py-1 text-[11px] font-medium ${MOTION.fast} ${
          isRounded
            ? 'bg-primary/15 text-primary shadow-xs'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        Subtle
      </button>

      {/* Pill toggle ΓÇö radio with Subtle */}
      <button
        onClick={() => {
          const next = !isPill;
          setIsPill(next);
          if (next) { setIsRounded(false); }
          persist({ isPill: next, isRounded: next ? false : isRounded });
        }}
        className={`${RADIUS.chip} px-2.5 py-1 text-[11px] font-medium ${MOTION.fast} ${
          isPill
            ? 'bg-primary/15 text-primary shadow-xs'
            : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        Pill
      </button>

      {/* Retro toggle ΓÇö only enabled when Lift is on */}
      <button
        disabled={!is3d}
        onClick={() => {
          setIsRetro(!isRetro);
          persist({ isRetro: !isRetro });
        }}
        className={`${RADIUS.chip} px-2.5 py-1 text-[11px] font-medium ${MOTION.fast} ${
          !is3d
            ? 'opacity-40 cursor-not-allowed text-muted-foreground'
            : isRetro
              ? 'bg-primary/15 text-primary shadow-xs'
              : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
        }`}
      >
        Retro
      </button>
    </div>
  );
}

// ============================================================
// Atom components reusable primitives for previews
// ============================================================

/** Section wrapper title + description + content. Consistent hierarchy. */
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
      <div className="space-y-1">
        <h2 className={TEXT.title}>{title}</h2>
        <p className={TEXT.subtitle}>{description}</p>
      </div>
      {children}
    </section>
  );
}

/** Subgroup header chia section th├ánh nh├│m nhß╗Å h╞ín. */
function SubgroupHeader({ children }: { children: ReactNode }) {
  return (
    <h3 className="pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
      {children}
    </h3>
  );
}

/**
 * Soft surface preview container.
 * NOT interactive ΓÇö kh├┤ng c├│ hover effect ─æß╗â tr├ính visual noise.
 * shimmer prop: adds animated shimmer beam for skeleton previews.
 */
function PreviewCard({
  children,
  className = '',
  shimmer = false,
}: {
  children: ReactNode;
  className?: string;
  shimmer?: boolean;
}) {
  return (
    <div className={`${RADIUS.card} bg-muted/40 p-5 shadow-xs ${shimmer ? 'relative overflow-hidden' : ''} ${className}`}>
      {children}
      {shimmer && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-foreground/[0.08] to-transparent"
        />
      )}
    </div>
  );
}

/**
 * Circular icon container d├╣ng cho empty state, error state.
 * Bg-muted/60 ─æß╗â nß╗òi r├╡ tr├¬n PreviewCard bg-muted/40.
 */
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

/** Canonical empty state preview. Dedupe 3 copy-paste blocks. */
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

/** Status dot optionally animated (only for "live" indicators). */
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

/** Single alpha swatch d├╣ng cho scale demo. */
function AlphaSwatch({ value }: { value: 5 | 10 | 15 | 20 | 30 | 50 | 80 | 100 }) {
  // Static classes for Tailwind JIT (no dynamic interpolation)
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

/** Semantic color swatch card name + description + color block. */
function TokenSwatch({ name, desc, bg }: { name: string; desc: string; bg: string }) {
  return (
    <div className={`flex items-center gap-3 ${RADIUS.card} bg-muted/40 p-3 shadow-xs`}>
      <div className={`h-9 w-9 shrink-0 ${RADIUS.input} ${bg}`} />
      <div>
        <p className="text-xs font-medium text-foreground">{name}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
    </div>
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
        description="Single spinner for all contexts: Suspense fallback, action feedback, inline loading. Scale via h/w classes. No rounded-full ΓÇö minimal square aesthetic."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Full-page (h-5 w-5)</p>
            <div className="flex h-32 items-center justify-center">
              <div className="h-5 w-5 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
            </div>
          </PreviewCard>
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Inline small (h-3.5 w-3.5)</p>
            <div className="flex h-32 items-center justify-center">
              <div className="h-3.5 w-3.5 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
            </div>
          </PreviewCard>
          <PreviewCard className="space-y-2 text-center">
            <p className={TEXT.label}>Micro (h-3 w-3)</p>
            <div className="flex h-32 items-center justify-center">
              <div className="h-3 w-3 animate-spin border-2 border-primary border-b-primary/30 border-r-primary/30" />
            </div>
          </PreviewCard>
        </div>
      </Section>



      <SubgroupHeader>Skeletons</SubgroupHeader>

      <Section
        title="LoadingState Skeleton Grid"
        description="List/grid content. Single shimmer beam sweeps across all blocks simultaneously."
      >
        <PreviewCard>
          <LoadingState variant="skeleton" count={6} />
        </PreviewCard>
      </Section>

      <Section
        title="LoadingState Skeleton List"
        description="Vertical list items. Consistent height per row."
      >
        <PreviewCard>
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
//
// Skeleton radius convention:
//   - Text/lines           ├óΓÇáΓÇÖ RADIUS.skel (default rounded)
//   - Inputs/buttons/covers ├óΓÇáΓÇÖ RADIUS.input (lg)
//   - Chips/pills/avatars  ├óΓÇáΓÇÖ RADIUS.chip (full)
//   - Cards/blocks         ├óΓÇáΓÇÖ RADIUS.card (xl)
// ============================================================

function SkeletonSection() {
  return (
    <>
      <SubgroupHeader>Cards & content</SubgroupHeader>

      <Section
        title="Book cards (Library)"
        description="Match Library grid footprint. Cover aspect 3:4, title and author lines below."
      >
        <PreviewCard shimmer>
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
        <PreviewCard shimmer className="w-56">
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
        <PreviewCard shimmer>
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
// Tab: Inputs & Form Controls
// ============================================================

function InputsSection() {
  const [showPassword, setShowPassword] = useState(false);
  const [checked, setChecked] = useState(true);
  const [toggleValue, setToggleValue] = useState<'on' | 'off'>('on');

  return (
    <>
      <SubgroupHeader>Text inputs</SubgroupHeader>

      <Section
        title="Default states"
        description="Standard input in all interactive states. Uses border-input, focus ring-ring + border-primary."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Default</label>
              <Input placeholder="Enter your name..." />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>With value</label>
              <Input defaultValue="Bao Nguyen" />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Disabled</label>
              <Input disabled defaultValue="Cannot edit" />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Read-only</label>
              <Input readOnly defaultValue="Read only content" className="bg-muted/50" />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="With icons"
        description="Icon prefix/suffix pattern. Wrap in relative container, position icon absolute."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Search (icon left)</label>
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground`} />
                <Input placeholder="Search..." className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Email (icon left)</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground`} />
                <Input type="email" placeholder="email@example.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Password (icon both sides)</label>
              <div className="relative">
                <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground`} />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  defaultValue="secret123"
                  className="pl-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword
                    ? <EyeOff className={ICON.sm} />
                    : <Eye className={ICON.sm} />
                  }
                </button>
              </div>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Error state"
        description="Border turns destructive, helper text below in destructive color."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Invalid email</label>
              <Input
                type="email"
                defaultValue="not-an-email"
                className="border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive"
              />
              <p className="text-[11px] text-destructive">Please enter a valid email address.</p>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Required field</label>
              <Input
                placeholder="This field is required"
                className="border-destructive focus-visible:ring-destructive/30 focus-visible:border-destructive"
              />
              <p className="text-[11px] text-destructive">This field cannot be empty.</p>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <Section
        title="Sizes"
        description="Standard h-9. Compact h-8 for dense UI (tables, toolbars). Large h-10 for hero forms."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Compact (h-8)</label>
              <Input placeholder="Compact input" className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Default (h-9)</label>
              <Input placeholder="Default input" />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Large (h-10)</label>
              <Input placeholder="Large input" className="h-10" />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Textarea</SubgroupHeader>

      <Section
        title="Native textarea"
        description="Styled to match Input tokens. Same border, focus ring, placeholder style."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Default</label>
              <textarea
                placeholder="Write something..."
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>With content</label>
              <textarea
                defaultValue="This is a multi-line text area with some content that demonstrates how it looks when filled."
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Disabled</label>
              <textarea
                disabled
                defaultValue="Cannot edit this."
                rows={2}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Checkbox</SubgroupHeader>

      <Section
        title="Checkbox states"
        description="Radix checkbox. Square shape (no rounding), primary fill when checked."
      >
        <PreviewCard className="max-w-sm">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Checkbox id="check-1" checked={checked} onCheckedChange={(v) => setChecked(v === true)} />
              <label htmlFor="check-1" className="text-sm text-foreground cursor-pointer">
                Checked (click to toggle)
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="check-2" />
              <label htmlFor="check-2" className="text-sm text-foreground cursor-pointer">
                Unchecked
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="check-3" disabled checked />
              <label htmlFor="check-3" className="text-sm text-muted-foreground cursor-not-allowed">
                Disabled checked
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="check-4" disabled />
              <label htmlFor="check-4" className="text-sm text-muted-foreground cursor-not-allowed">
                Disabled unchecked
              </label>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Select</SubgroupHeader>

      <Section
        title="Native select"
        description="Styled native select. Same height/border as Input. Chevron icon right."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Default</label>
              <div className="relative">
                <select
                  className="flex h-9 w-full appearance-none border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue=""
                >
                  <option value="" disabled>Select an option...</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="cute">Cute</option>
                </select>
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground pointer-events-none`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>With value</label>
              <div className="relative">
                <select
                  className="flex h-9 w-full appearance-none border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary"
                  defaultValue="dark"
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="cute">Cute</option>
                </select>
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground pointer-events-none`} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Disabled</label>
              <div className="relative">
                <select
                  disabled
                  className="flex h-9 w-full appearance-none border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
                  defaultValue="dark"
                >
                  <option value="dark">Dark</option>
                </select>
                <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground pointer-events-none`} />
              </div>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Toggle patterns</SubgroupHeader>

      <Section
        title="Pill toggle group"
        description="Segmented control pattern used across the hub (theme selector, view switcher). Same pattern as ThemeControls."
      >
        <PreviewCard className="max-w-sm">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Binary toggle</label>
              <div className="flex gap-1">
                {(['on', 'off'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setToggleValue(v)}
                    className={`${RADIUS.chip} px-3.5 py-1.5 text-xs font-medium capitalize ${MOTION.fast} ${
                      toggleValue === v
                        ? 'bg-primary/15 text-primary shadow-xs'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Multi-option (view mode)</label>
              <div className="flex gap-1">
                {['Grid', 'List', 'Table'].map((v) => (
                  <button
                    key={v}
                    className={`${RADIUS.chip} px-3.5 py-1.5 text-xs font-medium ${MOTION.fast} ${
                      v === 'Grid'
                        ? 'bg-foreground/10 text-foreground shadow-xs'
                        : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PreviewCard>
      </Section>

      <SubgroupHeader>Composite form</SubgroupHeader>

      <Section
        title="Complete form example"
        description="Typical tool form layout. Label + input + helper text. Consistent spacing."
      >
        <PreviewCard className="max-w-md">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className={TEXT.label}>Title *</label>
              <Input placeholder="Enter title" />
              <p className={TEXT.caption}>Required. Max 100 characters.</p>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Email</label>
              <div className="relative">
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 ${ICON.sm} text-muted-foreground`} />
                <Input type="email" placeholder="you@example.com" className="pl-9" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={TEXT.label}>Description</label>
              <textarea
                placeholder="Optional description..."
                rows={3}
                className="flex w-full border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:border-primary resize-none"
              />
            </div>
            <div className="flex items-center gap-3">
              <Checkbox id="form-agree" />
              <label htmlFor="form-agree" className="text-xs text-muted-foreground cursor-pointer">
                I agree to the terms and conditions
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm">Submit</Button>
              <Button size="sm" variant="outline">Cancel</Button>
            </div>
          </div>
        </PreviewCard>
      </Section>
    </>
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
        description="Defined shadow levels. Never use arbitrary shadow-xxl or custom shadows."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { level: '0', desc: 'Page bg', className: 'bg-background', shadow: 'none' },
            { level: '1', desc: 'Cards', className: 'bg-card shadow-xs', shadow: 'shadow-xs' },
            { level: '2', desc: 'Dropdowns', className: 'bg-card shadow-sm', shadow: 'shadow-sm' },
            { level: '3', desc: 'Dialogs', className: 'bg-card shadow-lg', shadow: 'shadow-lg' },
          ].map((t) => (
            <div
              key={t.level}
              className={`flex h-24 flex-col items-center justify-center ${RADIUS.card} ${t.className}`}
            >
              <p className="text-xs font-semibold text-foreground">Level {t.level}</p>
              <p className={TEXT.caption}>{t.desc}</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">{t.shadow}</p>
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
            {demoState === 'loading' && <LoadingState variant="skeleton" count={6} />}
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
                  <span className={`${RADIUS.chip} bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success`}>admin</span>
                  <span className={`${RADIUS.chip} bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary`}>active</span>
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
          <div className={`${RADIUS.card} space-y-1.5 bg-card p-4 shadow-xs ${MOTION.fast} hover:-translate-y-0.5 hover:shadow-sm`}>
            <p className="text-xs font-medium text-foreground">Default / Hover</p>
            <p className={TEXT.caption}>Hover for lift + shadow.</p>
          </div>
          <div className={`${RADIUS.card} space-y-1.5 bg-card p-4 shadow-xs ring-2 ring-primary/50`}>
            <p className="text-xs font-medium text-foreground">Focused</p>
            <p className={TEXT.caption}>Ring visible for keyboard users.</p>
          </div>
          <div className={`${RADIUS.card} space-y-1.5 bg-card p-4 opacity-50 shadow-xs`}>
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
// Small helper: demo data grid for composite state flow
// ============================================================

function DemoDataGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={`${RADIUS.card} space-y-2 bg-card p-4 shadow-xs ${MOTION.fast} hover:-translate-y-0.5 hover:shadow-sm`}
        >
          <p className="text-sm font-medium text-foreground">Item {i + 1}</p>
          <p className={TEXT.subtitle}>Lorem ipsum dolor sit amet consectetur adipisicing.</p>
          <div className="flex gap-1.5 pt-1">
            <span className={`${RADIUS.chip} bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary`}>tag-a</span>
            <span className={`${RADIUS.chip} bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success`}>done</span>
          </div>
        </div>
      ))}
    </div>
  );
}