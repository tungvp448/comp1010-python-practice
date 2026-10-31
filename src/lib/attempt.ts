import type {
  ActiveAttempt,
  AttemptConfig,
  GradedItem,
  Progress,
  Question,
  SubmittedAttempt,
} from '../types';
import { questionHash } from './bank';
import { createRng, randomSeed, shuffle, type Rng } from './rng';
import { selectQuestions } from './sampling';

export const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${randomSeed().toString(36)}`;
}

/**
 * Build a new attempt. This is the only place randomness is used: question order, option
 * order and the grading key are frozen into the attempt and persisted.
 */
export function createAttempt(
  config: AttemptConfig,
  pool: Question[],
  bankHash: string,
  now: number,
  rng: Rng = createRng(randomSeed()),
): ActiveAttempt {
  const { questions, familyRepeats } = selectQuestions(pool, config.count, rng);
  const items = questions.map((q) => ({
    id: q.id,
    lecture: q.lecture,
    optionOrder: config.shuffleOptions ? shuffle(q.options.map((o) => o.id), rng) : q.options.map((o) => o.id),
    correctOptionIds: q.correct_option_ids.slice(),
    qHash: questionHash(q),
  }));
  const timed = config.mode === 'exam' && config.timeLimitMin !== null && config.timeLimitMin > 0;
  return {
    id: newId(config.mode),
    config,
    bankHash,
    createdAt: now,
    deadline: timed ? now + config.timeLimitMin! * 60_000 : null,
    items,
    responses: Object.fromEntries(items.map((i) => [i.id, { chosen: null }])),
    current: 0,
    flagged: [],
    familyRepeats,
  };
}

/** Display label (A/B/C/D) of an option id inside this item's current display order. */
export function labelFor(optionOrder: string[], optionId: string): string {
  const i = optionOrder.indexOf(optionId);
  return i >= 0 ? OPTION_LABELS[i] : '?';
}

export function isCorrect(correctOptionIds: string[], chosen: string | null): boolean {
  return chosen !== null && correctOptionIds.length === 1 && correctOptionIds[0] === chosen;
}

export function gradeAttempt(attempt: ActiveAttempt, now: number, autoSubmitted: boolean): SubmittedAttempt {
  const items: GradedItem[] = attempt.items.map((item) => {
    const chosen = attempt.responses[item.id]?.chosen ?? null;
    return { ...item, chosen, correct: isCorrect(item.correctOptionIds, chosen) };
  });
  const correct = items.filter((i) => i.correct).length;
  const blank = items.filter((i) => i.chosen === null).length;
  return {
    id: attempt.id,
    config: attempt.config,
    bankHash: attempt.bankHash,
    createdAt: attempt.createdAt,
    submittedAt: now,
    autoSubmitted,
    items,
    score: { correct, wrong: items.length - correct - blank, blank, total: items.length },
  };
}

export function isExpired(attempt: ActiveAttempt, now: number): boolean {
  return attempt.deadline !== null && now >= attempt.deadline;
}

/** Record one graded answer in per-question stats (used for "ôn câu sai"). */
export function recordResult(progress: Progress, id: string, correct: boolean, now: number): Progress {
  const prev = progress.stats[id] ?? { correct: 0, wrong: 0, last: 'correct' as const, lastAt: 0 };
  return {
    ...progress,
    stats: {
      ...progress.stats,
      [id]: {
        correct: prev.correct + (correct ? 1 : 0),
        wrong: prev.wrong + (correct ? 0 : 1),
        last: correct ? 'correct' : 'wrong',
        lastAt: now,
      },
    },
  };
}

export const HISTORY_LIMIT = 100;

/**
 * Add a submitted attempt to progress. Idempotent: submitting the same attempt id twice
 * leaves progress unchanged. Blank exam answers score 0 but are not added to the "wrong"
 * review list; practice answers were already recorded in stats when checked.
 */
export function applySubmission(progress: Progress, submitted: SubmittedAttempt): Progress {
  if (progress.history.some((h) => h.id === submitted.id)) return progress;
  let next: Progress = { ...progress, history: [submitted, ...progress.history].slice(0, HISTORY_LIMIT) };
  if (submitted.config.mode === 'exam') {
    for (const item of submitted.items) {
      if (item.chosen !== null) next = recordResult(next, item.id, item.correct, submitted.submittedAt);
    }
  }
  return next;
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
