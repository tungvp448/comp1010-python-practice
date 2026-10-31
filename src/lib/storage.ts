import type { ActiveAttempt, Progress, QuestionStat, SubmittedAttempt } from '../types';
import { HISTORY_LIMIT } from './attempt';

/**
 * Per-browser persistence. Two separate keys: the in-progress attempt and the submitted
 * history/progress, each wrapped in { version, data }. If storage is unavailable or a value
 * is corrupt, the app keeps working from memory and shows a notice.
 */
export const STORAGE_VERSION = 1;
export const PROGRESS_KEY = 'comp1010.progress';
export const ACTIVE_KEY = 'comp1010.active';
export const EXPORT_FORMAT = 'comp1010-progress';

export const emptyProgress = (): Progress => ({ bookmarks: [], stats: {}, history: [] });

export interface Store {
  available: boolean;
  notices: string[];
  loadProgress(): Progress;
  saveProgress(p: Progress): void;
  loadActive(): ActiveAttempt | null;
  saveActive(a: ActiveAttempt | null): void;
}

export function detectStorage(): Storage | null {
  try {
    const s = window.localStorage;
    const k = '__comp1010_probe__';
    s.setItem(k, '1');
    s.removeItem(k);
    return s;
  } catch {
    return null;
  }
}

export function createStore(storage: Storage | null): Store {
  const memory = new Map<string, string>();
  const notices: string[] = [];
  if (!storage) {
    notices.push(
      'Trình duyệt không cho phép lưu dữ liệu (localStorage). Tiến độ chỉ giữ tạm thời và sẽ mất khi đóng/tải lại trang.',
    );
  }

  const get = (key: string): string | null => {
    if (!storage) return memory.get(key) ?? null;
    try {
      return storage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  };
  const set = (key: string, value: string | null) => {
    if (value === null) memory.delete(key);
    else memory.set(key, value);
    if (!storage) return;
    try {
      if (value === null) storage.removeItem(key);
      else storage.setItem(key, value);
    } catch {
      const msg = 'Không ghi được vào bộ nhớ trình duyệt (có thể đã đầy). Thay đổi mới chỉ giữ tạm thời trong tab này.';
      if (!notices.includes(msg)) notices.push(msg);
    }
  };

  function read<T>(key: string, check: (d: unknown) => d is T, label: string): T | null {
    const raw = get(key);
    if (raw === null) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version !== STORAGE_VERSION) throw new Error('version');
      if (!check(parsed.data)) throw new Error('shape');
      return parsed.data;
    } catch {
      // Keep the unreadable value for manual recovery, then start fresh.
      set(`${key}.corrupt.${Date.now()}`, raw);
      set(key, null);
      notices.push(`Dữ liệu ${label} đã lưu bị hỏng hoặc không tương thích nên đã được bỏ qua (bản cũ được giữ riêng).`);
      return null;
    }
  }

  return {
    available: storage !== null,
    notices,
    loadProgress: () => read(PROGRESS_KEY, isProgress, 'tiến độ') ?? emptyProgress(),
    saveProgress: (p) => set(PROGRESS_KEY, JSON.stringify({ version: STORAGE_VERSION, data: p })),
    loadActive: () => read(ACTIVE_KEY, isActiveAttempt, 'bài đang làm'),
    saveActive: (a) => set(ACTIVE_KEY, a === null ? null : JSON.stringify({ version: STORAGE_VERSION, data: a })),
  };
}

// ---- shape checks (defensive, not exhaustive) ----

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStrArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

function isStat(v: unknown): v is QuestionStat {
  return (
    isObj(v) &&
    typeof v.correct === 'number' &&
    typeof v.wrong === 'number' &&
    (v.last === 'correct' || v.last === 'wrong') &&
    typeof v.lastAt === 'number'
  );
}

function isItemList(v: unknown): boolean {
  return (
    Array.isArray(v) &&
    v.every(
      (i) =>
        isObj(i) &&
        typeof i.id === 'string' &&
        isStrArray(i.optionOrder) &&
        isStrArray(i.correctOptionIds) &&
        typeof i.qHash === 'string',
    )
  );
}

export function isSubmittedAttempt(v: unknown): v is SubmittedAttempt {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    isObj(v.config) &&
    typeof v.submittedAt === 'number' &&
    isObj(v.score) &&
    isItemList(v.items) &&
    (v.items as unknown[]).every((i) => isObj(i) && typeof i.correct === 'boolean')
  );
}

export function isProgress(v: unknown): v is Progress {
  return (
    isObj(v) &&
    isStrArray(v.bookmarks) &&
    isObj(v.stats) &&
    Object.values(v.stats).every(isStat) &&
    Array.isArray(v.history) &&
    v.history.every(isSubmittedAttempt)
  );
}

export function isActiveAttempt(v: unknown): v is ActiveAttempt {
  return (
    isObj(v) &&
    typeof v.id === 'string' &&
    isObj(v.config) &&
    (v.deadline === null || typeof v.deadline === 'number') &&
    isItemList(v.items) &&
    isObj(v.responses) &&
    typeof v.current === 'number' &&
    isStrArray(v.flagged)
  );
}

// ---- export / import ----

export function exportProgress(p: Progress, now: number): string {
  return JSON.stringify(
    { format: EXPORT_FORMAT, version: STORAGE_VERSION, exportedAt: new Date(now).toISOString(), data: p },
    null,
    2,
  );
}

export type ImportResult = { ok: true; progress: Progress } | { ok: false; error: string };

export function parseImport(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File không phải JSON hợp lệ.' };
  }
  if (!isObj(parsed) || parsed.format !== EXPORT_FORMAT) {
    return { ok: false, error: 'File không phải bản export tiến độ của trang này.' };
  }
  if (parsed.version !== STORAGE_VERSION) {
    return { ok: false, error: `Phiên bản file (${String(parsed.version)}) không được hỗ trợ.` };
  }
  if (!isProgress(parsed.data)) return { ok: false, error: 'Nội dung tiến độ trong file không đúng cấu trúc.' };
  return { ok: true, progress: parsed.data };
}

/**
 * Merge imported progress into current progress without discarding anything already here:
 * bookmarks are unioned, history is unioned by attempt id, and for each question the stat
 * with the most recent answer wins.
 */
export function mergeProgress(current: Progress, incoming: Progress): Progress {
  const bookmarks = [...new Set([...current.bookmarks, ...incoming.bookmarks])];
  const history = new Map<string, SubmittedAttempt>();
  for (const h of [...current.history, ...incoming.history]) if (!history.has(h.id)) history.set(h.id, h);
  const stats: Record<string, QuestionStat> = { ...current.stats };
  for (const [id, s] of Object.entries(incoming.stats)) {
    if (!stats[id] || s.lastAt > stats[id].lastAt) stats[id] = s;
  }
  return {
    bookmarks,
    stats,
    history: [...history.values()].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, HISTORY_LIMIT),
  };
}
