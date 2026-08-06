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

/**
 * Layout, against the official plugin convention.
 *
 * This suite once shipped SKILL.md at the plugin root, where Claude Code never
 * looks, so the entire model-read half of the design was dead weight while
 * eighteen test files reported green. Structure is checkable; check it.
 */
test('the skill lives where plugin skills are discovered', () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, 'skills/human/SKILL.md')),
    'skills must be at skills/<name>/SKILL.md, not the plugin root'
  );
  assert.ok(
    !fs.existsSync(path.join(ROOT, 'SKILL.md')),
    'a root SKILL.md is never discovered and would shadow the real one in a reader\'s mind'
  );
});

test('component directories sit at plugin root, not inside .claude-plugin', () => {
  for (const dir of ['commands', 'skills', 'hooks']) {
    assert.ok(fs.existsSync(path.join(ROOT, dir)), `${dir}/ at plugin root`);
    assert.ok(
      !fs.existsSync(path.join(ROOT, '.claude-plugin', dir)),
      `${dir}/ must not be nested inside .claude-plugin/`
    );
  }
});

test('the manifest is the only thing inside .claude-plugin', () => {
  const entries = fs.readdirSync(path.join(ROOT, '.claude-plugin')).sort();
  assert.deepStrictEqual(entries, ['marketplace.json', 'plugin.json']);
});

test('every command file carries a description', () => {
  const files = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.md'));
  assert.ok(files.length > 0, 'at least one command');
  for (const file of files) {
    const raw = fs.readFileSync(path.join(ROOT, 'commands', file), 'utf8');
    assert.ok(raw.startsWith('---\n'), `${file} opens with frontmatter`);
    assert.ok(/^description:/m.test(raw), `${file} declares a description`);
  }
});

test('hooks.json references only scripts that exist', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  const commands = [];
  for (const entries of Object.values(hooks.hooks)) {
    for (const entry of entries) for (const h of entry.hooks) commands.push(h.command);
  }
  assert.ok(commands.length > 0);
  for (const command of commands) {
    const match = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/);
    assert.ok(match, `${command} uses \${CLAUDE_PLUGIN_ROOT} for portability`);
    assert.ok(fs.existsSync(path.join(ROOT, match[1])), `${match[1]} exists`);
  }
});

done();
