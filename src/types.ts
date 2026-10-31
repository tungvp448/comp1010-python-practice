export interface Option {
  id: string;
  text: string;
}

export interface Source {
  file: string;
  slides?: number[];
  pages?: number[];
}

export interface Question {
  id: string;
  lecture: number;
  topic: string;
  type: 'single_choice';
  kind: string;
  difficulty: string;
  prompt: string;
  code: string | null;
  options: Option[];
  correct_option_ids: string[];
  explanation: string;
  sources: Source[];
  family_id: string;
  status: string;
}

export interface BankMetadata {
  schema_version: string;
  title?: string;
  scope?: string;
  excluded_lectures?: number[];
  question_count?: number;
  bank_revision?: number;
  [key: string]: unknown;
}

export interface Bank {
  metadata: BankMetadata;
  questions: Question[];
}

export type Mode = 'practice' | 'exam';
export type PoolSource = 'all' | 'wrong' | 'bookmarked';

export interface AttemptConfig {
  mode: Mode;
  lectures: number[];
  kinds: string[];
  topic: string | null;
  source: PoolSource;
  count: number;
  shuffleOptions: boolean;
  /** Exam time limit in minutes, null = no limit. */
  timeLimitMin: number | null;
}

/**
 * One question inside an attempt. Holds everything needed to grade it, frozen at creation
 * time, so later bank updates never re-grade an attempt.
 */
export interface AttemptItem {
  id: string;
  lecture: number;
  /** Option ids in display order (labels A/B/C/D follow this order). */
  optionOrder: string[];
  correctOptionIds: string[];
  /** Content hash of the question at creation time, to detect later bank edits. */
  qHash: string;
}

export interface ItemResponse {
  chosen: string | null;
  /** Practice mode only: the answer has been checked and is locked. */
  checked?: boolean;
}

export interface ActiveAttempt {
  id: string;
  config: AttemptConfig;
  bankHash: string;
  createdAt: number;
  /** Absolute deadline (ms since epoch) for timed exams. */
  deadline: number | null;
  items: AttemptItem[];
  responses: Record<string, ItemResponse>;
  current: number;
  flagged: string[];
  familyRepeats: number;
}

export interface GradedItem extends AttemptItem {
  chosen: string | null;
  correct: boolean;
}

export interface SubmittedAttempt {
  id: string;
  config: AttemptConfig;
  bankHash: string;
  createdAt: number;
  submittedAt: number;
  autoSubmitted: boolean;
  items: GradedItem[];
  score: { correct: number; wrong: number; blank: number; total: number };
}

export interface QuestionStat {
  correct: number;
  wrong: number;
  /** Result of the most recent graded answer. */
  last: 'correct' | 'wrong';
  lastAt: number;
}

export interface Progress {
  bookmarks: string[];
  stats: Record<string, QuestionStat>;
  history: SubmittedAttempt[];
}
