import type { PoolSource, Progress, Question } from '../types';
import { shuffle, type Rng } from './rng';

export interface PoolFilter {
  lectures: number[];
  kinds: string[];
  topic: string | null;
  source: PoolSource;
}

/** Ids whose most recent graded answer was wrong. */
export function wrongIds(progress: Progress): Set<string> {
  return new Set(
    Object.entries(progress.stats)
      .filter(([, s]) => s.last === 'wrong')
      .map(([id]) => id),
  );
}

export function filterPool(questions: Question[], f: PoolFilter, progress: Progress): Question[] {
  const lectures = new Set(f.lectures);
  const kinds = new Set(f.kinds);
  const wrong = f.source === 'wrong' ? wrongIds(progress) : null;
  const marked = f.source === 'bookmarked' ? new Set(progress.bookmarks) : null;
  return questions.filter(
    (q) =>
      lectures.has(q.lecture) &&
      kinds.has(q.kind) &&
      (f.topic === null || q.topic === f.topic) &&
      (!wrong || wrong.has(q.id)) &&
      (!marked || marked.has(q.id)),
  );
}

/**
 * Split `count` across lectures as evenly as possible, never exceeding what a lecture has.
 * Leftover seats go to lectures that still have questions (water-filling), so a lecture with
 * many questions cannot crowd out the others.
 */
export function lectureQuotas(available: Map<number, number>, count: number, rng: Rng): Map<number, number> {
  const quotas = new Map<number, number>();
  for (const l of available.keys()) quotas.set(l, 0);
  let remaining = Math.min(count, [...available.values()].reduce((a, b) => a + b, 0));
  while (remaining > 0) {
    const open = [...available.keys()].filter((l) => quotas.get(l)! < available.get(l)!);
    const share = Math.floor(remaining / open.length);
    if (share > 0) {
      for (const l of open) {
        const add = Math.min(share, available.get(l)! - quotas.get(l)!);
        quotas.set(l, quotas.get(l)! + add);
        remaining -= add;
      }
    } else {
      // Fewer seats than open lectures: hand out one each to a random subset.
      for (const l of shuffle(open, rng).slice(0, remaining)) {
        quotas.set(l, quotas.get(l)! + 1);
        remaining -= 1;
      }
    }
  }
  return quotas;
}

export interface Selection {
  questions: Question[];
  /** How many picked questions share a family with an earlier pick. */
  familyRepeats: number;
}

/**
 * Sample without replacement, balanced by lecture, preferring distinct family_id values.
 * Throws if count exceeds the pool size; callers must clamp first.
 */
export function selectQuestions(pool: Question[], count: number, rng: Rng): Selection {
  if (!Number.isInteger(count) || count < 1) throw new Error('count must be a positive integer');
  if (count > pool.length) throw new Error(`requested ${count} questions but only ${pool.length} available`);

  const byLecture = new Map<number, Question[]>();
  for (const q of pool) {
    if (!byLecture.has(q.lecture)) byLecture.set(q.lecture, []);
    byLecture.get(q.lecture)!.push(q);
  }
  const quotas = lectureQuotas(new Map([...byLecture].map(([l, qs]) => [l, qs.length])), count, rng);

  const usedFamilies = new Set<string>();
  const picked: Question[] = [];
  let familyRepeats = 0;
  for (const [lecture, qs] of byLecture) {
    const need = quotas.get(lecture)!;
    const candidates = shuffle(qs, rng);
    const fresh: Question[] = [];
    const repeats: Question[] = [];
    const localFamilies = new Set<string>();
    for (const q of candidates) {
      if (usedFamilies.has(q.family_id) || localFamilies.has(q.family_id)) repeats.push(q);
      else {
        localFamilies.add(q.family_id);
        fresh.push(q);
      }
    }
    const chosen = fresh.slice(0, need);
    if (chosen.length < need) {
      const extra = repeats.slice(0, need - chosen.length);
      familyRepeats += extra.length;
      chosen.push(...extra);
    }
    chosen.forEach((q) => usedFamilies.add(q.family_id));
    picked.push(...chosen);
  }
  return { questions: shuffle(picked, rng), familyRepeats };
}
