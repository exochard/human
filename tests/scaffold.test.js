'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, done } = require('./helpers/harness');

const ROOT = path.join(__dirname, '..');

test('plugin.json declares name human and MIT license', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
  assert.strictEqual(p.name, 'human');
  assert.strictEqual(p.license, 'MIT');
});

test('package.json has zero dependencies', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.deepStrictEqual(p.dependencies || {}, {});
  assert.deepStrictEqual(p.devDependencies || {}, {});
});

test('marketplace.json lists the human plugin at ./', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  const entry = m.plugins.find((x) => x.name === 'human');
  assert.ok(entry, 'human entry present');
  assert.strictEqual(entry.source, './');
});

test('plugin.json and marketplace.json agree on version', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  const entry = m.plugins.find((x) => x.name === 'human');
  assert.strictEqual(p.version, entry.version, 'a version skew here serves stale code from the plugin cache');
});

done();
