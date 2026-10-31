export const SUPPORTED_SCHEMA_VERSIONS: string[];
export const LECTURE_MIN: number;
export const LECTURE_MAX: number;
export const ALLOWED_STATUSES: string[];
export const ALLOWED_TYPES: string[];

export interface BankValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { total: number; perLecture: Record<string, number> } | null;
}

export interface MergeResult {
  ok: boolean;
  errors: string[];
  bank: { metadata: Record<string, unknown>; questions: unknown[] } | null;
  added: string[];
  replaced: string[];
}

export function validateQuestion(q: unknown, where?: string): string[];
export function validateBank(bank: unknown): BankValidationResult;
export function mergeBanks(base: unknown, incoming: unknown, opts?: { mode?: 'reject' | 'replace' }): MergeResult;
