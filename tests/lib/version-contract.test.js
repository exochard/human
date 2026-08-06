#!/usr/bin/env node
'use strict';

/**
 * The two manifests must agree on the version.
 *
 * Claude Code keys its plugin cache on that string. A skew between the two
 * files, or a version left behind while code moved, means `plugin marketplace
 * update` reports success and serves the old code — silently, with the repo
 * fully pushed and every commit on the remote. This repo lost three commits
 * that way after the ROADMAP had already written the warning down.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures += 1; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

const plugin = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
const marketplace = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('plugin.json and marketplace.json agree on the version', () => {
  const entry = marketplace.plugins.find((p) => p.name === plugin.name);
  assert.ok(entry, `marketplace.json lists ${plugin.name}`);
  assert.strictEqual(plugin.version, entry.version,
    'a skew here serves stale code from the version-keyed plugin cache');
});

test('package.json carries the same version', () => {
  assert.strictEqual(pkg.version, plugin.version);
});

test('the version is semver', () => {
  assert.ok(/^\d+\.\d+\.\d+$/.test(plugin.version), `${plugin.version} is not semver`);
});

test('the CHANGELOG documents the current version', () => {
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  assert.ok(changelog.includes(plugin.version),
    `CHANGELOG.md has no entry for ${plugin.version}; a bump nobody can read is not a release`);
});

process.exit(failures === 0 ? 0 : 1);
