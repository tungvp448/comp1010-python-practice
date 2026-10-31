import { describe, expect, it } from 'vitest';
import rawBank from '../data/question_bank.json';
import { mergeBanks, validateBank } from '../scripts/bank-validator.mjs';
import { bankOf, makeQuestion } from './helpers';

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

describe('validateBank', () => {
  it('accepts the shipped question bank', () => {
    const r = validateBank(rawBank);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats?.total).toBe(645);
  });

  it('rejects a root array and unsupported schema versions', () => {
    expect(validateBank([]).ok).toBe(false);
    const b = bankOf([makeQuestion('L13-Q1', 13)]);
    b.metadata.schema_version = '2.0';
    expect(validateBank(b).errors.join()).toMatch(/schema_version/);
  });

  it('rejects duplicate question ids', () => {
    const r = validateBank(bankOf([makeQuestion('L13-Q1', 13), makeQuestion('L13-Q1', 13)]));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/duplicate question id/);
  });

  it('rejects a correct answer that is not one of the options', () => {
    const r = validateBank(bankOf([makeQuestion('L13-Q1', 13, 'f', { correct_option_ids: ['o9'] })]));
    expect(r.errors.join()).toMatch(/does not exist/);
  });

  it('rejects broken questions', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['3 options', { options: makeQuestion('x', 2).options.slice(0, 3) }],
      ['duplicate option id', { options: [...makeQuestion('x', 2).options.slice(0, 3), { id: 'o1', text: 'z' }] }],
      ['duplicate option text', { options: [...makeQuestion('x', 2).options.slice(0, 3), { id: 'o4', text: 'one' }] }],
      ['empty option text', { options: [...makeQuestion('x', 2).options.slice(0, 3), { id: 'o4', text: '' }] }],
      ['two correct', { correct_option_ids: ['o1', 'o2'] }],
      ['no correct', { correct_option_ids: [] }],
      ['bad lecture', { lecture: 15 }],
      ['string lecture', { lecture: '13' }],
      ['empty explanation', { explanation: '  ' }],
      ['no sources', { sources: [] }],
      ['bad slides', { sources: [{ file: 'a.pptx', slides: ['x'] }] }],
      ['source without slides/pages', { sources: [{ file: 'a.pptx' }] }],
      ['bad status', { status: 'published' }],
      ['missing prompt', { prompt: '' }],
    ];
    for (const [name, override] of cases) {
      const q = { ...makeQuestion('L13-Q1', 13), ...override };
      const r = validateBank(bankOf([q as never]));
      expect(r.ok, name).toBe(false);
    }
  });

  it('accepts lab sources given as pages', () => {
    const q = makeQuestion('L13-Q1', 13, 'f', { sources: [{ file: 'lab.pdf', pages: [3] }] });
    expect(validateBank(bankOf([q])).ok).toBe(true);
  });
});

describe('mergeBanks', () => {
  const base = () => clone({ ...bankOf([makeQuestion('L02-Q1', 2)]), metadata: { schema_version: '1.0', question_count: 1, excluded_lectures: [1, 13, 14] } });

  it('adds new lectures and updates metadata', () => {
    const r = mergeBanks(base(), bankOf([makeQuestion('L13-Q1', 13), makeQuestion('L14-Q1', 14)]));
    expect(r.ok).toBe(true);
    expect(r.added).toEqual(['L13-Q1', 'L14-Q1']);
    expect(r.bank!.questions).toHaveLength(3);
    expect(r.bank!.metadata.question_count).toBe(3);
    expect(r.bank!.metadata.excluded_lectures).toEqual([1]);
    expect(r.bank!.metadata.bank_revision).toBe(2);
  });

  it('refuses existing ids by default and leaves the base untouched', () => {
    const b = base();
    const before = clone(b);
    const r = mergeBanks(b, bankOf([makeQuestion('L02-Q1', 2, 'f', { prompt: 'changed' })]));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/already exist/);
    expect(b).toEqual(before);
  });

  it('replaces in place only in explicit replace mode', () => {
    const r = mergeBanks(base(), [makeQuestion('L02-Q1', 2, 'f', { prompt: 'changed' })], { mode: 'replace' });
    expect(r.ok).toBe(true);
    expect(r.replaced).toEqual(['L02-Q1']);
    expect(r.bank!.questions).toHaveLength(1);
    expect((r.bank!.questions[0] as { prompt: string }).prompt).toBe('changed');
  });

  it('refuses duplicates inside the incoming file and invalid incoming questions', () => {
    expect(mergeBanks(base(), [makeQuestion('L13-Q1', 13), makeQuestion('L13-Q1', 13)]).ok).toBe(false);
    expect(mergeBanks(base(), [makeQuestion('L13-Q1', 13, 'f', { correct_option_ids: ['o7'] })]).ok).toBe(false);
  });

  it('merging the whole bank into itself is refused (prevents doubling via lecture_XX files)', () => {
    const r = mergeBanks(clone(rawBank), clone(rawBank));
    expect(r.ok).toBe(false);
  });
});
