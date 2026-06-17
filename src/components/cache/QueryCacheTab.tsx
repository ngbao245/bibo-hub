import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/cacheInspect';
import { toast } from '@/components/ui/sonner';

// ============================================================
// QueryCacheTab — list TanStack Query cache entries
// ============================================================

interface Props {
    refreshKey: number;
    onChange: () => void;
}

export default function QueryCacheTab({ refreshKey, onChange }: Props) {
    const qc = useQueryClient();

    // Collect tất cả queries trong cache
    const queries = useMemo(() => {
        const cache = qc.getQueryCache();
        return cache.getAll().map((q) => {
            const data = q.state.data;
            const json = data ? JSON.stringify(data) : '';
            return {
                key: JSON.stringify(q.queryKey),
                queryKey: q.queryKey,
                status: q.state.status, // 'pending' | 'error' | 'success'
                fetchStatus: q.state.fetchStatus, // 'idle' | 'fetching' | 'paused'
                dataUpdatedAt: q.state.dataUpdatedAt,
                size: new Blob([json]).size,
                data,
            };
        }).sort((a, b) => a.key.localeCompare(b.key));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey, qc]);

    const totalSize = queries.reduce((s, q) => s + q.size, 0);

    async function clearAll() {
        if (!window.confirm(`Clear ${queries.length} queries?`)) return;
        qc.clear();
        toast.success('Đã xoá tất cả queries');
        onChange();
    }

    if (queries.length === 0) {
        return (
            <div className="border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                Chưa có query nào trong cache
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{queries.length}</span> query ·{' '}
                    Tổng <span className="font-semibold text-foreground">{formatBytes(totalSize)}</span>
                </span>
                <Button variant="destructive" size="sm" onClick={clearAll} className="h-6 gap-1 px-2 text-xs">
                    <Trash2 className="h-3 w-3" />
                    Clear all queries
                </Button>
            </div>

            <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {queries.map((q) => (
                    <QueryRow
                        key={q.key}
                        keyStr={q.key}
                        queryKey={q.queryKey}
                        status={q.status}
                        fetchStatus={q.fetchStatus}
                        dataUpdatedAt={q.dataUpdatedAt}
                        size={q.size}
                        data={q.data}
                        onChange={onChange}
                    />
                ))}
            </div>
        </div>
    );
}

// ============================================================
function QueryRow({
    queryKey,
    keyStr,
    status,
    fetchStatus,
    dataUpdatedAt,
    size,
    data,
    onChange,
}: {
    queryKey: readonly unknown[];
    keyStr: string;
    status: string;
    fetchStatus: string;
    dataUpdatedAt: number;
    size: number;
    data: unknown;
    onChange: () => void;
}) {
    const qc = useQueryClient();
    const [expanded, setExpanded] = useState(false);

    function refetch() {
        qc.invalidateQueries({ queryKey });
        toast.success('Đang refetch...');
        setTimeout(onChange, 500);
    }

    function remove() {
        qc.removeQueries({ queryKey });
        toast.success('Đã xoá query');
        onChange();
    }

    const lastFetch = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('vi-VN') : '—';

    return (
        <div className="border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-2">
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                <code className="flex-1 truncate font-mono text-xs text-foreground">{keyStr}</code>

                <span className={cn(
                    'shrink-0 border px-1.5 py-0.5 text-[9px] uppercase',
                    status === 'success' && 'border-green-500/30 bg-green-500/10 text-green-500',
                    status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
                    status === 'error' && 'border-destructive/30 bg-destructive/10 text-destructive',
                )}>
                    {status}
                </span>

                {fetchStatus === 'fetching' && (
                    <span className="shrink-0 border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] uppercase text-primary">
                        fetching
                    </span>
                )}

                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatBytes(size)}
                </span>

                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {lastFetch}
                </span>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={refetch}
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                    title="Refetch"
                >
                    <RefreshCw className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={remove}
                    className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                    title="Remove"
                >
                    <Trash2 className="h-3 w-3" />
                </Button>
            </div>

            {expanded && (
                <div className="border-t border-border bg-background p-2">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                        {data ? JSON.stringify(data, null, 2) : '(no data)'}
                    </pre>
                </div>
            )}
        </div>
    );
}