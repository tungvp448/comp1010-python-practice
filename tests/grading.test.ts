import { describe, expect, it } from 'vitest';
import { applySubmission, createAttempt, gradeAttempt, isExpired, labelFor } from '../src/lib/attempt';
import { createRng } from '../src/lib/rng';
import { emptyProgress } from '../src/lib/storage';
import type { ActiveAttempt } from '../src/types';
import { config, makeQuestion } from './helpers';

const pool = [makeQuestion('L02-A', 2), makeQuestion('L02-B', 2), makeQuestion('L02-C', 2)];

function answer(a: ActiveAttempt, id: string, chosen: string | null): ActiveAttempt {
  return { ...a, responses: { ...a.responses, [id]: { chosen } } };
}

describe('grading', () => {
  it('grades by option id even after options are shuffled', () => {
    // Try many seeds so that the correct option lands on different display positions.
    const positions = new Set<number>();
    for (let seed = 1; seed <= 40; seed++) {
      let a = createAttempt(config({ count: 3 }), pool, 'h', 0, createRng(seed));
      for (const item of a.items) {
        positions.add(item.optionOrder.indexOf('o3'));
        a = answer(a, item.id, 'o3');
      }
      const g = gradeAttempt(a, 1000, false);
      expect(g.score).toEqual({ correct: 3, wrong: 0, blank: 0, total: 3 });
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('labels follow display order', () => {
    expect(labelFor(['o4', 'o2', 'o3', 'o1'], 'o3')).toBe('C');
    expect(labelFor(['o3', 'o2', 'o4', 'o1'], 'o3')).toBe('A');
  });

  it('counts correct, wrong and blank; denominator is all questions', () => {
    let a = createAttempt(config({ count: 3 }), pool, 'h', 0, createRng(7));
    const [x, y] = a.items;
    a = answer(a, x.id, 'o3');
    a = answer(a, y.id, 'o1');
    const g = gradeAttempt(a, 5000, false);
    expect(g.score).toEqual({ correct: 1, wrong: 1, blank: 1, total: 3 });
    expect(g.items.find((i) => i.id === x.id)?.correct).toBe(true);
    expect(g.items.find((i) => i.id === y.id)?.correct).toBe(false);
  });

  it('"(no output)" is a normal answer, not blank', () => {
    const q = makeQuestion('L02-N', 2, 'n', { correct_option_ids: ['o4'] });
    let a = createAttempt(config({ count: 1 }), [q], 'h', 0, createRng(1));
    a = answer(a, q.id, 'o4');
    expect(gradeAttempt(a, 1, false).score.correct).toBe(1);
  });

  it('uses the answer key frozen into the attempt, not later bank edits', () => {
    const a = answer(createAttempt(config({ count: 1 }), [pool[0]], 'h', 0, createRng(1)), 'L02-A', 'o3');
    pool[0].correct_option_ids = ['o1']; // bank changed after attempt was created
    try {
      expect(gradeAttempt(a, 1, false).score.correct).toBe(1);
    } finally {
      pool[0].correct_option_ids = ['o3'];
    }
  });

  it('submitting the same attempt twice changes nothing the second time', () => {
    let a = createAttempt(config({ count: 2 }), pool, 'h', 0, createRng(3));
    a = answer(a, a.items[0].id, 'o1');
    const g = gradeAttempt(a, 10, false);
    const once = applySubmission(emptyProgress(), g);
    const twice = applySubmission(once, gradeAttempt(a, 20, true));
    expect(twice).toBe(once);
    expect(twice.history).toHaveLength(1);
    expect(twice.stats[a.items[0].id]).toMatchObject({ wrong: 1, correct: 0, last: 'wrong' });
    // Blank exam answers score 0 but are not put into the wrong-review list.
    expect(twice.stats[a.items[1].id]).toBeUndefined();
  });

  it('deadline is absolute and expiry is detected after it passes', () => {
    const a = createAttempt(config({ timeLimitMin: 30 }), pool, 'h', 1_000, createRng(1));
    expect(a.deadline).toBe(1_000 + 30 * 60_000);
    expect(isExpired(a, a.deadline! - 1)).toBe(false);
    expect(isExpired(a, a.deadline!)).toBe(true);
    // Practice / untimed attempts never expire.
    expect(createAttempt(config({ mode: 'practice', timeLimitMin: 30 }), pool, 'h', 0).deadline).toBeNull();
  });
});
