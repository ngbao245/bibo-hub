import { API } from './config';
import { fetchJson } from '@/api/client';

// ============================================================
// Backup utilities - export/import notes & tasks
// ============================================================
//
// Logic giữ nguyên v1: fetch toàn bộ records → JSON file (export);
// đọc JSON → POST từng record (import); replace mode = delete all trước.
//
// MockAPI không có bulk endpoint → import N items = N requests.
// Chậm với data lớn, nhưng đơn giản và đủ dùng.
// ============================================================

export type BackupKind = 'notes' | 'tasks';

interface ExportResult {
  count: number;
  filename: string;
}

interface ImportResult {
  successCount: number;
  totalCount: number;
}

// ============================================================
// Field signatures - phân biệt file backup notes vs tasks
// ============================================================

const NOTES_FIELDS = ['content', 'wordCountEnabled', 'timerDuration'] as const;
const TASKS_FIELDS = ['status', 'priority', 'dueDate', 'recurring', 'completedDate'] as const;

function detectKind(record: Record<string, unknown>): BackupKind | null {
  const hasNotesFields = NOTES_FIELDS.some((f) => f in record);
  const hasTasksFields = TASKS_FIELDS.some((f) => f in record);
  if (hasTasksFields && !hasNotesFields) return 'tasks';
  if (hasNotesFields && !hasTasksFields) return 'notes';
  return null;
}

// ============================================================
// Export
// ============================================================

export async function exportData(kind: BackupKind): Promise<ExportResult> {
  const url = kind === 'notes' ? API.NOTES : API.TASKS;
  const records = await fetchJson<unknown[]>(url);

  const json = JSON.stringify(records, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const date = new Date().toISOString().split('T')[0];
  const filename = `bibo-${kind}-backup-${date}.json`;

  // Trigger download bằng cách tạo link ảo và click
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(blobUrl);

  return { count: records.length, filename };
}

// ============================================================
// Import
// ============================================================

interface ImportOptions {
  kind: BackupKind;
  /** 'merge' = thêm vào, 'replace' = xoá hết rồi import */
  mode: 'merge' | 'replace';
  file: File;
  /** Callback báo progress (đã import bao nhiêu / tổng) — để UI hiển thị */
  onProgress?: (current: number, total: number) => void;
}

export async function importData(opts: ImportOptions): Promise<ImportResult> {
  const { kind, mode, file, onProgress } = opts;

  // Đọc file → parse JSON
  const text = await file.text();
  const data = JSON.parse(text);

  if (!Array.isArray(data)) {
    throw new Error('File không hợp lệ: phải là JSON array');
  }
  if (data.length === 0) {
    throw new Error('File rỗng');
  }

  // Validate file kind khớp với tab user chọn
  const detected = detectKind(data[0]);
  if (detected && detected !== kind) {
    throw new Error(
      `File này là backup ${detected === 'notes' ? 'Notes' : 'Tasks'}, không phải ${kind === 'notes' ? 'Notes' : 'Tasks'}`,
    );
  }

  const apiUrl = kind === 'notes' ? API.NOTES : API.TASKS;

  // Replace mode: xoá hết trước
  if (mode === 'replace') {
    await deleteAll(apiUrl);
  }

  // Import từng record. MockAPI không có bulk → loop request.
  let successCount = 0;
  for (let i = 0; i < data.length; i++) {
    const record = data[i] as Record<string, unknown>;
    const payload = sanitize(kind, record);

    try {
      await fetchJson(apiUrl, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      successCount++;
    } catch {
      // Bỏ qua record lỗi, tiếp tục
    }

    onProgress?.(i + 1, data.length);
  }

  return { successCount, totalCount: data.length };
}

/** Xoá hết records của 1 endpoint (dùng cho replace mode) */
async function deleteAll(apiUrl: string): Promise<void> {
  const records = await fetchJson<Array<{ id: string }>>(apiUrl);
  // Parallel delete
  await Promise.allSettled(
    records.map((r) => fetchJson(`${apiUrl}/${r.id}`, { method: 'DELETE' })),
  );
}

/** Chuẩn hoá record trước khi POST: thêm timestamp, default values */
function sanitize(kind: BackupKind, record: Record<string, unknown>): Record<string, unknown> {
  const now = new Date().toISOString();
  if (kind === 'notes') {
    return {
      title: record.title || 'Untitled',
      content: record.content || '',
      type: record.type || 'note',
      source: record.source || '',
      tags: record.tags || '',
      example: record.example || '',
      url1: record.url1 || '',
      url2: record.url2 || '',
      url3: record.url3 || '',
      url4: record.url4 || '',
      url5: record.url5 || '',
      wordCountEnabled: record.wordCountEnabled ?? false,
      timerDuration: record.timerDuration || '0',
      createdAt: record.createdAt || now,
      updatedAt: now,
    };
  }
  // tasks
  return {
    type: record.type || 'task',
    title: record.title || '',
    name: record.name || '',
    description: record.description || '',
    parentId: record.parentId || '',
    status: record.status || 'pending',
    priority: record.priority || 'normal',
    dueDate: record.dueDate || '',
    recurring: record.recurring ?? false,
    url1: record.url1 || '',
    url2: record.url2 || '',
    url3: record.url3 || '',
    createdAt: record.createdAt || now,
    updatedAt: now,
    completedDate: record.completedDate || '',
  };
}

// ============================================================
// Statistics
// ============================================================

export interface NotesStats {
  total: number;
  byType: Record<string, number>;
}

export async function getNotesStats(): Promise<NotesStats> {
  const records = await fetchJson<Array<{ type?: string }>>(API.NOTES);
  const byType: Record<string, number> = {};
  for (const r of records) {
    const t = r.type || 'note';
    byType[t] = (byType[t] || 0) + 1;
  }
  return { total: records.length, byType };
}

export interface TasksStats {
  total: number;
  pending: number;
  completed: number;
  lists: number;
}

export async function getTasksStats(): Promise<TasksStats> {
  const records = await fetchJson<Array<{ type?: string; status?: string }>>(API.TASKS);
  const stats: TasksStats = { total: 0, pending: 0, completed: 0, lists: 0 };
  for (const r of records) {
    if (r.type === 'list') {
      stats.lists++;
    } else {
      stats.total++;
      if (r.status === 'completed') stats.completed++;
      else stats.pending++;
    }
  }
  return stats;
}
