// Shared validation + merge logic for question_bank.json.
// Used by the CLI (scripts/bank-cli.mjs), by the test suite, and at app start-up.
// Pure functions only: no file system access, no code execution.

export const SUPPORTED_SCHEMA_VERSIONS = ['1.0'];
export const LECTURE_MIN = 1;
export const LECTURE_MAX = 14;
export const ALLOWED_STATUSES = ['draft', 'reviewed', 'approved', 'retired'];
export const ALLOWED_TYPES = ['single_choice'];

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isPosIntArray = (v) => Array.isArray(v) && v.length > 0 && v.every((n) => Number.isInteger(n) && n > 0);

/**
 * Validate a single question object. Returns a list of error strings (empty = valid).
 */
export function validateQuestion(q, where = 'question') {
  const errors = [];
  const err = (msg) => errors.push(`${where}: ${msg}`);
  if (!isObj(q)) {
    err('is not an object');
    return errors;
  }
  if (!isNonEmptyStr(q.id)) err('id must be a non-empty string');
  else where = `${q.id}`;

  if (!Number.isInteger(q.lecture) || q.lecture < LECTURE_MIN || q.lecture > LECTURE_MAX) {
    err(`lecture must be an integer ${LECTURE_MIN}–${LECTURE_MAX} (got ${JSON.stringify(q.lecture)})`);
  }
  if (!isNonEmptyStr(q.topic)) err('topic must be a non-empty string');
  if (!ALLOWED_TYPES.includes(q.type)) err(`type must be one of ${ALLOWED_TYPES.join(', ')}`);
  if (!isNonEmptyStr(q.kind)) err('kind must be a non-empty string');
  if (!isNonEmptyStr(q.prompt)) err('prompt must be a non-empty string');
  if (!(q.code === null || q.code === undefined || typeof q.code === 'string')) err('code must be a string or null');
  if (!isNonEmptyStr(q.explanation)) err('explanation must be a non-empty string');
  if (!isNonEmptyStr(q.family_id)) err('family_id must be a non-empty string');
  if (!ALLOWED_STATUSES.includes(q.status)) err(`status must be one of ${ALLOWED_STATUSES.join(', ')}`);

  // Options: exactly 4, unique ids, unique text, text is a string (may be "(no output)", never empty).
  if (!Array.isArray(q.options) || q.options.length !== 4) {
    err('must have exactly 4 options');
  }
  const optionIds = new Set();
  if (Array.isArray(q.options)) {
    const texts = new Set();
    q.options.forEach((o, i) => {
      if (!isObj(o)) return err(`option[${i}] is not an object`);
      if (!isNonEmptyStr(o.id)) err(`option[${i}] id must be a non-empty string`);
      else if (optionIds.has(o.id)) err(`duplicate option id "${o.id}"`);
      else optionIds.add(o.id);
      if (typeof o.text !== 'string' || o.text.length === 0) err(`option[${i}] text must be a non-empty string`);
      else if (texts.has(o.text)) err(`duplicate option text ${JSON.stringify(o.text)}`);
      else texts.add(o.text);
    });
  }

  if (!Array.isArray(q.correct_option_ids) || q.correct_option_ids.length !== 1) {
    err('correct_option_ids must contain exactly 1 id');
  } else if (!optionIds.has(q.correct_option_ids[0])) {
    err(`correct option "${q.correct_option_ids[0]}" does not exist in options`);
  }

  if (!Array.isArray(q.sources) || q.sources.length === 0) {
    err('sources must be a non-empty array');
  } else {
    q.sources.forEach((s, i) => {
      if (!isObj(s)) return err(`sources[${i}] is not an object`);
      if (!isNonEmptyStr(s.file)) err(`sources[${i}].file must be a non-empty string`);
      const hasSlides = s.slides !== undefined;
      const hasPages = s.pages !== undefined;
      if (!hasSlides && !hasPages) err(`sources[${i}] needs slides or pages`);
      if (hasSlides && !isPosIntArray(s.slides)) err(`sources[${i}].slides must be a non-empty array of positive integers`);
      if (hasPages && !isPosIntArray(s.pages)) err(`sources[${i}].pages must be a non-empty array of positive integers`);
    });
  }
  return errors;
}

/**
 * Validate a full bank object { metadata, questions }.
 * Returns { ok, errors, warnings, stats }.
 */
export function validateBank(bank) {
  const errors = [];
  const warnings = [];
  if (!isObj(bank)) {
    return { ok: false, errors: ['root must be an object { metadata, questions }'], warnings, stats: null };
  }
  if (!isObj(bank.metadata)) errors.push('metadata must be an object');
  else if (!SUPPORTED_SCHEMA_VERSIONS.includes(bank.metadata.schema_version)) {
    errors.push(
      `unsupported schema_version ${JSON.stringify(bank.metadata.schema_version)}; supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}`,
    );
  }
  if (!Array.isArray(bank.questions)) {
    errors.push('questions must be an array');
    return { ok: false, errors, warnings, stats: null };
  }

  const seen = new Set();
  const perLecture = {};
  bank.questions.forEach((q, i) => {
    errors.push(...validateQuestion(q, `questions[${i}]`));
    if (isObj(q) && isNonEmptyStr(q.id)) {
      if (seen.has(q.id)) errors.push(`${q.id}: duplicate question id`);
      seen.add(q.id);
    }
    if (isObj(q) && Number.isInteger(q.lecture)) perLecture[q.lecture] = (perLecture[q.lecture] ?? 0) + 1;
  });

  if (isObj(bank.metadata) && Number.isInteger(bank.metadata.question_count)) {
    if (bank.metadata.question_count !== bank.questions.length) {
      warnings.push(
        `metadata.question_count (${bank.metadata.question_count}) differs from actual count (${bank.questions.length})`,
      );
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { total: bank.questions.length, perLecture },
  };
}

/**
 * Merge `incoming` questions into `base` bank by question.id.
 * - mode 'reject' (default): any id already in base is an error; nothing is merged.
 * - mode 'replace': ids already in base are replaced in place (explicit maintainer action).
 * Duplicate ids inside `incoming` are always an error.
 * Returns { ok, errors, bank, added, replaced }. Does not mutate inputs.
 */
export function mergeBanks(base, incoming, { mode = 'reject' } = {}) {
  const errors = [];
  const baseCheck = validateBank(base);
  if (!baseCheck.ok) errors.push(...baseCheck.errors.map((e) => `base: ${e}`));
  const incomingQuestions = Array.isArray(incoming) ? incoming : incoming?.questions;
  if (!Array.isArray(incomingQuestions)) {
    errors.push('incoming must be a bank object or an array of questions');
    return { ok: false, errors, bank: null, added: [], replaced: [] };
  }
  if (!Array.isArray(incoming) && isObj(incoming.metadata)) {
    if (!SUPPORTED_SCHEMA_VERSIONS.includes(incoming.metadata.schema_version)) {
      errors.push(`incoming: unsupported schema_version ${JSON.stringify(incoming.metadata.schema_version)}`);
    }
  }

  const incomingIds = new Set();
  incomingQuestions.forEach((q, i) => {
    errors.push(...validateQuestion(q, `incoming[${i}]`).map((e) => `incoming: ${e}`));
    if (isObj(q) && isNonEmptyStr(q.id)) {
      if (incomingIds.has(q.id)) errors.push(`incoming: ${q.id}: duplicate id inside incoming file`);
      incomingIds.add(q.id);
    }
  });

  const baseIndex = new Map((base?.questions ?? []).map((q, i) => [q.id, i]));
  const collisions = [...incomingIds].filter((id) => baseIndex.has(id));
  if (mode !== 'replace' && collisions.length > 0) {
    errors.push(
      `${collisions.length} id(s) already exist in base (${collisions.slice(0, 10).join(', ')}${collisions.length > 10 ? ', …' : ''}). ` +
        'Use --replace only if you intend to update those exact questions.',
    );
  }
  if (errors.length > 0) return { ok: false, errors, bank: null, added: [], replaced: [] };

  const questions = base.questions.slice();
  const added = [];
  const replaced = [];
  for (const q of incomingQuestions) {
    if (baseIndex.has(q.id)) {
      questions[baseIndex.get(q.id)] = q;
      replaced.push(q.id);
    } else {
      questions.push(q);
      added.push(q.id);
    }
  }

  const presentLectures = new Set(questions.map((q) => q.lecture));
  const metadata = {
    ...base.metadata,
    question_count: questions.length,
    bank_revision: (Number.isInteger(base.metadata.bank_revision) ? base.metadata.bank_revision : 1) + 1,
  };
  if (Array.isArray(base.metadata.excluded_lectures)) {
    metadata.excluded_lectures = base.metadata.excluded_lectures.filter((l) => !presentLectures.has(l));
  }
  const bank = { metadata, questions };
  const finalCheck = validateBank(bank);
  if (!finalCheck.ok) return { ok: false, errors: finalCheck.errors, bank: null, added: [], replaced: [] };
  return { ok: true, errors: [], bank, added, replaced };
}
