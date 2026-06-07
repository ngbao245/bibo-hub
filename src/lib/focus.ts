import type { Task } from '@/schemas/task';
import type { Note } from '@/schemas/note';

// ============================================================
// Focus Algorithm - chọn task/note đáng quan tâm hôm nay
// ============================================================
//
// THUẬT TOÁN CHO TASKS:
//
// 1. Loại bỏ task đã completed.
// 2. Tính score cho mỗi task còn lại:
//    - Overdue (quá hạn):       score += 100  (ưu tiên cao nhất)
//    - Due today:               score += 80
//    - Due tomorrow:            score += 50
//    - Due trong 3 ngày tới:    score += 30
//    - Recurring task:          score += 40   (task lặp ngày)
//    - Priority 'high':         score += 20
//    - Không có dueDate:        score = 0     (task vô thời hạn, không vào focus)
// 3. Sort theo score giảm dần, lấy top N.
//
// THUẬT TOÁN CHO NOTES:
//
// 1. Chỉ lấy note loại 'note' (bỏ ielts, course, code, secret, source).
// 2. Sort theo updatedAt desc.
// 3. Lấy top N note đã update gần nhất.
//
// LÝ DO CHỌN APPROACH NÀY:
// - Score-based dễ tinh chỉnh (đổi số → đổi behavior)
// - Bao trùm các case quan trọng: overdue, today, tomorrow, recurring, high priority
// - Không cần backend, tính trên client từ data có sẵn
// ============================================================

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Trả về 0h00 của ngày bất kỳ → để so sánh ngày, không tính giờ */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Số ngày cách giữa 2 date (negative = past, positive = future) */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** Tính score "độ ưu tiên" cho 1 task. Cao hơn = đáng focus hơn. */
function scoreTask(task: Task, now: Date): number {
  if (task.status === 'completed') return -1;

  let score = 0;

  // Recurring task luôn có giá trị (task lặp hàng ngày)
  if (task.recurring) score += 40;

  // Priority high
  if (task.priority === 'high') score += 20;

  // Tính theo dueDate
  if (task.dueDate) {
    const days = daysBetween(now, new Date(task.dueDate));
    if (days < 0) {
      score += 100; // overdue
    } else if (days === 0) {
      score += 80; // today
    } else if (days === 1) {
      score += 50; // tomorrow
    } else if (days <= 3) {
      score += 30; // soon
    }
  } else {
    // Task không có dueDate nhưng mới tạo trong hôm nay → vẫn focus
    if (task.createdAt) {
      const createdDays = daysBetween(new Date(task.createdAt), now);
      if (createdDays === 0) score += 60; // mới tạo hôm nay
    }
  }

  // Task không có bất kỳ tín hiệu nào → không vào focus
  if (score === 0 && !task.recurring && task.priority !== 'high') {
    return 0;
  }

  return score;
}

/** Lấy top N task đáng focus. */
export function getFocusTasks(tasks: Task[], limit = 5): Task[] {
  const now = new Date();

  // Đơn giản: lấy tất cả task pending (chưa completed), sort theo score
  const pending = tasks.filter((t) => t.status !== 'completed');

  // DEBUG
  console.log('[getFocusTasks] Total tasks:', tasks.length, 'Pending:', pending.length);
  pending.forEach((t) => {
    const s = scoreTask(t, now);
    console.log(`  [${t.id}] "${t.title}" status=${t.status} dueDate=${t.dueDate} createdAt=${t.createdAt} → score=${s}`);
  });

  const scored = pending
    .map((task) => ({ task, score: scoreTask(task, now) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Fallback: nếu score-based không có gì, lấy N task pending mới nhất
  if (scored.length === 0 && pending.length > 0) {
    console.log('[getFocusTasks] FALLBACK: no scored tasks, returning newest pending');
    return pending
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
  }

  return scored.map(({ task }) => task);
}

/** Lấy top N note 'note' update gần nhất */
export function getFocusNotes(notes: Note[], limit = 3): Note[] {
  return notes
    .filter((n) => n.type === 'note')
    .filter((n) => n.updatedAt)
    .sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit);
}

// ============================================================
// Helper format hiển thị due date (Hôm nay / Ngày mai / Quá hạn 2 ngày)
// ============================================================

export function formatDueDate(dueDate: string): { label: string; tone: 'overdue' | 'today' | 'soon' | 'normal' } {
  const now = new Date();
  const days = daysBetween(now, new Date(dueDate));

  if (days < 0) {
    return { label: `Quá hạn ${Math.abs(days)} ngày`, tone: 'overdue' };
  }
  if (days === 0) {
    return { label: 'Hôm nay', tone: 'today' };
  }
  if (days === 1) {
    return { label: 'Ngày mai', tone: 'soon' };
  }
  if (days <= 7) {
    return { label: `Còn ${days} ngày`, tone: 'soon' };
  }

  // Format dd/MM
  const d = new Date(dueDate);
  return { label: `${d.getDate()}/${d.getMonth() + 1}`, tone: 'normal' };
}
