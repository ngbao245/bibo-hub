// ============================================================
// ImportDialog — CSV/Excel import leads
// ============================================================
// Parse với papaparse (CSV). Excel chưa hỗ trợ (recommend user export CSV).
// Required columns: name (or full_name), email
// Batch insert 1 call → detect duplicate email server-side (đã tồn tại
// active leads) + báo failed rows với row number CHÍNH XÁC.
// ============================================================

import { useRef, useState } from 'react';
import { Upload, X, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { useBulkImportLeadsMutation } from '@/api/agency-studio/leads';
import { LoadingState } from '@/components/shared';

/** Gen file template CSV mẫu để user download */
function downloadTemplate() {
  const csv = [
    'full_name,email,company,phone,website',
    'Nguyễn Văn A,vana@example.com,Acme Corp,+84 912345678,https://acme.com',
    'Trần Thị B,thib@example.com,,,',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leads-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

interface RawRow {
  data: Record<string, string>;
  fileRow: number; // 1-based line trong file gốc (header = row 1)
}

interface ImportRow {
  full_name: string;
  email: string;
  company?: string;
  phone?: string;
  website?: string;
  __fileRow: number;
}

interface FailedRow {
  row: number;
  reason: string;
}

interface ParseResult {
  valid: ImportRow[];
  invalid: FailedRow[];
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeRows(rows: RawRow[]): ParseResult {
  const valid: ImportRow[] = [];
  const invalid: FailedRow[] = [];
  const seenInFile = new Set<string>();

  for (const r of rows) {
    const name = r.data['full_name'] || r.data['name'] || '';
    const email = (r.data['email'] || '').trim().toLowerCase();

    if (!name.trim()) {
      invalid.push({ row: r.fileRow, reason: 'Thiếu tên' });
      continue;
    }
    if (!email || !validateEmail(email)) {
      invalid.push({ row: r.fileRow, reason: `Email không hợp lệ: "${email}"` });
      continue;
    }
    if (seenInFile.has(email)) {
      invalid.push({ row: r.fileRow, reason: `Email trùng trong file: ${email}` });
      continue;
    }
    seenInFile.add(email);

    valid.push({
      full_name: name.trim(),
      email,
      company: r.data['company']?.trim() || undefined,
      phone: r.data['phone']?.trim() || undefined,
      website: r.data['website']?.trim() || undefined,
      __fileRow: r.fileRow,
    });
  }

  return { valid, invalid };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ImportDialog({ open, onOpenChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const importMut = useBulkImportLeadsMutation();
  const [result, setResult] = useState<{ imported: number; failed: FailedRow[] } | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setResult(null);

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        toast.error('Excel chưa được hỗ trợ. Vui lòng export sang CSV trước.');
        return;
      }
      if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
        toast.error('Chỉ hỗ trợ file CSV');
        return;
      }

      const text = await file.text();
      const Papa = await import('papaparse');
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
      });

      // Papa index bắt đầu từ 0 cho row đầu tiên sau header → file row =
      // idx + 2 (1 cho header + 1-based).
      const rows: RawRow[] = parsed.data.map((r, idx) => {
        const normalized: Record<string, string> = {};
        for (const k of Object.keys(r)) normalized[k.toLowerCase().trim()] = String(r[k] ?? '');
        return { data: normalized, fileRow: idx + 2 };
      });

      if (rows.length === 0) {
        toast.error('File trống hoặc không đọc được');
        return;
      }

      const { valid, invalid } = normalizeRows(rows);

      // Bulk insert 1 call → server detect duplicate với DB.
      const insertPayload = valid.map(({ __fileRow: _r, ...rest }) => rest);
      const { inserted, duplicates } = await importMut.mutateAsync(insertPayload);

      // Map duplicate email → file row để user biết dòng nào bị.
      const dupEmailSet = new Set(duplicates);
      const dupFailed: FailedRow[] = valid
        .filter((v) => dupEmailSet.has(v.email))
        .map((v) => ({ row: v.__fileRow, reason: `Email đã tồn tại: ${v.email}` }));

      const allFailed = [...invalid, ...dupFailed].sort((a, b) => a.row - b.row);

      setResult({ imported: inserted, failed: allFailed });

      if (inserted > 0) {
        toast.success(`Đã import ${inserted} lead`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import thất bại');
    }

    // Reset input để user có thể chọn cùng file lại
    if (fileRef.current) fileRef.current.value = '';
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-md bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Import Leads</h2>
          <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground">
          File CSV cần có cột <strong>name</strong> (hoặc <strong>full_name</strong>) và <strong>email</strong>.
          Cột tuỳ chọn: company, phone, website. Email trùng với lead đã có sẽ bị bỏ qua.
        </p>

        {!result ? (
          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="hidden"
            />
            <Button
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
              className="w-full gap-2"
            >
              {importMut.isPending ? <LoadingState variant="inline" label="Đang import..." /> : (
                <>
                  <Upload className="h-4 w-4" />
                  Chọn file CSV
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              disabled={importMut.isPending}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              Tải template CSV mẫu
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border border-border bg-muted/30 p-3 text-xs">
              <p className="text-success">Đã import thành công: {result.imported} lead</p>
              {result.failed.length > 0 && (
                <p className="mt-1 text-destructive">Bỏ qua {result.failed.length} dòng lỗi</p>
              )}
            </div>
            {result.failed.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1 border border-border p-2">
                {result.failed.map((f, i) => (
                  <p key={`${f.row}-${i}`} className="text-xs text-muted-foreground">
                    Dòng {f.row}: {f.reason}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>Import thêm</Button>
              <Button onClick={() => onOpenChange(false)}>Đóng</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}