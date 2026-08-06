'use strict';

const assert = require('assert');
const { parseYaml } = require('../../lib/yaml');
const { test, done } = require('../helpers/harness');

test('parses scalars and coerces types', () => {
  const r = parseYaml('name: tricolon\nbudget: 4.0\ncount: 3\nenabled: true\nnote:\n');
  assert.strictEqual(r.name, 'tricolon');
  assert.strictEqual(r.budget, 4);
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.enabled, true);
  assert.strictEqual(r.note, null);
});

test('strips comments and blank lines', () => {
  const r = parseYaml('# leading\nname: x   # trailing\n\n');
  assert.strictEqual(r.name, 'x');
});

test('keeps a hash inside a quoted string', () => {
  const r = parseYaml('note: "a # b"\n');
  assert.strictEqual(r.note, 'a # b');
});

test('parses nested maps by indent', () => {
  const r = parseYaml('rules:\n  tricolon:\n    budget: 4.0\n    confidence: strong\n');
  assert.strictEqual(r.rules.tricolon.budget, 4);
  assert.strictEqual(r.rules.tricolon.confidence, 'strong');
});

test('parses scalar lists', () => {
  const r = parseYaml('words:\n  - delve\n  - realm\n  - "not: a map"\n');
  assert.deepStrictEqual(r.words, ['delve', 'realm', 'not: a map']);
});

test('parses lists of maps', () => {
  const r = parseYaml(
    'routes:\n  - match: "README.md"\n    register: readme\n  - match: "docs/**"\n    register: technical-doc\n'
  );
  assert.strictEqual(r.routes.length, 2);
  assert.strictEqual(r.routes[0].match, 'README.md');
  assert.strictEqual(r.routes[1].register, 'technical-doc');
});

test('parses an inline scalar sequence', () => {
  const r = parseYaml('adjectives: [blazing, seamless, "best-in-class"]\n');
  assert.deepStrictEqual(r.adjectives, ['blazing', 'seamless', 'best-in-class']);
  assert.deepStrictEqual(parseYaml('empty: []\n').empty, []);
});

test('preserves a URL despite its colon', () => {
  const r = parseYaml('source: "https://arxiv.org/abs/2406.07016"\n');
  assert.strictEqual(r.source, 'https://arxiv.org/abs/2406.07016');
});

test('throws with a line number on a block scalar', () => {
  assert.throws(() => parseYaml('a: 1\ntext: |\n  hello\n'), /yaml:2:/);
});

test('throws with a line number on a flow map', () => {
  assert.throws(() => parseYaml('a: { b: 1 }\n'), /yaml:1:/);
});

test('throws on tab indentation', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1\n'), /yaml:2:/);
});

test('throws on an anchor', () => {
  assert.throws(() => parseYaml('a: &anchor 1\n'), /yaml:1:/);
});

test('round-trips a realistic rules file', () => {
  const src = [
    'version: 1',
    'note: "Budgets are rates per 1000 words."',
    'rules:',
    '  tricolon:',
    '    budget: 4.0',
    '    gates: true',
    '    source: "https://example.org/a"',
    '  unbacked:',
    '    budget: 1.5',
    '    gates: false',
    '    adjectives: [blazing, seamless]',
    '',
  ].join('\n');
  const r = parseYaml(src);
  assert.strictEqual(r.version, 1);
  assert.strictEqual(r.rules.tricolon.gates, true);
  assert.strictEqual(r.rules.unbacked.gates, false);
  assert.deepStrictEqual(r.rules.unbacked.adjectives, ['blazing', 'seamless']);
});

done();
