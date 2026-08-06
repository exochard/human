'use strict';

const assert = require('assert');
const rules = require('../../lib/rules/demoted');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const [emDash, antithesis] = rules;

test('exports exactly two rules', () => {
  assert.strictEqual(rules.length, 2);
  assert.deepStrictEqual(rules.map((r) => r.id), ['em-dash', 'antithesis']);
});

test('every demoted rule is weak and non-gating', () => {
  for (const r of rules) {
    assert.strictEqual(r.confidence, 'weak', `${r.id} confidence`);
    assert.strictEqual(r.gates, false, `${r.id} must never gate`);
  }
});

test('every demoted rule explains why it is demoted', () => {
  for (const r of rules) {
    assert.ok(r.describe.length > 80, `${r.id} describe is too short to justify demotion`);
    assert.ok(/advisory|never gates/i.test(r.describe), `${r.id} states its advisory status`);
  }
});

test('em-dash counts occurrences', () => {
  const r = emDash.check(makeDoc('One thing — and another — and a third here.'), { budget: 1.2 });
  assert.strictEqual(r.count, 2);
});

test('antithesis catches the trailing negation', () => {
  const r = antithesis.check(makeDoc('Real software you own, not a rented widget.'), { budget: 0.4 });
  assert.ok(r.count >= 1);
});

test('a demoted rule over budget still reports over false for gating purposes', () => {
  const body = 'One — two — three — four — five — six here. ' + 'word '.repeat(200);
  const r = emDash.check(makeDoc(body), { budget: 0.1 });
  assert.strictEqual(r.gates, false, 'gates stays false regardless of the count');
});

done();
