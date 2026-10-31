import type { Bank, Question } from '../types';
import { hashString } from './rng';
import { validateBank } from '../../scripts/bank-validator.mjs';

export interface LoadedBank {
  bank: Bank;
  byId: Map<string, Question>;
  qHash: Map<string, string>;
  bankHash: string;
  lectures: number[];
  kinds: string[];
  errors: string[];
}

/** Fingerprint of the parts of a question that affect what is shown and how it is graded. */
export function questionHash(q: Question): string {
  return hashString(
    JSON.stringify([q.prompt, q.code, q.options, q.correct_option_ids, q.explanation]),
  );
}

export function loadBank(raw: unknown): LoadedBank {
  const result = validateBank(raw);
  const bank = (result.ok ? raw : { metadata: { schema_version: '?' }, questions: [] }) as Bank;
  const byId = new Map<string, Question>();
  const qHash = new Map<string, string>();
  for (const q of bank.questions) {
    byId.set(q.id, q);
    qHash.set(q.id, questionHash(q));
  }
  const bankHash = hashString(bank.questions.map((q) => `${q.id}:${qHash.get(q.id)}`).join('|'));
  return {
    bank,
    byId,
    qHash,
    bankHash,
    lectures: [...new Set(bank.questions.map((q) => q.lecture))].sort((a, b) => a - b),
    kinds: [...new Set(bank.questions.map((q) => q.kind))].sort(),
    errors: result.errors,
  };
}

export function lectureLabel(n: number): string {
  return `Lecture ${String(n).padStart(2, '0')}`;
}

export const KIND_LABELS: Record<string, string> = {
  concept: 'Khái niệm',
  code_trace: 'Đọc code / dự đoán output',
  lab_application: 'Vận dụng bài lab',
};

export function kindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

export function formatSource(s: { file: string; slides?: number[]; pages?: number[] }): string {
  if (s.slides) return `${s.file} — slide ${s.slides.join(', ')}`;
  if (s.pages) return `${s.file} — trang ${s.pages.join(', ')}`;
  return s.file;
}
