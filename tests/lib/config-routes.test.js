'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadConfig, defaultRoot } = require('../../lib/config');
const { routeFor } = require('../../lib/routes');
const { runInvariants } = require('../../lib/invariants');
const { makeDoc } = require('../helpers/doc');
const { test, done } = require('../helpers/harness');

const cfg = loadConfig(defaultRoot());

test('every rule module has an entry in invariants.yml', () => {
  for (const id of ['tricolon', 'vocab', 'burstiness', 'unbacked', 'em-dash', 'antithesis']) {
    assert.ok(cfg.invariants.rules[id], `${id} configured`);
  }
});

test('every configured rule carries a confidence and a source', () => {
  for (const [id, entry] of Object.entries(cfg.invariants.rules)) {
    assert.ok(entry.confidence, `${id} has a confidence`);
    assert.ok(entry.source, `${id} names a source`);
    assert.ok(typeof entry.gates === 'boolean', `${id} declares whether it gates`);
  }
});

test('no gating rule has weak confidence', () => {
  for (const [id, entry] of Object.entries(cfg.invariants.rules)) {
    if (entry.gates) assert.notStrictEqual(entry.confidence, 'weak', `${id} gates on weak evidence`);
  }
});

test('runInvariants returns six results in a stable order', () => {
  const r = runInvariants(makeDoc('Some prose here for the reader.'), cfg.invariants, cfg.vocab, 'en');
  assert.deepStrictEqual(r.map((x) => x.id), [
    'tricolon', 'vocab', 'burstiness', 'unbacked', 'em-dash', 'antithesis',
  ]);
});

test('config gates:false overrides a rule module that declares gates:true', () => {
  const forced = JSON.parse(JSON.stringify(cfg.invariants));
  forced.rules.tricolon.gates = false;
  const r = runInvariants(makeDoc('word '.repeat(300)), forced, cfg.vocab, 'en');
  assert.strictEqual(r.find((x) => x.id === 'tricolon').gates, false);
});

test('a missing rules directory throws and names the file', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'human-cfg-'));
  assert.throws(() => loadConfig(empty), /invariants\.yml/);
});

test('routes README.md to readme', () => {
  assert.strictEqual(routeFor('README.md', cfg.routes).register, 'readme');
  assert.strictEqual(routeFor('packages/core/README.md', cfg.routes).register, 'readme');
});

test('routes docs markdown to technical-doc', () => {
  assert.strictEqual(routeFor('docs/adr/0001-x.md', cfg.routes).register, 'technical-doc');
});

test('routes CHANGELOG and COMMIT_EDITMSG', () => {
  assert.strictEqual(routeFor('CHANGELOG.md', cfg.routes).register, 'changelog');
  assert.strictEqual(routeFor('.git/COMMIT_EDITMSG', cfg.routes).register, 'commit');
});

test('an unmatched path is not an error', () => {
  const r = routeFor('notes/random.md', cfg.routes);
  assert.strictEqual(r.matched, false);
  assert.strictEqual(r.register, null);
});

test('a glob star does not cross a path separator', () => {
  const routes = { routes: [{ match: 'docs/*.md', register: 'technical-doc' }] };
  assert.strictEqual(routeFor('docs/a.md', routes).matched, true);
  assert.strictEqual(routeFor('docs/nested/a.md', routes).matched, false);
});

test('every register named in routes.yml exists in registers.yml', () => {
  const known = new Set(Object.keys(cfg.registers.registers));
  for (const route of cfg.routes.routes) {
    assert.ok(known.has(route.register), `${route.register} configured in registers.yml`);
  }
});

done();
