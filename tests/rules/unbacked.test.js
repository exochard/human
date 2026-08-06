'use strict';

const assert = require('assert');
const rule = require('../../lib/rules/unbacked');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const ADJ = ['blazing', 'seamless', 'powerful', 'incredible'];

test('rule is weak and never gates', () => {
  assert.strictEqual(rule.id, 'unbacked');
  assert.strictEqual(rule.confidence, 'weak');
  assert.strictEqual(rule.gates, false);
  assert.ok(rule.describe.includes('never gates'));
});

test('flags a superlative with no number in the sentence', () => {
  const r = rule.check(makeDoc('The parser is blazing fast in every case we tried.'), {
    budget: 1.5, adjectives: ADJ,
  });
  assert.strictEqual(r.count, 1);
});

test('passes the same claim once a number backs it', () => {
  const r = rule.check(makeDoc('The parser runs in 3 ms, which is blazing fast.'), {
    budget: 1.5, adjectives: ADJ,
  });
  assert.strictEqual(r.count, 0);
});

test('counts one hit per sentence, not per adjective', () => {
  const r = rule.check(makeDoc('It is blazing and seamless and powerful all at once.'), {
    budget: 1.5, adjectives: ADJ,
  });
  assert.strictEqual(r.count, 1);
});

test('an empty adjective list never fires', () => {
  assert.strictEqual(rule.check(makeDoc('Blazing fast and seamless here.'), {
    budget: 1.5, adjectives: [],
  }).count, 0);
});

done();
