// ============================================================
// LeadForm — Create / Edit lead trong Sheet (dialog)
// ============================================================

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useCreateLeadMutation,
  useUpdateLeadMutation,
  LEAD_STATUSES,
  type Lead,
  type LeadStatus,
} from '@/api/agency-studio/leads';
import { LoadingState } from '@/components/shared';

interface FormState {
  full_name: string;
  email: string;
  company: string;
  phone: string;
  website: string;
  status: LeadStatus;
  notes: string;
}

const defaultForm: FormState = {
  full_name: '',
  email: '',
  company: '',
  phone: '',
  website: '',
  status: 'New',
  notes: '',
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  lead?: Lead | null;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LeadForm({ open, onOpenChange, lead }: Props) {
  const createMut = useCreateLeadMutation();
  const updateMut = useUpdateLeadMutation();
  const isEdit = Boolean(lead);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (lead) {
      setForm({
        full_name: lead.full_name,
        email: lead.email,
        company: lead.company ?? '',
        phone: lead.phone ?? '',
        website: lead.website ?? '',
        status: lead.status,
        notes: lead.notes ?? '',
      });
    } else {
      setForm(defaultForm);
    }
    setErrors({});
  }, [lead, open]);

  function patch(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!form.full_name.trim()) errs.full_name = 'Tên không được để trống';
    if (!form.email.trim()) errs.email = 'Email không được để trống';
    else if (!validateEmail(form.email.trim())) errs.email = 'Email không hợp lệ';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      };
      if (isEdit && lead) {
        await updateMut.mutateAsync({ id: lead.id, ...payload });
        toast.success('Đã cập nhật lead');
      } else {
        await createMut.mutateAsync(payload);
        toast.success('Đã thêm lead mới');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi lưu lead');
    }
  }

  const isPending = createMut.isPending || updateMut.isPending;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />

      {/* Panel */}
      <div className="relative z-10 flex w-full max-w-md flex-col bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{isEdit ? 'Chỉnh sửa lead' : 'Thêm lead mới'}</h2>
          <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 space-y-3 overflow-y-auto p-4">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Họ tên *</label>
            <Input value={form.full_name} onChange={(e) => patch('full_name', e.target.value)} placeholder="Nguyễn Văn A" />
            {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Email *</label>
            <Input type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} placeholder="email@domain.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Công ty</label>
              <Input value={form.company} onChange={(e) => patch('company', e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={(e) => patch('status', e.target.value)}
                className="w-full border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
              >
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input value={form.phone} onChange={(e) => patch('phone', e.target.value)} placeholder="+84 9xx..." />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Website</label>
              <Input value={form.website} onChange={(e) => patch('website', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
              placeholder="Ghi chú về lead..."
              rows={3}
              className="w-full border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Huỷ</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <LoadingState variant="inline" label="Đang lưu" /> : isEdit ? 'Cập nhật' : 'Thêm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}