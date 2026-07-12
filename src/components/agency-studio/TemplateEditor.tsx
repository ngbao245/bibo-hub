// ============================================================
// TemplateEditor — Create/Edit template với variable highlight + preview
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, X, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/shared';
import {
  useCreateTemplateMutation,
  useUpdateTemplateMutation,
  renderTemplate,
  SAMPLE_VARS,
  type Template,
} from '@/api/agency-studio/templates';
import { toast } from 'sonner';
import { cn } from '@/lib/cn';
import { AIGenerateDialog } from './AIGenerateDialog';
import { generateEmail, type EmailTone } from '@/api/agency-studio/ai-generate';

const DYNAMIC_VARS = ['{{name}}', '{{email}}', '{{phone}}', '{{company}}', '{{website}}'];
const VAR_REGEX = /\{\{\w+\}\}/g;

/** Highlight dynamic vars in preview text */
function HighlightedBody({ text }: { text: string }) {
  const parts = text.split(VAR_REGEX);
  const matches = text.match(VAR_REGEX) ?? [];
  return (
    <span>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {matches[i] && (
            <mark className="rounded bg-primary/20 px-0.5 text-primary">{matches[i]}</mark>
          )}
        </span>
      ))}
    </span>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  template?: Template | null;
}

export default function TemplateEditor({ open, onOpenChange, template }: Props) {
  const createMut = useCreateTemplateMutation();
  const updateMut = useUpdateTemplateMutation();
  const isEdit = Boolean(template);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [category, setCategory] = useState(template?.category ?? '');
  const [preview, setPreview] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; subject?: string; body?: string }>({});
  const [lastFocused, setLastFocused] = useState<'subject' | 'body'>('body');

  // AI generate state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTone, setAiTone] = useState<EmailTone | null>(null);

  /**
   * Handle user chọn tone → stream generate. Snapshot cũ trước overwrite,
   * update subject/body incremental theo delta, cuối cùng show undo toast.
   */
  async function handleGenerateTone(tone: EmailTone) {
    const snapshotSubject = subject;
    const snapshotBody = body;

    setAiGenerating(true);
    setAiTone(tone);

    try {
      const result = await generateEmail({
        tone,
        currentSubject: snapshotSubject,
        currentBody: snapshotBody,
      });

      setSubject(result.subject);
      setBody(result.body);

      toast.success(`Đã gen template mới với tone ${tone}`, {
        duration: 10_000,
        action: {
          label: 'Hoàn tác',
          onClick: () => {
            setSubject(snapshotSubject);
            setBody(snapshotBody);
          },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'AI generate thất bại');
    } finally {
      setAiGenerating(false);
      setAiTone(null);
    }
  }

  // Sync form state khi dialog mở lại với template khác (edit → edit khác)
  // hoặc chuyển từ new → edit. Chỉ chạy khi identity template thay đổi
  // hoặc khi dialog toggle mở, KHÔNG chạy khi user typing.
  useEffect(() => {
    if (!open) return;
    if (template) {
      setName(template.name);
      setSubject(template.subject);
      setBody(template.body);
      setCategory(template.category ?? '');
    } else {
      setName('');
      setSubject('');
      setBody('');
      setCategory('');
    }
    setErrors({});
  }, [template, open]);

  function insertVar(v: string) {
    // Route target theo field user vừa focus. Nếu chưa focus → default body.
    if (lastFocused === 'subject') {
      const input = subjectRef.current;
      if (!input) { setSubject((s) => s + v); return; }
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + v + subject.slice(end);
      setSubject(next);
      setTimeout(() => {
        input.selectionStart = input.selectionEnd = start + v.length;
        input.focus();
      }, 0);
      return;
    }

    const ta = bodyRef.current;
    if (!ta) {
      setBody((b) => b + v);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = body.slice(0, start) + v + body.slice(end);
    setBody(next);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + v.length;
      ta.focus();
    }, 0);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!name.trim()) errs.name = 'Tên template không được để trống';
    if (!subject.trim()) errs.subject = 'Subject không được để trống';
    if (!body.trim()) errs.body = 'Nội dung không được để trống';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      const payload = {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
        category: category.trim() || undefined,
      };
      if (isEdit && template) {
        await updateMut.mutateAsync({ id: template.id, ...payload });
        toast.success('Đã cập nhật template');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Đã tạo template mới');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu template');
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;
  // Disable toàn bộ form khi AI đang gen HOẶC save đang chạy.
  const inputsDisabled = isPending || aiGenerating;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">{isEdit ? 'Chỉnh sửa template' : 'Template mới'}</h2>
          {aiGenerating && aiTone && (
            <div className="flex items-center gap-1.5 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
              <Sparkles className="h-3 w-3 animate-pulse" />
              <span>AI đang gen với tone {aiTone}...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAiDialogOpen(true)}
            disabled={inputsDisabled}
            className="gap-1"
            title="AI generate template"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreview((p) => !p)}
            disabled={inputsDisabled}
            className="gap-1"
          >
            {preview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? 'Editor' : 'Preview'}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={inputsDisabled} className="gap-1">
            {isPending ? <LoadingState variant="inline" label="Đang lưu" /> : 'Lưu'}
          </Button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={inputsDisabled}
            className="text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: form */}
        <div className={cn('flex flex-col space-y-3 overflow-y-auto border-r border-border p-4', preview ? 'w-1/2' : 'w-full')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Tên template *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={inputsDisabled}
                placeholder="Cold outreach v1"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={inputsDisabled}
                placeholder="outreach, follow-up..."
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Subject *</label>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => setLastFocused('subject')}
              disabled={inputsDisabled}
              placeholder="Hey {{name}}, quick question"
            />
            {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
          </div>

          {/* Variable insert buttons */}
          <div className="flex flex-wrap gap-1">
            <span className="text-xs text-muted-foreground self-center">Insert:</span>
            {DYNAMIC_VARS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => insertVar(v)}
                disabled={inputsDisabled}
                className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground">
              Body * <span className="text-muted-foreground/70">— click Insert sẽ chèn vào field đang focus</span>
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => setLastFocused('body')}
              disabled={inputsDisabled}
              placeholder="Hi {{name}},&#10;&#10;I noticed {{company}} is..."
              rows={16}
              className="w-full resize-none border border-border bg-background px-3 py-2 font-mono text-xs focus:border-primary focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
          </div>
        </div>

        {/* Right: preview */}
        {preview && (
          <div className="w-1/2 overflow-y-auto p-4">
            <p className="mb-3 text-xs text-muted-foreground">Preview với sample data:</p>
            <div className="space-y-3 border border-border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Subject:</span>{' '}
                <HighlightedBody text={renderTemplate(subject, SAMPLE_VARS)} />
              </div>
              <hr className="border-border" />
              <pre className="whitespace-pre-wrap text-xs text-foreground font-sans">
                <HighlightedBody text={renderTemplate(body, SAMPLE_VARS)} />
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* AI generate dialog — chỉ chọn tone, gen chạy background */}
      <AIGenerateDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        onSelect={handleGenerateTone}
        hasCurrentDraft={Boolean(subject.trim() || body.trim())}
      />
    </div>
  );
}