'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test, done } = require('./helpers/harness');

/**
 * The family's second design rule, made executable: no model call, ever, in
 * the hot path. A plugin that spent tokens to save tokens would be a bad
 * trade, and this test is what stops that from creeping in later.
 */

const ROOT = path.join(__dirname, '..');
const SCANNED = ['lib', 'hooks', 'bin'];

function jsFilesUnder(dir, out) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) jsFilesUnder(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = SCANNED.flatMap((d) => jsFilesUnder(path.join(ROOT, d), []));

test('there is something to scan', () => {
  assert.ok(files.length > 0, 'no source files found');
});

test('no source file reaches a model provider', () => {
  const banned = [/anthropic/i, /openai/i, /\bclaude\.ai\b/i, /api\.[a-z]+\.com/i];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.ok(!pattern.test(src), `${path.relative(ROOT, file)} mentions ${pattern}`);
    }
  }
});

test('no source file opens a network connection', () => {
  const banned = [/\bfetch\s*\(/, /require\(['"]https?['"]\)/, /\bXMLHttpRequest\b/, /\bWebSocket\b/];
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    for (const pattern of banned) {
      assert.ok(!pattern.test(src), `${path.relative(ROOT, file)} matches ${pattern}`);
    }
  }
});

test('lib/ spawns no subprocess at all', () => {
  for (const file of files.filter((f) => f.includes(`${path.sep}lib${path.sep}`))) {
    const src = fs.readFileSync(file, 'utf8');
    assert.ok(!/child_process/.test(src), `${path.relative(ROOT, file)} spawns a subprocess`);
  }
});

test('hooks and bin spawn nothing but git', () => {
  const outside = files.filter((f) => !f.includes(`${path.sep}lib${path.sep}`));
  for (const file of outside) {
    const src = fs.readFileSync(file, 'utf8');
    if (!/child_process/.test(src)) continue;
    const spawned = [...src.matchAll(/spawnSync\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    const executed = [...src.matchAll(/exec(?:Sync|File|FileSync)?\(\s*['"]([^'"]+)/g)].map((m) => m[1]);
    for (const cmd of [...spawned, ...executed]) {
      assert.ok(/^git\b/.test(cmd), `${path.relative(ROOT, file)} runs ${cmd}, expected git`);
    }
  }
});

done();
