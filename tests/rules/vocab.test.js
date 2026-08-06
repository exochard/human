'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const rule = require('../../lib/rules/vocab');
const { parseYaml } = require('../../lib/yaml');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const ROOT = path.join(__dirname, '../..');
const EN = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/vocab/en.yml'), 'utf8'));
const IT = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/vocab/it.yml'), 'utf8'));

test('rule declares its contract', () => {
  assert.strictEqual(rule.id, 'vocab');
  assert.strictEqual(rule.confidence, 'strong');
  assert.strictEqual(rule.gates, true);
});

test('en list contains the documented spike words', () => {
  for (const w of ['delve', 'seamless', 'robust', 'leverage', 'comprehensive', 'underscore']) {
    assert.ok(EN.words.includes(w), `${w} present in en.yml`);
  }
});

test('en list carries a source URL and a caveat', () => {
  assert.ok(/^https?:\/\//.test(EN.source), 'source is a URL');
  assert.ok(EN.note.length > 80, 'note explains what the list does and does not prove');
});

test('matches whole words only', () => {
  const r = rule.check(makeDoc('The robustness of the harness was never in question.'), {
    budget: 2, words: ['robust', 'harness'],
  });
  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.hits[0].text.toLowerCase(), 'harness');
});

test('is case-insensitive', () => {
  const r = rule.check(makeDoc('Delve into this before you commit to anything.'), {
    budget: 2, words: ['delve'],
  });
  assert.strictEqual(r.count, 1);
});

test('ignores words inside code fences', () => {
  const doc = makeDoc('Clean prose here for the reader.\n\n```js\nconst robust = 1;\n```\n');
  assert.strictEqual(rule.check(doc, { budget: 2, words: ['robust'] }).count, 0);
});

test('matches a multi-word italian entry', () => {
  const r = rule.check(makeDoc('Il sistema funziona e di conseguenza il carico diminuisce.'), {
    budget: 2, words: IT.words,
  });
  assert.ok(r.count >= 1);
  assert.ok(r.hits.some((h) => h.text.toLowerCase() === 'di conseguenza'));
});

test('it list is non-empty and states its lower confidence', () => {
  assert.ok(IT.words.length > 5);
  assert.ok(IT.words.includes('inoltre'));
  assert.strictEqual(IT.confidence, 'moderate');
  assert.ok(IT.note.length > 80, 'note admits there is no corpus study for italian');
});

test('an empty word list never fires', () => {
  assert.strictEqual(rule.check(makeDoc('Anything at all goes here.'), { budget: 2, words: [] }).count, 0);
});

done();
