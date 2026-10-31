import { describe, expect, it } from 'vitest';
import rawBank from '../data/question_bank.json';
import { filterPool, lectureQuotas, selectQuestions } from '../src/lib/sampling';
import { createRng } from '../src/lib/rng';
import { emptyProgress } from '../src/lib/storage';
import type { Bank } from '../src/types';
import { makeQuestion } from './helpers';

const bank = rawBank as unknown as Bank;

describe('selectQuestions', () => {
  it('never returns duplicates', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { questions } = selectQuestions(bank.questions, 300, createRng(seed));
      expect(new Set(questions.map((q) => q.id)).size).toBe(300);
    }
  });

  it('prefers distinct families while possible', () => {
    // 3 families, 4 questions each.
    const pool = ['a', 'b', 'c'].flatMap((f) => [1, 2, 3, 4].map((i) => makeQuestion(`L02-${f}${i}`, 2, f)));
    for (let seed = 1; seed <= 20; seed++) {
      const r = selectQuestions(pool, 3, createRng(seed));
      expect(new Set(r.questions.map((q) => q.family_id)).size).toBe(3);
      expect(r.familyRepeats).toBe(0);
    }
    // More than the number of families: allowed, and reported.
    const r = selectQuestions(pool, 5, createRng(1));
    expect(r.questions).toHaveLength(5);
    expect(r.familyRepeats).toBe(2);
  });

  it('on the real bank, a 40-question exam has no family repeats', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const r = selectQuestions(bank.questions, 40, createRng(seed));
      expect(r.familyRepeats).toBe(0);
      expect(new Set(r.questions.map((q) => q.family_id)).size).toBe(40);
    }
  });

  it('balances across lectures instead of letting big lectures dominate', () => {
    const r = selectQuestions(bank.questions, 44, createRng(5)); // 11 lectures × 4
    const per = new Map<number, number>();
    r.questions.forEach((q) => per.set(q.lecture, (per.get(q.lecture) ?? 0) + 1));
    expect([...per.values()].every((n) => n === 4)).toBe(true);
  });

  it('redistributes leftovers from small lectures', () => {
    const quotas = lectureQuotas(
      new Map([
        [10, 2],
        [11, 50],
        [12, 50],
      ]),
      30,
      createRng(1),
    );
    expect(quotas.get(10)).toBe(2);
    expect(quotas.get(11)! + quotas.get(12)!).toBe(28);
    expect(Math.abs(quotas.get(11)! - quotas.get(12)!)).toBeLessThanOrEqual(1);
  });

  it('rejects requests larger than the pool, and non-positive counts', () => {
    const pool = [makeQuestion('L02-x', 2)];
    expect(() => selectQuestions(pool, 2, createRng(1))).toThrow(/only 1 available/);
    expect(() => selectQuestions(pool, 0, createRng(1))).toThrow();
    expect(() => selectQuestions([], 1, createRng(1))).toThrow();
  });

  it('is deterministic for a fixed seed (order is decided once, then stored)', () => {
    const a = selectQuestions(bank.questions, 20, createRng(42)).questions.map((q) => q.id);
    const b = selectQuestions(bank.questions, 20, createRng(42)).questions.map((q) => q.id);
    expect(a).toEqual(b);
  });
});

describe('filterPool', () => {
  const all = { lectures: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], kinds: ['concept', 'code_trace', 'lab_application'], topic: null };

  it('selects lectures 11–12 only', () => {
    const p = filterPool(bank.questions, { ...all, lectures: [11, 12], source: 'all' }, emptyProgress());
    expect(p.length).toBe(77 + 72);
    expect(p.every((q) => q.lecture === 11 || q.lecture === 12)).toBe(true);
  });

  it('returns an empty pool for empty filters', () => {
    expect(filterPool(bank.questions, { ...all, lectures: [], source: 'all' }, emptyProgress())).toHaveLength(0);
    expect(filterPool(bank.questions, { ...all, kinds: [], source: 'all' }, emptyProgress())).toHaveLength(0);
    expect(filterPool(bank.questions, { ...all, source: 'wrong' }, emptyProgress())).toHaveLength(0);
    expect(filterPool(bank.questions, { ...all, lectures: [13], source: 'all' }, emptyProgress())).toHaveLength(0);
  });

  it('wrong and bookmarked sources use progress', () => {
    const progress = {
      ...emptyProgress(),
      bookmarks: ['L02-Q001'],
      stats: {
        'L02-Q002': { correct: 0, wrong: 1, last: 'wrong' as const, lastAt: 1 },
        'L02-Q003': { correct: 1, wrong: 1, last: 'correct' as const, lastAt: 2 },
      },
    };
    expect(filterPool(bank.questions, { ...all, source: 'wrong' }, progress).map((q) => q.id)).toEqual(['L02-Q002']);
    expect(filterPool(bank.questions, { ...all, source: 'bookmarked' }, progress).map((q) => q.id)).toEqual(['L02-Q001']);
  });
});
