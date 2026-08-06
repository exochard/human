'use strict';

const assert = require('assert');
const { checkText } = require('../../lib/check');
const { formatReport, formatBrief } = require('../../lib/format');
const { test, done } = require('../helpers/harness');

const CLEAN = [
  'The parser reads the frontmatter delimiter only on line one.',
  'Before that it matched anywhere, so a horizontal rule halfway down a document',
  'swallowed every heading after it and nobody noticed for three weeks.',
  'The tests only fed it bodies without frontmatter.',
  'One fixture fixed that.',
  'The change itself is four characters.',
  'Reading the delimiter anywhere was never right, and the test that catches it',
  'now runs on every commit.',
  'That is the whole story.',
].join(' ');

const SLOPPY = ('This comprehensive solution is designed to seamlessly streamline your workflow. '
  + 'It is robust, powerful, and scalable. '
  + 'By leveraging a cutting-edge architecture, it will empower your team. '
  + 'We utilize a holistic approach to unlock transformative outcomes. '
  + 'It is fast, cheap, and reliable. '
  + 'The system is nimble, elegant, and proven. ').repeat(5);

test('a clean document passes', () => {
  const r = checkText(CLEAN, { path: 'notes.md' });
  assert.strictEqual(r.ok, true, formatReport(r));
});

test('a slop-heavy document fails on gating rules', () => {
  const r = checkText(SLOPPY, { path: 'notes.md' });
  assert.strictEqual(r.ok, false);
  assert.ok(r.results.some((x) => x.id === 'vocab' && x.over));
});

test('a document breaching only a demoted rule still passes', () => {
  const body = [
    'One thing — another thing — a third — a fourth — a fifth here.',
    'Ordinary prose carries the word count past the hundred and fifty word floor.',
    'A short one.',
    'Then a considerably longer sentence that runs on for a while, so the coefficient of variation stays comfortably above its floor and burstiness stays quiet.',
    'Short again.',
    'The dashes accumulate without any other rule having an opinion about it.',
    'This fixture exists to prove one thing only: a weak signal over its budget never gates.',
    'It says nothing about whether the prose is any good.',
    'Another middling sentence sits here to pad the count toward the floor.',
    'Done.',
  ].join(' ').repeat(2);
  const r = checkText(body, { path: 'notes.md' });
  const emDash = r.results.find((x) => x.id === 'em-dash');
  assert.ok(emDash.over, 'em-dash is over its advisory budget');
  assert.strictEqual(r.ok, true, 'a weak signal never gates');
});

test('routes README.md to the readme register', () => {
  assert.strictEqual(checkText('# Title\n\nSome text here.\n', { path: 'README.md' }).register, 'readme');
});

test('an explicit register overrides the routing table', () => {
  const r = checkText('This commit refactors the parser\n', { path: 'README.md', register: 'commit' });
  assert.strictEqual(r.register, 'commit');
  assert.strictEqual(r.overridden, true);
  assert.strictEqual(r.ok, false, 'the commit-opener check ran');
});

test('an unmatched path reports matched false and still runs invariants', () => {
  const r = checkText(CLEAN, { path: 'notes/random.md' });
  assert.strictEqual(r.matched, false);
  assert.ok(r.results.length >= 6);
});

test('formatReport separates gating failures from advisory ones', () => {
  const out = formatReport(checkText(SLOPPY, { path: 'notes.md' }));
  assert.ok(out.includes('over budget:'));
  assert.ok(/advisory/.test(out));
});

test('formatReport never claims to detect authorship', () => {
  const out = formatReport(checkText(SLOPPY, { path: 'README.md' }));
  for (const banned of ['AI-generated', 'AI generated', 'detected', 'written by']) {
    assert.ok(!out.toLowerCase().includes(banned.toLowerCase()), `report must not say "${banned}"`);
  }
});

test('formatBrief is a single line', () => {
  assert.strictEqual(formatBrief(checkText(SLOPPY, { path: 'notes.md' })).split('\n').length, 1);
});

test('italian vocabulary applies when lang is it', () => {
  const it = 'Il sistema funziona bene e di conseguenza il carico diminuisce molto. '
    + 'Inoltre la latenza cala e pertanto il costo scende sotto la soglia prevista. '.repeat(4);
  const r = checkText(it, { path: 'notes.md', lang: 'it' });
  assert.ok(r.results.find((x) => x.id === 'vocab').count > 0, 'italian list was used');
});

done();
