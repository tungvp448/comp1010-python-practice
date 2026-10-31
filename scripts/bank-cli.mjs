#!/usr/bin/env node
// Maintainer CLI for the question bank. Never executes question code.
//
//   node scripts/bank-cli.mjs validate <bank.json>
//   node scripts/bank-cli.mjs merge <incoming.json> [--base data/question_bank.json] [--replace] [--dry-run]
//
// merge writes the result back to --base (default data/question_bank.json) unless --dry-run.
// Default merge mode rejects any id that already exists; --replace updates those questions in place.
import { readFileSync, writeFileSync } from 'node:fs';
import { validateBank, mergeBanks } from './bank-validator.mjs';

function readJson(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    fail(`Cannot read ${path}: ${e.message}`);
  }
  try {
    return JSON.parse(raw.replace(/^﻿/, ''));
  } catch (e) {
    fail(`${path} is not valid JSON: ${e.message}`);
  }
}

function fail(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function printList(label, items, limit = 50) {
  if (items.length === 0) return;
  console.log(`${label} (${items.length}):`);
  items.slice(0, limit).forEach((e) => console.log(`  - ${e}`));
  if (items.length > limit) console.log(`  … and ${items.length - limit} more`);
}

const [cmd, ...rest] = process.argv.slice(2);
const flags = new Set(rest.filter((a) => a.startsWith('--') && !a.includes('=')));
const positional = [];
let basePath = 'data/question_bank.json';
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === '--base') basePath = rest[++i];
  else if (!rest[i].startsWith('--')) positional.push(rest[i]);
}

if (cmd === 'validate') {
  const path = positional[0] ?? basePath;
  const result = validateBank(readJson(path));
  printList('Errors', result.errors);
  printList('Warnings', result.warnings);
  if (!result.ok) fail(`${path} failed validation.`);
  console.log(`OK: ${path} — ${result.stats.total} questions`, result.stats.perLecture);
} else if (cmd === 'merge') {
  const incomingPath = positional[0];
  if (!incomingPath) fail('Usage: merge <incoming.json> [--base path] [--replace] [--dry-run]');
  const mode = flags.has('--replace') ? 'replace' : 'reject';
  const result = mergeBanks(readJson(basePath), readJson(incomingPath), { mode });
  printList('Errors', result.errors);
  if (!result.ok) fail('Merge refused. Bank file was not modified.');
  console.log(`Added ${result.added.length}, replaced ${result.replaced.length} (mode: ${mode}).`);
  printList('Replaced ids', result.replaced);
  if (flags.has('--dry-run')) {
    console.log('Dry run: nothing written.');
  } else {
    writeFileSync(basePath, JSON.stringify(result.bank, null, 2) + '\n', 'utf8');
    console.log(`Wrote ${basePath} (${result.bank.questions.length} questions, bank_revision ${result.bank.metadata.bank_revision}).`);
    console.log('Remember: review metadata.scope/title text, then commit and redeploy.');
  }
} else {
  console.log('Usage:\n  bank-cli.mjs validate [bank.json]\n  bank-cli.mjs merge <incoming.json> [--base path] [--replace] [--dry-run]');
  process.exit(cmd ? 1 : 0);
}
