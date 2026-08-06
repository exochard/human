'use strict';

const assert = require('assert');
const rule = require('../../lib/rules/burstiness');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const FLAT = Array.from({ length: 10 }, (unused, i) =>
  `Sentence number ${i} carries exactly eight words here.`).join(' ');

const BURSTY = [
  'It broke.',
  'The parser had been reading the frontmatter delimiter as a horizontal rule for three weeks before anybody noticed that the headings were quietly vanishing from every report it produced.',
  'Nobody noticed because the tests only ever fed it bodies without frontmatter.',
  'That was the bug.',
  'Adding one fixture with frontmatter turned the whole suite red immediately.',
  'Good.',
  'The fix was four characters long and the test that catches it is twenty lines.',
  'That ratio is normal.',
  'What is not normal is having shipped it.',
].join(' ');

test('rule declares its contract', () => {
  assert.strictEqual(rule.id, 'burstiness');
  assert.strictEqual(rule.confidence, 'moderate');
  assert.strictEqual(rule.gates, true);
});

test('flags uniform sentence length as below floor', () => {
  const r = rule.check(makeDoc(FLAT), { floor: 0.35, minSentences: 5 });
  assert.strictEqual(r.over, true, `cv ${r.rate} should be below the floor`);
  assert.ok(r.message.includes('below the floor'));
});

test('passes varied sentence length', () => {
  const r = rule.check(makeDoc(BURSTY), { floor: 0.35, minSentences: 5 });
  assert.strictEqual(r.over, false, `cv ${r.rate} should clear the floor`);
});

test('never fires below minSentences', () => {
  const r = rule.check(makeDoc('One short line here. Another short line here.'), {
    floor: 0.35, minSentences: 5,
  });
  assert.strictEqual(r.over, false);
  assert.ok(r.message.includes('below the 5 needed'));
});

test('shows the sentences nearest the mean when it fires', () => {
  const r = rule.check(makeDoc(FLAT), { floor: 0.35, minSentences: 5 });
  assert.ok(r.hits.length > 0, 'a writer needs to see what is flattening the rhythm');
});

done();
