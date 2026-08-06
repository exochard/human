'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, done } = require('../helpers/harness');

const CLI = path.join(__dirname, '../../bin/human.js');

function run(args, stdin) {
  return spawnSync('node', [CLI, ...args], { input: stdin || '', encoding: 'utf8' });
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-cli-'));
const CLEAN = path.join(dir, 'clean.md');
const DIRTY = path.join(dir, 'dirty.md');

fs.writeFileSync(CLEAN, [
  'The parser reads the frontmatter delimiter only on line one.',
  'Before that it matched anywhere, so a rule halfway down swallowed every heading after it.',
  'Nobody noticed for three weeks.',
  'One fixture fixed that.',
  'The change is four characters long.',
].join(' '));

fs.writeFileSync(DIRTY, ('This comprehensive solution is designed to seamlessly streamline your workflow. '
  + 'It is robust, powerful, and scalable. '
  + 'By leveraging a cutting-edge architecture, it will empower your team. '
  + 'We utilize a holistic approach to unlock transformative outcomes. ').repeat(5));

test('a clean file exits 0', () => {
  const r = run([CLEAN]);
  assert.strictEqual(r.status, 0, r.stdout + r.stderr);
});

test('a file over a gating budget exits 1', () => {
  assert.strictEqual(run([DIRTY]).status, 1);
});

test('--json emits parseable output with a results array', () => {
  const r = run([DIRTY, '--json']);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.ok, false);
  assert.ok(Array.isArray(parsed.reports[0].results));
});

test('--fix exits 2 and says why it is not implemented', () => {
  const r = run([CLEAN, '--fix']);
  assert.strictEqual(r.status, 2);
  assert.ok(/not implemented/.test(r.stderr));
  assert.ok(/not safe/.test(r.stderr), 'states the reason, not just the absence');
});

test('a missing path exits 2 rather than passing silently', () => {
  const r = run([path.join(dir, 'nope.md')]);
  assert.strictEqual(r.status, 2);
});

test('a directory is walked for markdown', () => {
  const r = run([dir, '--json']);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.reports.length, 2);
});

test('reads stdin when given no paths', () => {
  const r = run([], 'Some perfectly ordinary prose that nobody would flag.');
  assert.strictEqual(r.status, 0);
});

test('empty stdin exits 2', () => {
  assert.strictEqual(run([], '   ').status, 2);
});

test('--register overrides routing', () => {
  const r = run([], 'This commit refactors the parser and updates the tests.');
  assert.strictEqual(r.status, 0, 'no register matched, so commit-opener did not run');
  const forced = run(['--register', 'commit'], 'This commit refactors the parser and updates the tests.');
  assert.strictEqual(forced.status, 1, 'commit-opener ran once the register was named');
});

test('--quiet drops the advisory section', () => {
  const loud = run([DIRTY]).stdout;
  const quiet = run([DIRTY, '--quiet']).stdout;
  assert.ok(loud.includes('advisory'));
  assert.ok(!quiet.includes('advisory'));
});

test('--help exits 0', () => {
  const r = run(['--help']);
  assert.strictEqual(r.status, 0);
  assert.ok(r.stdout.includes('usage: human'));
});

test('an unknown option exits 2', () => {
  assert.strictEqual(run(['--nonsense']).status, 2);
});

test('--lang it applies the italian vocabulary', () => {
  const it = [
    'Il sistema funziona bene e di conseguenza il carico sui nodi diminuisce molto.',
    'Inoltre la latenza cala e pertanto il costo scende sotto la soglia prevista dal contratto.',
    'È importante sottolineare che la soluzione è robusta e all\'avanguardia nel panorama attuale.',
    'Dunque conviene approfondire il tema e sfruttare le risorse disponibili in modo poliedrico.',
  ].join(' ').repeat(3);
  const r = run(['--lang', 'it'], it);
  assert.strictEqual(r.status, 1, r.stdout);
  assert.ok(r.stdout.includes('vocab'), 'the italian list was the rule that fired');
});

done();
