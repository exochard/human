'use strict';

const assert = require('assert');
const { stripFrontmatter, extractProse, splitSentences, wordCount, lineOf } = require('../../lib/text');
const { test, done } = require('../helpers/harness');

test('strips frontmatter', () => {
  const r = stripFrontmatter('---\ntitle: x\n---\nBody here.\n');
  assert.strictEqual(r.frontmatter.trim(), 'title: x');
  assert.strictEqual(r.body.trim(), 'Body here.');
});

test('leaves a document without frontmatter alone', () => {
  const r = stripFrontmatter('Body here.\n');
  assert.strictEqual(r.frontmatter, null);
  assert.strictEqual(r.body.trim(), 'Body here.');
});

test('does not mistake a horizontal rule for frontmatter', () => {
  const r = stripFrontmatter('Intro line.\n\n---\n\nMore text.\n');
  assert.strictEqual(r.frontmatter, null);
  assert.ok(r.body.includes('More text.'));
});

test('extractProse removes fenced code', () => {
  const p = extractProse('Real prose here.\n\n```js\nconst x = 1;\n```\n\nMore prose.\n');
  assert.ok(!p.includes('const x'));
  assert.ok(p.includes('Real prose here.'));
  assert.ok(p.includes('More prose.'));
});

test('extractProse ignores a heading inside a code fence', () => {
  const p = extractProse('Prose.\n\n```sh\n# not a heading\n```\n');
  assert.ok(!p.includes('not a heading'));
});

test('extractProse removes inline code but keeps link text', () => {
  const p = extractProse('Use `npm test` and see [the docs](https://example.com/x).');
  assert.ok(!p.includes('npm test'));
  assert.ok(!p.includes('example.com'));
  assert.ok(p.includes('the docs'));
});

test('extractProse keeps heading text', () => {
  assert.ok(extractProse('## Getting started\n').includes('Getting started'));
});

test('extractProse drops table rows', () => {
  const p = extractProse('Prose line.\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
  assert.ok(!p.includes('---'));
  assert.ok(p.includes('Prose line.'));
});

test('extractProse strips list markers and emphasis', () => {
  const p = extractProse('- **Bold lead** and more words here\n');
  assert.ok(!p.includes('**'));
  assert.ok(p.includes('Bold lead'));
});

test('splitSentences handles abbreviations and decimals', () => {
  const s = splitSentences('The rate is 7.13 per doc. That beats e.g. the human baseline here. Done with it now.');
  assert.strictEqual(s.length, 3);
});

test('splitSentences drops fragments under three words', () => {
  assert.strictEqual(splitSentences('Ok. This one is long enough to count.').length, 1);
});

test('splitSentences splits on question and exclamation marks', () => {
  assert.strictEqual(splitSentences('Is this a sentence? Yes it truly is. Good enough for now!').length, 3);
});

test('wordCount counts words not characters', () => {
  assert.strictEqual(wordCount('one two three'), 3);
  assert.strictEqual(wordCount('   '), 0);
});

test('lineOf finds the 1-indexed line', () => {
  assert.strictEqual(lineOf('alpha\nbeta\ngamma', 'beta'), 2);
  assert.strictEqual(lineOf('alpha', 'zzz'), 0);
});

done();
