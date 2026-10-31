import { describe, expect, it } from 'vitest';
import { applySubmission, createAttempt, gradeAttempt, recordResult } from '../src/lib/attempt';
import { createRng } from '../src/lib/rng';
import {
  ACTIVE_KEY,
  PROGRESS_KEY,
  createStore,
  emptyProgress,
  exportProgress,
  mergeProgress,
  parseImport,
} from '../src/lib/storage';
import { MemoryStorage, config, makeQuestion } from './helpers';

const pool = Array.from({ length: 6 }, (_, i) => makeQuestion(`L02-Q${i}`, 2, `f${i}`));

describe('active attempt persistence (refresh)', () => {
  it('restores questions, option order, choices, position and deadline exactly', () => {
    const storage = new MemoryStorage();
    let a = createAttempt(config({ count: 5, timeLimitMin: 20 }), pool, 'h', 1_000, createRng(9));
    a = { ...a, current: 3, flagged: [a.items[1].id], responses: { ...a.responses, [a.items[0].id]: { chosen: 'o2' } } };
    createStore(storage).saveActive(a);

    const restored = createStore(storage).loadActive(); // simulates a page reload
    expect(restored).toEqual(a);
    expect(restored!.items.map((i) => i.optionOrder)).toEqual(a.items.map((i) => i.optionOrder));
    expect(restored!.deadline).toBe(1_000 + 20 * 60_000);
  });

  it('keeps active attempt and history in separate keys', () => {
    const storage = new MemoryStorage();
    const s = createStore(storage);
    s.saveActive(createAttempt(config(), pool, 'h', 0, createRng(1)));
    s.saveProgress(emptyProgress());
    expect(storage.keys().sort()).toEqual([ACTIVE_KEY, PROGRESS_KEY].sort());
    s.saveActive(null);
    expect(storage.keys()).toEqual([PROGRESS_KEY]);
  });

  it('falls back to defaults and warns on corrupt JSON, keeping a backup', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, '{not json');
    storage.setItem(ACTIVE_KEY, JSON.stringify({ version: 1, data: { nope: true } }));
    const s = createStore(storage);
    expect(s.loadProgress()).toEqual(emptyProgress());
    expect(s.loadActive()).toBeNull();
    expect(s.notices.length).toBe(2);
    expect(storage.keys().some((k) => k.startsWith(`${PROGRESS_KEY}.corrupt.`))).toBe(true);
  });

  it('rejects data from another storage version', () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 999, data: emptyProgress() }));
    expect(createStore(storage).loadProgress()).toEqual(emptyProgress());
  });

  it('works in memory when storage is unavailable', () => {
    const s = createStore(null);
    expect(s.available).toBe(false);
    expect(s.notices[0]).toMatch(/localStorage/);
    const p = recordResult(emptyProgress(), 'x', true, 1);
    s.saveProgress(p);
    expect(s.loadProgress()).toEqual(p);
  });

  it('keeps working in memory when writes throw (quota / denied)', () => {
    const s = createStore(new MemoryStorage(true));
    const p = recordResult(emptyProgress(), 'x', false, 1);
    s.saveProgress(p);
    expect(s.loadProgress()).toEqual(p);
    expect(s.notices.length).toBeGreaterThan(0);
  });

  it('two browser profiles (separate storages) do not affect each other', () => {
    const profileA = createStore(new MemoryStorage());
    const profileB = createStore(new MemoryStorage());
    profileA.saveProgress(recordResult(emptyProgress(), 'L02-Q1', false, 1));
    profileA.saveActive(createAttempt(config(), pool, 'h', 0, createRng(1)));
    expect(profileB.loadProgress()).toEqual(emptyProgress());
    expect(profileB.loadActive()).toBeNull();
  });
});

describe('export / import', () => {
  function progressWithAttempt(seed: number, chosen: string) {
    let a = createAttempt(config({ count: 2 }), pool, 'h', seed, createRng(seed));
    a = { ...a, responses: { ...a.responses, [a.items[0].id]: { chosen } } };
    return applySubmission(emptyProgress(), gradeAttempt(a, seed + 100, false));
  }

  it('round-trips through export and parse', () => {
    const p = { ...progressWithAttempt(1, 'o3'), bookmarks: ['L02-Q1'] };
    const r = parseImport(exportProgress(p, 0));
    expect(r).toEqual({ ok: true, progress: p });
  });

  it('merging keeps existing history, bookmarks and newer stats', () => {
    const here = { ...progressWithAttempt(1, 'o3'), bookmarks: ['A'] };
    const there = { ...progressWithAttempt(2, 'o1'), bookmarks: ['B'] };
    const merged = mergeProgress(here, there);
    expect(merged.history.map((h) => h.id).sort()).toEqual([...here.history, ...there.history].map((h) => h.id).sort());
    expect(merged.bookmarks.sort()).toEqual(['A', 'B']);
    // Importing the same file again does not duplicate anything.
    expect(mergeProgress(merged, there)).toEqual(merged);
    // Per-question stats: most recent answer wins.
    const older = recordResult(emptyProgress(), 'Q', false, 10);
    const newer = recordResult(emptyProgress(), 'Q', true, 20);
    expect(mergeProgress(newer, older).stats.Q.last).toBe('correct');
    expect(mergeProgress(older, newer).stats.Q.last).toBe('correct');
  });

  it('rejects invalid files with a message', () => {
    expect(parseImport('nope')).toMatchObject({ ok: false });
    expect(parseImport(JSON.stringify({ format: 'other' }))).toMatchObject({ ok: false });
    expect(
      parseImport(JSON.stringify({ format: 'comp1010-progress', version: 1, data: { bookmarks: 'x' } })),
    ).toMatchObject({ ok: false });
  });
});
