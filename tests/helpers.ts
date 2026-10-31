import type { AttemptConfig, Question } from '../src/types';

export function makeQuestion(id: string, lecture: number, family = id, overrides: Partial<Question> = {}): Question {
  return {
    id,
    lecture,
    topic: 'T',
    type: 'single_choice',
    kind: 'concept',
    difficulty: 'easy',
    prompt: `Prompt ${id}`,
    code: null,
    options: [
      { id: 'o1', text: 'one' },
      { id: 'o2', text: 'two' },
      { id: 'o3', text: 'three' },
      { id: 'o4', text: '(no output)' },
    ],
    correct_option_ids: ['o3'],
    explanation: 'Because.',
    sources: [{ file: 'f.pptx', slides: [1] }],
    family_id: family,
    status: 'draft',
    ...overrides,
  };
}

export function config(overrides: Partial<AttemptConfig> = {}): AttemptConfig {
  return {
    mode: 'exam',
    lectures: [2],
    kinds: ['concept'],
    topic: null,
    source: 'all',
    count: 2,
    shuffleOptions: true,
    timeLimitMin: null,
    ...overrides,
  };
}

export function bankOf(questions: Question[]) {
  return { metadata: { schema_version: '1.0', question_count: questions.length }, questions };
}

/** Minimal in-memory Storage implementation; `broken` makes every call throw. */
export class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  constructor(private broken = false) {}
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    if (this.broken) throw new Error('denied');
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    if (this.broken) throw new Error('denied');
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    if (this.broken) throw new Error('denied');
    this.m.set(k, v);
  }
  keys() {
    return [...this.m.keys()];
  }
}
