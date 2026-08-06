'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { checkText, checkFile } = require('../../lib/check');
const { formatReport } = require('../../lib/format');
const { loadPersona } = require('../../lib/persona');
const { test, done } = require('../helpers/harness');

function scratch(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-checkp-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

function persona(frontmatter) {
  const dir = scratch({ '.claude/human/persona.md': `---\n${frontmatter}\n---\n\nI build infrastructure.\n` });
  return loadPersona({ cwd: dir, homeDir: dir });
}

/**
 * Five three-item series in roughly 800 words, which puts the tricolon rate
 * near 6 per 1000: over the published budget of 4.0 and under an adjusted
 * budget of 8.0. Sentence lengths are varied deliberately so burstiness stays
 * above its floor and only the rule under test can fire.
 */
const TRIADS = [
  'The parser is fast, small, and predictable in the cases that matter here.',
  'It handles quoted fields, embedded commas, and newlines without complaint.',
  'The writer flushes on end, on error, and on an explicit close call.',
  'Configuration covers paths, encodings, and delimiters and nothing else.',
  'Errors are logged, counted, and surfaced to the caller before anything exits.',
];

const FILLER = [
  'The importer reads a file and writes rows.',
  'It has done that since the first version and the interface has not moved since.',
  'Short.',
  'Most of the complexity lives in the part that decides when a chunk has ended, which turns out to be the only genuinely hard question in the whole program.',
  'Everything else is bookkeeping.',
  'A row that fails validation goes to a side channel where somebody can look at it later, assuming anybody ever does.',
  'Nobody does.',
  'The side channel has held the same four rows since March and none of them is interesting.',
  'That is fine.',
  'What matters is that the failure path exists and is exercised by a test, because the alternative is discovering it during an incident.',
];

function build(words) {
  const parts = [...TRIADS];
  let i = 0;
  while (parts.join(' ').split(/\s+/).length < words) {
    parts.push(FILLER[i % FILLER.length]);
    i += 1;
  }
  return parts.join(' ');
}

const TRIADIC = build(800);

test('a persona adjustment can bring a document back within budget', () => {
  const strict = checkText(TRIADIC, { path: 'notes.md' });
  assert.strictEqual(strict.ok, false, 'over the default budget');

  const loose = checkText(TRIADIC, { path: 'notes.md', persona: persona('overrides:\n  tricolon: 8.0') });
  assert.strictEqual(loose.ok, true, formatReport(loose));
});

test('an adjusted result carries adjustedFrom', () => {
  const r = checkText(TRIADIC, { path: 'notes.md', persona: persona('overrides:\n  tricolon: 8.0') });
  const tricolon = r.results.find((x) => x.id === 'tricolon');
  assert.strictEqual(tricolon.adjustedFrom, 4);
  assert.strictEqual(tricolon.budget, 8);
});

test('the report names the adjustment when an adjusted rule fires', () => {
  const heavy = `${TRIADIC} ${TRIADIC}`;
  const r = checkText(heavy, { path: 'notes.md', persona: persona('overrides:\n  tricolon: 4.5') });
  const out = formatReport(r);
  assert.ok(!r.ok, out);
  assert.ok(/budget adjusted 4 -> 4.5 by persona/.test(out), out);
});

test('a clamp is reported even on a document that passes', () => {
  const r = checkText('Ordinary prose that trips nothing at all here.', {
    path: 'notes.md', persona: persona('overrides:\n  tricolon: 99'),
  });
  const out = formatReport(r);
  assert.strictEqual(r.ok, true);
  assert.ok(/clamped: persona asked for tricolon 99/.test(out), out);
  assert.ok(/ceiling is 8/.test(out), out);
});

test('an unknown override is reported rather than silently ignored', () => {
  const r = checkText('Ordinary prose here for the reader.', {
    path: 'notes.md', persona: persona('overrides:\n  nonsens: 5'),
  });
  assert.ok(/ignored: persona overrides "nonsens"/.test(formatReport(r)));
});

test('allow removes a word from the vocabulary for this check only', () => {
  const body = `The orchestration layer is orchestration all the way down. ${'word '.repeat(200)}`;
  const withAllow = checkText(body, { path: 'notes.md', persona: persona('allow:\n  - orchestration') });
  assert.strictEqual(withAllow.results.find((x) => x.id === 'vocab').count, 0);
});

test('the persona language is used when no lang is passed', () => {
  const r = checkText('Il sistema funziona bene.', { path: 'notes.md', persona: persona('language: it') });
  assert.strictEqual(r.lang, 'it');
});

test('an explicit lang still beats the persona', () => {
  const r = checkText('Some text here.', { path: 'notes.md', lang: 'en', persona: persona('language: it') });
  assert.strictEqual(r.lang, 'en');
});

test('a report with no persona is shaped exactly as before', () => {
  const r = checkText('Ordinary prose here for the reader.', { path: 'notes.md' });
  assert.deepStrictEqual(r.adjustments, {});
  assert.deepStrictEqual(r.clamps, []);
  assert.deepStrictEqual(r.personaSources, []);
  assert.ok(!formatReport(r).includes('persona'));
});

test('checkFile returns null for a persona path rather than scanning it', () => {
  const dir = scratch({ '.claude/human.local.md': '---\nlanguage: en\n---\n\nIt is fast, cheap, and robust.\n' });
  assert.strictEqual(checkFile(path.join(dir, '.claude/human.local.md'), { rootDir: dir }), null);
});

done();
