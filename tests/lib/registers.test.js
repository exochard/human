'use strict';

const assert = require('assert');
const { runRegister } = require('../../lib/registers');
const { loadConfig, defaultRoot } = require('../../lib/config');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const cfg = loadConfig(defaultRoot());

function resultFor(doc, register, id) {
  return runRegister(doc, register, cfg.registers).find((r) => r.id === id);
}

test('an unknown register returns no results rather than throwing', () => {
  assert.deepStrictEqual(runRegister(makeDoc('x'), 'nonexistent', cfg.registers), []);
});

test('an unknown check id warns on stderr and the scan continues', () => {
  const warnings = [];
  const originalWrite = process.stderr.write;
  process.stderr.write = (chunk) => { warnings.push(String(chunk)); return true; };
  let results;
  try {
    results = runRegister(makeDoc('# Heading\n'), 'readme', {
      registers: { readme: { checks: { 'no-such-check': {}, 'emoji-heading': { budget: 0 } } } },
    });
  } finally {
    process.stderr.write = originalWrite;
  }
  assert.strictEqual(results.length, 1, 'the known check still ran');
  assert.strictEqual(results[0].id, 'emoji-heading');
  assert.ok(warnings.some((w) => w.includes('no-such-check')), 'the warning names the skipped check');
});

test('flags a README where most bullets open bolded', () => {
  const md = [
    '- **Automatic injection** context when you need it',
    '- **Zero configuration** works out of the box',
    '- **Token efficient** reduces overhead',
    '- plain bullet with no bold lead',
  ].join('\n');
  assert.strictEqual(resultFor(makeDoc(md), 'readme', 'bolded-bullets').over, true);
});

test('does not fire below the bullet minimum', () => {
  const md = '- **One** thing\n- **Two** things\n';
  assert.strictEqual(resultFor(makeDoc(md), 'readme', 'bolded-bullets').over, false);
});

test('passes a list that is mostly plain', () => {
  const md = ['- plain one', '- plain two', '- plain three', '- **bold** four'].join('\n');
  assert.strictEqual(resultFor(makeDoc(md), 'readme', 'bolded-bullets').over, false);
});

test('flags an emoji heading', () => {
  const r = resultFor(makeDoc('## \u{1F680} Features\n\nText here.\n'), 'readme', 'emoji-heading');
  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.over, true);
});

test('emoji-heading gates in technical-doc but only advises in readme', () => {
  const md = '## \u{1F680} Overview\n';
  assert.strictEqual(resultFor(makeDoc(md), 'readme', 'emoji-heading').gates, false);
  assert.strictEqual(resultFor(makeDoc(md), 'technical-doc', 'emoji-heading').gates, true);
});

test('flags a self-announcing commit opener', () => {
  const r = resultFor(makeDoc('This commit refactors the parser\n'), 'commit', 'commit-opener');
  assert.strictEqual(r.over, true);
  assert.strictEqual(r.gates, true);
});

test('passes an imperative commit subject', () => {
  const r = resultFor(makeDoc('fix: read the frontmatter delimiter only on line 1\n'), 'commit', 'commit-opener');
  assert.strictEqual(r.over, false);
});

test('flags a PR body that restates the diff file by file', () => {
  const md = [
    '## Changes',
    '- lib/text.js',
    '- lib/yaml.js',
    '- lib/check.js',
    '- tests/text.test.js',
  ].join('\n');
  assert.strictEqual(resultFor(makeDoc(md), 'pr', 'bullet-per-file').over, true);
});

test('passes a PR body whose bullets explain rather than list', () => {
  const md = [
    '## Changes',
    '- the frontmatter delimiter was matched anywhere, so a horizontal rule ate the document',
    '- the fix restricts the match to line one and adds a fixture that reproduces the old bug',
  ].join('\n');
  assert.strictEqual(resultFor(makeDoc(md), 'pr', 'bullet-per-file').over, false);
});

done();
