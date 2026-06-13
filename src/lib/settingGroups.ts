
// ============================================================
// Group & Type helpers cho Setting
// ============================================================
//
// Group/type trong app là string động — distinct từ list record
// hiện có. Để user có thể "tạo group" trước khi có record nào,
// ta lưu thêm "ghost" group/type ở localStorage rồi merge vào
// danh sách hiển thị.
//
// Ghost tự dọn dẹp:
//   - Khi đã có record dùng tên đó, không cần ghost nữa, nhưng
//     ta vẫn giữ để đỡ phức tạp; merge sẽ dedupe.
//   - User có thể remove ghost qua UI.
// ============================================================

import type { Setting } from './setting';

const LS_GROUPS = 'setting_ghost_groups';
const LS_TYPES = 'setting_ghost_types'; // map: group → string[]

// ----------------------------------------------------------
// distinct từ data
// ----------------------------------------------------------

export function distinctGroups(list: Setting[]): string[] {
  const set = new Set<string>();
  for (const s of list) {
    const g = s.group.trim();
    if (g) set.add(g);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function distinctTypes(list: Setting[], group: string): string[] {
  const g = group.trim();
  const set = new Set<string>();
  for (const s of list) {
    if (s.group.trim() !== g) continue;
    const t = s.type.trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

// ----------------------------------------------------------
// Ghost groups (localStorage)
// ----------------------------------------------------------

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}

export function readGhostGroups(): string[] {
  const arr = readJson<string[]>(LS_GROUPS, []);
  return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}

export function addGhostGroup(name: string): string[] {
  const g = name.trim();
  if (!g) return readGhostGroups();
  const cur = readGhostGroups();
  if (cur.includes(g)) return cur;
  const next = [...cur, g];
  writeJson(LS_GROUPS, next);
  return next;
}

export function removeGhostGroup(name: string): string[] {
  const cur = readGhostGroups();
  const next = cur.filter((x) => x !== name);
  writeJson(LS_GROUPS, next);
  return next;
}

// ----------------------------------------------------------
// Ghost types (localStorage, theo group)
// ----------------------------------------------------------

type TypeMap = Record<string, string[]>;

export function readGhostTypes(group: string): string[] {
  const map = readJson<TypeMap>(LS_TYPES, {});
  const arr = map?.[group];
  return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}

export function addGhostType(group: string, name: string): string[] {
  const t = name.trim();
  const g = group.trim();
  if (!t || !g) return readGhostTypes(group);
  const map = readJson<TypeMap>(LS_TYPES, {});
  const cur = Array.isArray(map[g]) ? map[g] : [];
  if (cur.includes(t)) return cur;
  const next = [...cur, t];
  writeJson(LS_TYPES, { ...map, [g]: next });
  return next;
}

export function removeGhostType(group: string, name: string): string[] {
  const map = readJson<TypeMap>(LS_TYPES, {});
  const cur = Array.isArray(map[group]) ? map[group] : [];
  const next = cur.filter((x) => x !== name);
  writeJson(LS_TYPES, { ...map, [group]: next });
  return next;
}

// ----------------------------------------------------------
// Merge: distinct(data) ∪ ghost
// ----------------------------------------------------------

export function mergedGroups(list: Setting[]): string[] {
  const set = new Set<string>([...distinctGroups(list), ...readGhostGroups()]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function mergedTypes(list: Setting[], group: string): string[] {
  const set = new Set<string>([
    ...distinctTypes(list, group),
    ...readGhostTypes(group),
  ]);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Số record trong 1 group */
export function countInGroup(list: Setting[], group: string): number {
  const g = group.trim();
  return list.filter((s) => s.group.trim() === g).length;
}

/** Số record trong 1 (group, type) — type rỗng được match với type rỗng */
export function countInType(list: Setting[], group: string, type: string): number {
  const g = group.trim();
  const t = type.trim();
  return list.filter((s) => s.group.trim() === g && s.type.trim() === t).length;
}