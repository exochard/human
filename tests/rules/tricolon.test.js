'use strict';

const assert = require('assert');
const rule = require('../../lib/rules/tricolon');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

test('rule declares its contract', () => {
  assert.strictEqual(rule.id, 'tricolon');
  assert.strictEqual(rule.confidence, 'strong');
  assert.strictEqual(rule.gates, true);
  assert.ok(rule.describe.length > 40);
});

test('detects a three-item series with terminal conjunction', () => {
  const r = rule.check(makeDoc('It is fast, cheap, and reliable in every case tested here today.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
  assert.ok(r.hits[0].text.includes('cheap'));
});

test('detects a multi-word triad', () => {
  const r = rule.check(makeDoc('We ship the parser, the linter, and the formatter in one package.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
});

test('detects an or-series', () => {
  const r = rule.check(makeDoc('Pick strong, moderate, or weak for every rule that ships here.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
});

test('does not fire on a two-item pair', () => {
  const r = rule.check(makeDoc('It is fast and cheap, which is all this project ever needed.'), { budget: 4 });
  assert.strictEqual(r.count, 0);
});

test('does not fire on a long subordinate clause with two commas', () => {
  const doc = makeDoc('When the parser reads the frontmatter delimiter, which it does first, and only then continues.');
  assert.strictEqual(rule.check(doc, { budget: 4 }).count, 0);
});

test('does not fire on a four-item list', () => {
  const doc = makeDoc('Four of them gate: tricolon rate, dated vocabulary, sentence-length variation, and unbacked superlatives.');
  assert.strictEqual(rule.check(doc, { budget: 4 }).count, 0, 'a longer list is not a tricolon');
});

test('does not fire on a five-item list', () => {
  const doc = makeDoc('We ship alpha, beta, gamma, delta, and epsilon in the same release today.');
  assert.strictEqual(rule.check(doc, { budget: 4 }).count, 0);
});

test('reports rate per 1000 words and flags over budget', () => {
  const body = 'It is fast, cheap, and reliable. ' + 'word '.repeat(200);
  const r = rule.check(makeDoc(body), { budget: 4 });
  assert.ok(r.rate > 4, `rate ${r.rate} should exceed budget`);
  assert.strictEqual(r.over, true);
});

test('never gates a document under 150 words', () => {
  const r = rule.check(makeDoc('It is fast, cheap, and reliable here.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.over, false, 'too short for a rate to mean anything');
});

test('under budget on a long clean document', () => {
  const r = rule.check(makeDoc('word '.repeat(2000)), { budget: 4 });
  assert.strictEqual(r.over, false);
  assert.strictEqual(r.count, 0);
  assert.strictEqual(r.rate, 0);
});

done();
