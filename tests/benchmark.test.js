'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { checkFile } = require('../lib/check');
const { test, done } = require('./helpers/harness');

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(ROOT, 'benchmark/fixtures');

function filesIn(cls) {
  const dir = path.join(FIXTURES, cls);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
}

test('both fixture classes have at least six documents', () => {
  for (const cls of ['machine', 'human']) {
    assert.ok(filesIn(cls).length >= 6, `${cls} has ${filesIn(cls).length}`);
  }
});

test('every fixture parses without throwing', () => {
  for (const cls of ['machine', 'human']) {
    for (const file of filesIn(cls)) {
      assert.doesNotThrow(() => checkFile(file, { rootDir: ROOT, lang: 'en' }), file);
    }
  }
});

test('no human fixture is flagged', () => {
  const flagged = filesIn('human')
    .map((f) => ({ f, r: checkFile(f, { rootDir: ROOT, lang: 'en' }) }))
    .filter((x) => !x.r.ok)
    .map((x) => path.basename(x.f));
  assert.deepStrictEqual(flagged, [], 'a gate that fires on good prose gets switched off');
});

test('a majority of machine fixtures are flagged', () => {
  const files = filesIn('machine');
  const flagged = files.filter((f) => !checkFile(f, { rootDir: ROOT, lang: 'en' }).ok).length;
  assert.ok(flagged > files.length / 2, `only ${flagged}/${files.length} flagged`);
});

test('the benchmark runs and reports a median runtime', () => {
  const r = spawnSync('node', [path.join(ROOT, 'benchmark/run-benchmark.js')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/median runtime: \d+(\.\d+)? ms/.test(r.stdout), r.stdout);
  assert.ok(/true positives/.test(r.stdout));
  assert.ok(/false positives/.test(r.stdout));
});

test('the benchmark README records the corpus weakness', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'benchmark/README.md'), 'utf8');
  assert.ok(/weakness/i.test(readme), 'the fixtures were written by the rule author; say so');
  assert.ok(/upper bound/i.test(readme));
});

done();
