// ============================================================
// GeminiCreditPoolTab — Config credit pool Gemini dùng chung
// ============================================================
// Tất cả feature dùng Gemini (RAG search, Agency Studio AI generate,
// và feature AI khác trong tương lai) đọc pool này. Mỗi entry là 1
// Google account = quota N × 1500 RPD.
//
// DB key: app_settings.key = 'gemini_credit_pool'
// (trước đây tên 'rag_tokens', đã rename 2026-07-12)
// ============================================================

import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { useSettingQuery, useUpdateSettingMutation, type GeminiKeyEntry } from '@/api/settingsApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, ErrorState, LoadingState } from '@/components/shared';

interface DraftKey {
  rid: string;
  name: string;
  value: string;
  visible: boolean;
}

function newRid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function GeminiCreditPoolTab() {
  const query = useSettingQuery('gemini_credit_pool');
  const update = useUpdateSettingMutation('gemini_credit_pool');

  const [draft, setDraft] = useState<DraftKey[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (query.data) {
      setDraft(
        query.data.keys.map((entry: GeminiKeyEntry | string) =>
          typeof entry === 'string'
            ? { rid: newRid(), name: '', value: entry, visible: false }
            : { rid: newRid(), name: entry.name ?? '', value: entry.key, visible: false },
        ),
      );
      setDirty(false);
    } else if (query.data === null && !query.isLoading) {
      setDraft([]);
      setDirty(false);
    }
  }, [query.data, query.isLoading]);

  if (query.isLoading) {
    return <LoadingState variant="skeleton" count={4} layout="list" itemClassName="h-10 w-full" />;
  }
  if (query.isError) {
    return (
      <ErrorState
        message={query.error instanceof Error ? query.error.message : 'Load fail'}
        onRetry={() => query.refetch()}
      />
    );
  }

  function updateItem(rid: string, patch: Partial<DraftKey>) {
    setDraft((d) => d.map((x) => (x.rid === rid ? { ...x, ...patch } : x)));
    setDirty(true);
  }

  function removeItem(rid: string) {
    setDraft((d) => d.filter((x) => x.rid !== rid));
    setDirty(true);
  }

  function addItem() {
    setDraft((d) => [...d, { rid: newRid(), name: '', value: '', visible: true }]);
    setDirty(true);
  }

  async function handleSave() {
    const keys: GeminiKeyEntry[] = draft
      .filter((x) => x.value.trim().length > 0)
      .map((x) => ({ name: x.name.trim(), key: x.value.trim() }));
    try {
      await update.mutateAsync({ keys });
      toast.success(`Đã lưu ${keys.length} Gemini key`);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save fail');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-foreground">Gemini Credit Pool</h3>
          <p className="text-xs text-muted-foreground">
            Key pool dùng chung cho mọi feature AI (RAG search, AI generate email...). Mỗi key = 1 Google account, tăng quota N × 1500 RPD.
          </p>
        </div>
        <Button onClick={addItem} variant="outline" size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Thêm
        </Button>
      </div>

      {draft.length === 0 ? (
        <EmptyState
          compact
          icon={KeyRound}
          title="Chưa có key nào"
          description="Thêm ít nhất 1 Gemini API key để dùng các feature AI."
        />
      ) : (
        <div className="space-y-2">
          {draft.map((item, idx) => (
            <div key={item.rid} className="flex items-center gap-2">
              <span className="w-6 text-xs text-muted-foreground">{idx + 1}.</span>
              <Input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(item.rid, { name: e.target.value })}
                placeholder="Tên (VD: Gmail cá nhân)"
                className="w-36 text-xs"
              />
              <Input
                type={item.visible ? 'text' : 'password'}
                value={item.value}
                onChange={(e) => updateItem(item.rid, { value: e.target.value })}
                placeholder="AIzaSy..."
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => updateItem(item.rid, { visible: !item.visible })}
              >
                {item.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(item.rid)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button onClick={handleSave} disabled={!dirty || update.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {update.isPending ? 'Đang lưu...' : 'Lưu'}
        </Button>
        {dirty && <span className="text-xs text-warning">Có thay đổi chưa lưu</span>}
      </div>
    </div>
  );
}