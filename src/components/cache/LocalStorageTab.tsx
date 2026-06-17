import { useMemo, useState } from 'react';
import { Trash2, Edit, Save, X, ChevronRight, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatBytes, getAllLocalStorage, getLocalStorageTotalSize } from '@/lib/cacheInspect';
import { toast } from '@/components/ui/sonner';

// ============================================================
// LocalStorageTab — list + view + edit + delete localStorage entries
// ============================================================

interface Props {
    refreshKey: number;
    onChange: () => void;
}

export default function LocalStorageTab({ refreshKey, onChange }: Props) {
    const entries = useMemo(() => getAllLocalStorage(), [refreshKey]);
    const totalSize = useMemo(() => getLocalStorageTotalSize(), [refreshKey]);

    async function clearAll() {
        if (!window.confirm(`Clear ${entries.length} keys? LocalStorage will be wiped.`)) return;
        localStorage.clear();
        toast.success('Đã xoá tất cả');
        onChange();
    }

    if (entries.length === 0) {
        return (
            <div className="border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                LocalStorage trống
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between border border-border bg-card px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{entries.length}</span> keys ·{' '}
                    Tổng <span className="font-semibold text-foreground">{formatBytes(totalSize)}</span>
                </span>
                <Button variant="destructive" size="sm" onClick={clearAll} className="h-6 gap-1 px-2 text-xs">
                    <Trash2 className="h-3 w-3" />
                    Clear all keys
                </Button>
            </div>

            <div className="max-h-[60vh] space-y-1 overflow-y-auto">
                {entries.map((entry) => (
                    <EntryRow key={entry.key} entry={entry} onChange={onChange} />
                ))}
            </div>
        </div>
    );
}

// ============================================================
function EntryRow({
    entry,
    onChange,
}: {
    entry: import('@/lib/cacheInspect').LocalStorageEntry;
    onChange: () => void;
}) {
    const [expanded, setExpanded] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editValue, setEditValue] = useState(entry.rawValue);

    function startEdit() {
        setEditing(true);
        setExpanded(true);
        // Format JSON nếu có thể
        try {
            const parsed = JSON.parse(entry.rawValue);
            setEditValue(JSON.stringify(parsed, null, 2));
        } catch {
            setEditValue(entry.rawValue);
        }
    }

    function saveEdit() {
        try {
            // Validate: nếu raw là JSON thì save phải parse được
            if (entry.rawValue.startsWith('{') || entry.rawValue.startsWith('[') || entry.rawValue.startsWith('"')) {
                JSON.parse(editValue); // throw nếu invalid
            }
            // Save value gốc (không có whitespace formatting)
            try {
                const parsed = JSON.parse(editValue);
                localStorage.setItem(entry.key, JSON.stringify(parsed));
            } catch {
                localStorage.setItem(entry.key, editValue);
            }
            toast.success('Đã lưu');
            setEditing(false);
            onChange();
        } catch (e) {
            toast.error('JSON không hợp lệ', { description: String(e) });
        }
    }

    function cancelEdit() {
        setEditing(false);
        setEditValue(entry.rawValue);
    }

    async function remove() {
        if (!window.confirm(`Delete key "${entry.key}"?`)) return;
        localStorage.removeItem(entry.key);
        toast.success('Đã xoá');
        onChange();
    }

    // Preview text khi collapsed
    const preview = entry.rawValue.length > 60
        ? entry.rawValue.slice(0, 60) + '...'
        : entry.rawValue;

    return (
        <div className="border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-2">
                <button
                    onClick={() => !editing && setExpanded((v) => !v)}
                    className="text-muted-foreground hover:text-foreground"
                    disabled={editing}
                >
                    {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>

                <code className="font-mono text-xs font-medium text-primary shrink-0">{entry.key}</code>

                {!expanded && (
                    <span className="flex-1 truncate font-mono text-[10px] text-muted-foreground">
                        {preview}
                    </span>
                )}

                <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                    {formatBytes(entry.size)}
                </span>

                {!editing && (
                    <>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={startEdit}
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                            title="Edit"
                        >
                            <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={remove}
                            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                            title="Delete"
                        >
                            <Trash2 className="h-3 w-3" />
                        </Button>
                    </>
                )}
            </div>

            {expanded && !editing && (
                <div className="border-t border-border bg-background p-2">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-muted-foreground">
                        {(() => {
                            try {
                                return JSON.stringify(JSON.parse(entry.rawValue), null, 2);
                            } catch {
                                return entry.rawValue;
                            }
                        })()}
                    </pre>
                </div>
            )}

            {editing && (
                <div className="border-t border-border bg-background p-2 space-y-2">
                    <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="block min-h-[150px] w-full resize-y border border-input bg-background p-2 font-mono text-xs focus:border-primary focus:outline-none"
                        spellCheck={false}
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit} className="h-7 gap-1 px-2 text-xs">
                            <X className="h-3 w-3" />
                            Huỷ
                        </Button>
                        <Button size="sm" onClick={saveEdit} className="h-7 gap-1 px-2 text-xs">
                            <Save className="h-3 w-3" />
                            Lưu
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}