
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';

import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';

import {
  exportData,
  importData,
  getNotesStats,
  getTasksStats,
  type BackupKind,
} from '@/lib/backup';

// ============================================================
// Backup Modal - export/import notes & tasks
// ============================================================

export default function Backup() {
  return (
    <ToolModal
      id="backup"
      title="Sao lưu & Phục hồi"
      description="Export data ra JSON, hoặc import từ file backup"
      className="max-w-xl"
    >
      <BackupContent />
    </ToolModal>
  );
}

function BackupContent() {
  return (
    <Tabs defaultValue="notes">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="tasks">Tasks</TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="mt-4">
        <BackupSection kind="notes" />
      </TabsContent>
      <TabsContent value="tasks" className="mt-4">
        <BackupSection kind="tasks" />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// Section dùng chung cho cả Notes và Tasks
// ============================================================
function BackupSection({ kind }: { kind: BackupKind }) {
  return (
    <div className="space-y-5">
      <Stats kind={kind} />
      <ExportBlock kind={kind} />
      <ImportBlock kind={kind} />
    </div>
  );
}

// ============================================================
// Statistics — query qua TanStack Query
// Tách 2 component riêng vì TS không infer được union return từ ternary queryFn
// ============================================================
function Stats({ kind }: { kind: BackupKind }) {
  return kind === 'notes' ? <NotesStatsView /> : <TasksStatsView />;
}

function NotesStatsView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['backup-stats', 'notes'],
    queryFn: getNotesStats,
  });

  if (isLoading) return <StatsSkeleton />;
  if (error || !data) return <StatsError />;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard label="Tổng" value={data.total} highlight />
      <StatCard label="Note" value={data.byType.note ?? 0} />
      <StatCard label="IELTS" value={data.byType.ielts ?? 0} />
      <StatCard label="Code" value={data.byType.code ?? 0} />
      <StatCard label="Course" value={data.byType.course ?? 0} />
      <StatCard label="Secret" value={data.byType.secret ?? 0} />
      <StatCard label="Source" value={data.byType.source ?? 0} />
    </div>
  );
}

function TasksStatsView() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['backup-stats', 'tasks'],
    queryFn: getTasksStats,
  });

  if (isLoading) return <StatsSkeleton />;
  if (error || !data) return <StatsError />;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard label="Tổng tasks" value={data.total} highlight />
      <StatCard label="Đang chờ" value={data.pending} />
      <StatCard label="Hoàn thành" value={data.completed} />
      <StatCard label="Lists" value={data.lists} />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-16" />
      ))}
    </div>
  );
}

function StatsError() {
  return (
    <div className="border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
      Không tải được thống kê
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border border-border bg-background px-3 py-2 ${
        highlight ? 'border-primary' : ''
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${highlight ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

// ============================================================
// Export
// ============================================================
function ExportBlock({ kind }: { kind: BackupKind }) {
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
    setIsExporting(true);
    try {
      const result = await exportData(kind);
      toast.success(`Đã export ${result.count} ${kind}`, { description: result.filename });
    } catch (e) {
      toast.error('Export thất bại', { description: String(e) });
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <Download className="h-4 w-4" />
        Export
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tải về toàn bộ data dưới dạng file JSON. Có thể dùng để import lại sau.
      </p>
      <Button onClick={handleExport} disabled={isExporting} className="w-full gap-1.5">
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Đang export...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export {kind === 'notes' ? 'Notes' : 'Tasks'}
          </>
        )}
      </Button>
    </div>
  );
}

// ============================================================
// Import
// ============================================================
function ImportBlock({ kind }: { kind: BackupKind }) {
  const qc = useQueryClient();
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  async function handleImport(mode: 'merge' | 'replace', file: File) {
    if (mode === 'replace') {
      if (!window.confirm(`Replace all ${kind}? This wipes ALL data and replaces with the file. Cannot be undone.`)) return;
    }

    setIsImporting(true);
    setProgress({ current: 0, total: 0 });
    try {
      const result = await importData({
        kind,
        mode,
        file,
        onProgress: (current, total) => setProgress({ current, total }),
      });
      toast.success(`Đã import ${result.successCount}/${result.totalCount} records`);
      // Invalidate caches để các nơi khác (Notes/Tasks list) tự refresh
      qc.invalidateQueries({ queryKey: [kind] });
      qc.invalidateQueries({ queryKey: ['backup-stats', kind] });
    } catch (e) {
      toast.error('Import thất bại', { description: String(e) });
    } finally {
      setIsImporting(false);
      setProgress(null);
      if (mergeInputRef.current) mergeInputRef.current.value = '';
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  }

  return (
    <div className="border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
        <Upload className="h-4 w-4" />
        Import
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Tải lên file JSON đã export trước đó.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {/* Merge mode */}
        <div>
          <input
            ref={mergeInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport('merge', file);
            }}
          />
          <Button
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => mergeInputRef.current?.click()}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4" />
            Merge (thêm vào)
          </Button>
        </div>

        {/* Replace mode */}
        <div>
          <input
            ref={replaceInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImport('replace', file);
            }}
          />
          <Button
            variant="destructive"
            className="w-full gap-1.5"
            onClick={() => replaceInputRef.current?.click()}
            disabled={isImporting}
          >
            <AlertTriangle className="h-4 w-4" />
            Replace (xoá hết)
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {isImporting && progress && (
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Đang import...</span>
            <span className="font-mono">
              {progress.current}/{progress.total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden bg-background">
            <div
              className="h-full bg-primary transition-all duration-150"
              style={{
                width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}