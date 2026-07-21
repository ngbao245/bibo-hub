// ============================================================
// Config page — sidebar master-detail layout
// ============================================================
// Navigation structure:
//   Dashboard       — overview (placeholder)
//   Management      — Users, Roles, Assets
//   Resources       — Datasources, Artifacts, Credit Pools, Storage Pool
//   Services        — category-based (AI, Storage, Documents, Backend, Realtime, Communication)
//   Monitoring      — Usage, Logs, Health (placeholder)
// ============================================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Settings2,
  LayoutDashboard,
  Users,
  Image,
  Brain,
  Coins,
  FileArchive,
  FileCode,
  HardDrive,
  Radio,
  Network,
  Shield,
  Database,
  Mail,
  Server,
  Download,
  Palette,
} from 'lucide-react';

import { cn } from '@/lib/cn';
import { useServiceProviders } from '@/api/service-registry';
import { useCreditPools, useCreditQuotas, useCreditUsage, useToolsRegistry, useSystemHealth, useDatasources, useArtifacts } from '@/lib/core-sdk';
import type { HealthStatus } from '@/lib/core-sdk/health';
import type { ServiceProvider } from '@/lib/service-registry/types';

import UserManagementTab from '@/components/setting/UserManagementTab';
import AvatarManagerTab from '@/components/setting/AvatarManagerTab';
import RoleManager from '@/components/setting/RoleManager';
import DatasourceManager from '@/components/setting/DatasourceManager';
import ArtifactManager from '@/components/setting/ArtifactManager';
import CreditPoolManager from '@/components/setting/CreditPoolManager';
import CacheInspectorPanel from '@/components/setting/CacheInspectorPanel';
import BackupPanel from '@/components/setting/BackupPanel';
import DesignSystemPanel from '@/routes/DesignSystem';
import LibraryStorageNodes from '@/tools/library-storage-pool/components/StorageNodesManager';
import AttentionPanel, { BatchCredentialTest } from '@/components/setting/AttentionPanel';
import ReEmbedPanel from '@/components/setting/ReEmbedPanel';
import ProviderDetail from '@/components/setting/service-registry/ProviderDetail';
import { EmptyState } from '@/components/shared';

// ─── Nav structure ──────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

const DASHBOARD_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const MANAGEMENT_ITEMS: NavItem[] = [
  { id: 'users', label: 'Users', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'assets', label: 'Assets', icon: Image },
];

const RESOURCES_ITEMS: NavItem[] = [
  { id: 'datasources', label: 'Datasources', icon: Database },
  { id: 'artifacts', label: 'Artifacts', icon: FileCode },
  { id: 'credits', label: 'Credit Pools', icon: Coins },
  { id: 'cache', label: 'Cache', icon: HardDrive },
  { id: 'backup', label: 'Backup', icon: Download },
  { id: 'design-system', label: 'Design System', icon: Palette },
];

/** Service categories — maps to provider.category in DB */
const SERVICE_CATEGORIES: NavItem[] = [
  { id: 'svc-ai', label: 'AI', icon: Brain },
  { id: 'svc-storage', label: 'Storage', icon: HardDrive },
  { id: 'svc-documents', label: 'Documents', icon: FileArchive },
  { id: 'svc-backend', label: 'Backend', icon: Server },
  { id: 'svc-realtime', label: 'Realtime', icon: Radio },
  { id: 'svc-communication', label: 'Communication', icon: Mail },
  { id: 'svc-networking', label: 'Networking', icon: Network },
];

/** Maps category nav id → provider.category values */
const CATEGORY_MAP: Record<string, string[]> = {
  'svc-ai': ['ai'],
  'svc-storage': ['storage'],
  'svc-documents': ['pdf', 'conversion'],
  'svc-backend': ['backend'],
  'svc-realtime': ['realtime'],
  'svc-communication': ['communication', 'email'],
  'svc-networking': ['networking'],
};

// ─── Platform sections that have content ─────────────────────

const PLATFORM_SECTIONS = new Set([
  'dashboard',
  'users', 'roles', 'assets',
  'datasources', 'artifacts', 'credits', 'storage', 'cache', 'backup', 'design-system',
]);

// ─── Main ───────────────────────────────────────────────────

export default function SettingPage() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const providersQuery = useServiceProviders();
  const providers = providersQuery.data ?? [];

  // Determine if active section is a service category or a provider
  const isServiceCategory = activeSection.startsWith('svc-');
  const isProvider = !PLATFORM_SECTIONS.has(activeSection) && !isServiceCategory;

  // Filter providers for active service category
  const categoryProviders = isServiceCategory
    ? providers.filter((p) => (CATEGORY_MAP[activeSection] ?? []).includes(p.category))
    : [];

  // Only show service categories that have at least 1 provider
  const visibleCategories = SERVICE_CATEGORIES.filter((cat) => {
    const catValues = CATEGORY_MAP[cat.id] ?? [];
    return providers.some((p) => catValues.includes(p.category));
  });

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-border bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Hub
          </Link>
          <span className="text-xs text-muted-foreground">/</span>
          <Settings2 className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Config</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {/* Dashboard */}
          {DASHBOARD_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}

          {/* Management */}
          <SectionHeader label="Management" />
          {MANAGEMENT_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}

          {/* Resources */}
          <SectionHeader label="Resources" />
          {RESOURCES_ITEMS.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}

          {/* Services */}
          <SectionHeader label="Services" />
          {visibleCategories.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              active={activeSection === item.id}
              onClick={() => setActiveSection(item.id)}
            />
          ))}
        </nav>
      </aside>

      {/* Detail panel */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {/* Dashboard */}
          {activeSection === 'dashboard' && <ConfigDashboard onNavigate={setActiveSection} />}

          {/* Management */}
          {activeSection === 'users' && <UserManagementTab />}
          {activeSection === 'roles' && <RoleManager />}
          {activeSection === 'assets' && <AvatarManagerTab />}

          {/* Resources */}
          {activeSection === 'datasources' && <DatasourceManager />}
          {activeSection === 'artifacts' && <ArtifactManager />}
          {activeSection === 'credits' && <CreditPoolManager />}
          {activeSection === 'cache' && <CacheInspectorPanel />}
          {activeSection === 'backup' && <BackupPanel />}
          {activeSection === 'design-system' && <DesignSystemPanel embedded />}

          {/* Services — category view (list providers in category) */}
          {isServiceCategory && (
            <>
              {activeSection === 'svc-storage' && (
                <div className="mb-8">
                  <LibraryStorageNodes />
                </div>
              )}
              <ServiceCategoryView
                categoryId={activeSection}
                providers={categoryProviders}
                onSelectProvider={(code) => setActiveSection(code)}
              />
            </>
          )}

          {/* Services — provider detail */}
          {isProvider && <ProviderDetail providerCode={activeSection} />}
        </div>
      </main>
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-t border-border mt-2">
      {label}
    </p>
  );
}

// ─── Sidebar item ───────────────────────────────────────────

function SidebarItem({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors',
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

// ─── Service category view ──────────────────────────────────

function ServiceCategoryView({
  categoryId,
  providers,
  onSelectProvider,
}: {
  categoryId: string;
  providers: ServiceProvider[];
  onSelectProvider: (code: string) => void;
}) {
  const label = SERVICE_CATEGORIES.find((c) => c.id === categoryId)?.label ?? 'Services';
  const Icon = SERVICE_CATEGORIES.find((c) => c.id === categoryId)?.icon ?? Settings2;

  if (providers.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={`No ${label} providers`}
        description="Add a provider in this category via database seed or migration."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">{label} Services</h2>
        <p className="text-xs text-muted-foreground">
          {providers.length} provider{providers.length !== 1 ? 's' : ''} in this category.
        </p>
      </div>
      <div className="space-y-2">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onSelectProvider(p.code)}
            className="flex w-full items-center justify-between border border-border p-3 text-left hover:bg-muted/50 transition-colors"
          >
            <div>
              <span className="text-sm font-medium text-foreground">{p.name}</span>
              {p.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5">{p.description}</p>
              )}
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 ${
              p.status === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
            }`}>
              {p.status}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard ──────────────────────────────────────────────

function ConfigDashboard({ onNavigate }: { onNavigate: (id: string) => void }) {
  const providersQuery = useServiceProviders();
  const poolsQuery = useCreditPools();
  const usageQuery = useCreditUsage({ limit: 15 });
  const toolsQuery = useToolsRegistry();
  const healthQuery = useSystemHealth();
  const datasourcesQuery = useDatasources();
  const artifactsQuery = useArtifacts({ status: 'latest' });

  const providers = providersQuery.data ?? [];
  const pools = poolsQuery.data ?? [];
  const recentUsage = usageQuery.data ?? [];
  const tools = toolsQuery.data ?? [];
  const health = healthQuery.data;
  const datasources = datasourcesQuery.data ?? [];
  const artifacts = artifactsQuery.data ?? [];

  // Computed
  const supabaseProjects = datasources.filter((d) => d.driver === 'supabase');
  const activeTools = tools.filter((t) => t.status === 'active');
  const frontendOnlyTools = activeTools.filter((t) => !t.datasource_id);
  const backendTools = activeTools.filter((t) => t.datasource_id);
  const overall = health?.overall ?? 'unknown';
  const summary = health?.summary ?? { total: 0, healthy: 0, warning: 0, error: 0, disabled: 0 };
  const providerHealths = health?.providers ?? [];
  const totalCredentials = providerHealths.reduce((sum, ph) => sum + ph.details.totalCredentials, 0);
  const activeCredentials = providerHealths.reduce((sum, ph) => sum + ph.details.activeCredentials, 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-foreground">ToolHub Core</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Plugin Architecture — {supabaseProjects.length} project{supabaseProjects.length !== 1 ? 's' : ''} · {activeTools.length} tools · {providers.length} providers
          </p>
        </div>
        <span className={`flex items-center gap-1.5 text-[11px] ${getHealthColor(overall)}`}>
          <span className={`h-2 w-2 rounded-full ${getHealthDot(overall)}`} />
          {overall === 'healthy' ? 'All systems healthy' : overall === 'warning' ? 'Attention needed' : overall === 'error' ? 'Issues detected' : 'Checking...'}
        </span>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { id: 'datasources', label: 'Datasources', icon: Database },
          { id: 'svc-ai', label: 'AI Services', icon: Brain },
          { id: 'credits', label: 'Credit Pools', icon: Coins },
          { id: 'storage', label: 'Storage Pool', icon: HardDrive },
          { id: 'artifacts', label: 'Artifacts', icon: FileCode },
          { id: 'users', label: 'Users & Roles', icon: Users },
          { id: 'svc-storage', label: 'Storage Services', icon: HardDrive },
          { id: 'roles', label: 'RBAC', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className="flex items-center gap-2 border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Attention + Health Check ── */}
      <AttentionPanel />
      <ReEmbedPanel />
      <div className="flex items-center justify-between">
        <BatchCredentialTest />
      </div>

      {/* ── Infrastructure Map ── */}
      <div className="border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Infrastructure Map</span>
          <span className="text-[10px] text-muted-foreground">datasource → tools topology</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {datasources.map((ds) => {
              const dsTools = tools.filter((t) => t.datasource_id === ds.id);
              const dsArtifacts = artifacts.filter((a) => a.datasource_code === ds.code);
              return (
                <button
                  key={ds.id}
                  type="button"
                  onClick={() => onNavigate('datasources')}
                  className="border border-border p-3 text-left hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`h-2 w-2 rounded-full ${ds.status === 'active' ? 'bg-success' : 'bg-muted-foreground/40'}`} />
                    <span className="text-xs font-medium text-foreground">{ds.name}</span>
                    <span className={`text-[9px] px-1 py-0.5 ${
                      ds.driver === 'supabase' ? 'bg-primary/10 text-primary'
                        : ds.driver === 'mockapi' ? 'bg-warning/10 text-warning'
                          : 'bg-muted text-muted-foreground'
                    }`}>{ds.driver}</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-muted-foreground">
                    <p>{dsTools.length} tool{dsTools.length !== 1 ? 's' : ''} · {dsArtifacts.length} artifact{dsArtifacts.length !== 1 ? 's' : ''}</p>
                    {dsTools.length > 0 && (
                      <p className="truncate text-foreground/60">
                        {dsTools.slice(0, 3).map((t) => t.name).join(', ')}
                        {dsTools.length > 3 && ` +${dsTools.length - 3}`}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {frontendOnlyTools.length > 0 && (
              <div className="border border-border/50 border-dashed p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <span className="text-xs font-medium text-muted-foreground">Frontend-only</span>
                  <span className="text-[9px] px-1 py-0.5 bg-muted text-muted-foreground">no DB</span>
                </div>
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  <p>{frontendOnlyTools.length} tools</p>
                  <p className="truncate text-foreground/60">
                    {frontendOnlyTools.slice(0, 3).map((t) => t.name).join(', ')}
                    {frontendOnlyTools.length > 3 && ` +${frontendOnlyTools.length - 3}`}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Service Health ── */}
      <div className="border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-medium text-foreground">Service Health</span>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-muted-foreground">{totalCredentials} keys ({activeCredentials} active)</span>
            {summary.warning > 0 && <span className="text-warning">{summary.warning} warning</span>}
            {summary.error > 0 && <span className="text-destructive">{summary.error} error</span>}
          </div>
        </div>
        <div className="divide-y divide-border">
          {providerHealths.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">No providers configured.</p>
          ) : (
            providerHealths.map((ph) => (
              <button
                key={ph.providerCode}
                type="button"
                onClick={() => onNavigate(ph.providerCode)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                <span className={`h-2 w-2 rounded-full shrink-0 ${getHealthDot(ph.status)}`} />
                <span className="text-xs font-medium text-foreground w-28 shrink-0">{ph.providerName}</span>
                <span className="text-[10px] text-muted-foreground flex-1 truncate">{ph.reason}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {ph.details.activeCredentials}/{ph.details.totalCredentials} keys
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 shrink-0 ${getHealthBadge(ph.status)}`}>
                  {ph.status}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Credit & Quota ── */}
      {pools.length > 0 && (
        <div className="border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Credit Pools</span>
            <button type="button" onClick={() => onNavigate('credits')} className="text-[10px] text-primary hover:text-primary/80">
              Manage
            </button>
          </div>
          <div className="space-y-2">
            {pools.map((pool) => (
              <CreditPoolBar key={pool.id} pool={pool} />
            ))}
          </div>
        </div>
      )}

      {/* ── Recent Activity ── */}
      <div className="border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Recent Activity</span>
          <span className="text-[10px] text-muted-foreground">{recentUsage.length} records</span>
        </div>
        {recentUsage.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No API calls recorded yet. Activity appears when tools use providers (AI, PDF, storage).
          </p>
        ) : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {recentUsage.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-border/30 last:border-0">
                <span className="text-[10px] text-muted-foreground w-12 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-mono text-foreground w-24 truncate shrink-0">{log.tool_code}</span>
                <span className="text-muted-foreground flex-1">-{log.credits_used}</span>
                <span className={`text-[10px] px-1.5 py-0.5 shrink-0 ${
                  log.status === 'success' ? 'bg-success/10 text-success'
                    : log.status === 'refunded' ? 'bg-warning/10 text-warning'
                      : 'bg-destructive/10 text-destructive'
                }`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Architecture Summary ── */}
      <div className="border border-border/50 border-dashed p-4">
        <p className="text-[10px] font-medium uppercase text-muted-foreground mb-3">Architecture Overview</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-lg font-semibold text-foreground">{supabaseProjects.length}</p>
            <p className="text-[10px] text-muted-foreground">Supabase Projects</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{activeTools.length}</p>
            <p className="text-[10px] text-muted-foreground">Tools ({backendTools.length} DB / {frontendOnlyTools.length} FE)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{providers.length}</p>
            <p className="text-[10px] text-muted-foreground">Providers ({totalCredentials} keys)</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">{artifacts.length}</p>
            <p className="text-[10px] text-muted-foreground">Artifacts</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Health UI helpers ──────────────────────────────────────

function getHealthColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return 'text-success';
    case 'warning': return 'text-warning';
    case 'error': return 'text-destructive';
    default: return 'text-muted-foreground';
  }
}

function getHealthDot(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return 'bg-success';
    case 'warning': return 'bg-warning';
    case 'error': return 'bg-destructive';
    default: return 'bg-muted-foreground/40';
  }
}

function getHealthBadge(status: HealthStatus): string {
  switch (status) {
    case 'healthy': return 'bg-success/10 text-success';
    case 'warning': return 'bg-warning/10 text-warning';
    case 'error': return 'bg-destructive/10 text-destructive';
    default: return 'bg-muted text-muted-foreground';
  }
}

// ─── Credit Pool progress bar ───────────────────────────────

function CreditPoolBar({ pool }: { pool: { id: string; code: string; name: string; status: string; credit_unit: string } }) {
  const quotasQuery = useCreditQuotas(pool.id);
  const quotas = quotasQuery.data ?? [];

  let maxPct = 0;
  let displayUsed = 0;
  let displayMax = 0;

  for (const q of quotas) {
    const pct = q.max_credits > 0 ? q.used_credits / q.max_credits : 0;
    if (pct > maxPct) {
      maxPct = pct;
      displayUsed = q.used_credits;
      displayMax = q.max_credits;
    }
  }

  const pctRounded = Math.round(maxPct * 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-foreground">{pool.name}</span>
        <span className={`text-[10px] ${pctRounded >= 90 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {quotas.length > 0 ? `${displayUsed}/${displayMax} ${pool.credit_unit}` : 'no quota set'}
        </span>
      </div>
      {quotas.length > 0 && (
        <div className="h-1.5 bg-muted w-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              pctRounded >= 90 ? 'bg-destructive' : pctRounded >= 70 ? 'bg-warning' : 'bg-primary'
            }`}
            style={{ width: `${Math.min(100, pctRounded)}%` }}
          />
        </div>
      )}
    </div>
  );
}