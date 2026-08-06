'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPersona, applyPersona, isPersonaPath } = require('../../lib/persona');
const { loadConfig, defaultRoot } = require('../../lib/config');
const { test, done } = require('../helpers/harness');

const cfg = loadConfig(defaultRoot());
const CEILING = cfg.invariants.rules.tricolon.ceiling;

function scratch(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-persona-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const USER = [
  '---',
  'language: en',
  'overrides:',
  '  tricolon: 6.0',
  'allow:',
  '  - orchestration',
  '---',
  '',
  '## Who I am',
  '',
  'I build developer infrastructure.',
  '',
].join('\n');

test('returns null when no persona exists', () => {
  const dir = scratch({ 'README.md': 'x' });
  assert.strictEqual(loadPersona({ cwd: dir, homeDir: dir }), null);
});

test('loads a user persona and exposes body, overrides, and allow', () => {
  const dir = scratch({ '.claude/human/persona.md': USER });
  const p = loadPersona({ cwd: path.join(dir, 'nothing'), homeDir: dir });
  assert.strictEqual(p.overrides.tricolon, 6);
  assert.deepStrictEqual(p.allow, ['orchestration']);
  assert.ok(p.body.includes('developer infrastructure'));
  assert.strictEqual(p.sources.length, 1);
});

test('finds a project persona by walking up from cwd', () => {
  const dir = scratch({
    '.claude/human.local.md': ['---', 'overrides:', '  vocab: 3.0', '---', '', 'Project voice.', ''].join('\n'),
    'src/deep/nested/keep.txt': 'x',
  });
  const p = loadPersona({ cwd: path.join(dir, 'src/deep/nested'), homeDir: '/nonexistent' });
  assert.ok(p, 'found by walking up');
  assert.strictEqual(p.overrides.vocab, 3);
});

test('project frontmatter wins field by field, user fields survive', () => {
  const dir = scratch({
    '.claude/human/persona.md': USER,
    'proj/.claude/human.local.md': ['---', 'overrides:', '  vocab: 3.0', '---', '', 'Project voice.', ''].join('\n'),
  });
  const p = loadPersona({ cwd: path.join(dir, 'proj'), homeDir: dir });
  assert.strictEqual(p.overrides.vocab, 3, 'project override applied');
  assert.strictEqual(p.overrides.tricolon, 6, 'user override survives');
  assert.strictEqual(p.sources.length, 2);
  assert.ok(p.body.includes('developer infrastructure'), 'user body kept');
  assert.ok(p.body.includes('Project voice'), 'project body kept');
});

test('an override past its ceiling is clamped and recorded', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'overrides:', '  tricolon: 99', '---', '', 'x', ''].join('\n'),
  });
  const p = loadPersona({ cwd: dir, homeDir: dir });
  const { invariants, clamps } = applyPersona(cfg.invariants, p);
  assert.strictEqual(clamps.length, 1);
  assert.strictEqual(clamps[0].rule, 'tricolon');
  assert.strictEqual(clamps[0].requested, 99);
  assert.strictEqual(clamps[0].applied, CEILING);
  assert.strictEqual(invariants.rules.tricolon.budget, CEILING);
});

test('an override within its ceiling is applied whole', () => {
  const dir = scratch({ '.claude/human/persona.md': USER });
  const { invariants, clamps } = applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.strictEqual(invariants.rules.tricolon.budget, 6);
  assert.deepStrictEqual(clamps, []);
});

test('burstiness loosens downward and clamps at floorCeiling', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'overrides:', '  burstiness: 0.05', '---', '', 'x', ''].join('\n'),
  });
  const { invariants, clamps } = applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.strictEqual(invariants.rules.burstiness.floor, cfg.invariants.rules.burstiness.floorCeiling);
  assert.strictEqual(clamps.length, 1);
});

test('a persona may not tighten a budget, only loosen it', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'overrides:', '  tricolon: 1.0', '---', '', 'x', ''].join('\n'),
  });
  const { invariants } = applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.strictEqual(invariants.rules.tricolon.budget, 1, 'tightening is allowed and needs no ceiling');
});

test('an unknown rule in overrides is reported, not silently dropped', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'overrides:', '  nonsense: 5', '---', '', 'x', ''].join('\n'),
  });
  const { unknown } = applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.deepStrictEqual(unknown, ['nonsense']);
});

test('applyPersona never mutates the config it was given', () => {
  const dir = scratch({ '.claude/human/persona.md': USER });
  const before = cfg.invariants.rules.tricolon.budget;
  applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.strictEqual(cfg.invariants.rules.tricolon.budget, before);
});

test('allow removes words from the vocabulary without touching the source list', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'allow:', '  - robust', '---', '', 'x', ''].join('\n'),
  });
  const p = loadPersona({ cwd: dir, homeDir: dir });
  const { vocab } = applyPersona(cfg.invariants, p, cfg.vocab);
  assert.ok(!vocab.en.words.includes('robust'));
  assert.ok(cfg.vocab.en.words.includes('robust'), 'the source list is untouched');
});

test('allow is case-insensitive', () => {
  const dir = scratch({
    '.claude/human/persona.md': ['---', 'allow:', '  - ROBUST', '---', '', 'x', ''].join('\n'),
  });
  const { vocab } = applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }), cfg.vocab);
  assert.ok(!vocab.en.words.includes('robust'));
});

test('applyPersona with a null persona returns the config unchanged', () => {
  const { invariants, clamps } = applyPersona(cfg.invariants, null);
  assert.strictEqual(invariants, cfg.invariants);
  assert.deepStrictEqual(clamps, []);
});

test('a malformed persona throws and names the file', () => {
  const dir = scratch({ '.claude/human/persona.md': '---\noverrides:\n\ttricolon: 6\n---\n\nx\n' });
  assert.throws(() => loadPersona({ cwd: dir, homeDir: dir }), /persona\.md/);
});

test('a persona with no frontmatter still contributes its body', () => {
  const dir = scratch({ '.claude/human/persona.md': 'Just prose about who I am.\n' });
  const p = loadPersona({ cwd: dir, homeDir: dir });
  assert.ok(p.body.includes('Just prose'));
  assert.deepStrictEqual(p.overrides, {});
});

test('persona paths are recognised so they are never scanned', () => {
  assert.strictEqual(isPersonaPath('.claude/human.local.md'), true);
  assert.strictEqual(isPersonaPath('/home/x/.claude/human/persona.md'), true);
  assert.strictEqual(isPersonaPath('proj/.claude/human.local.md'), true);
  assert.strictEqual(isPersonaPath('docs/persona-notes.md'), false);
  assert.strictEqual(isPersonaPath('README.md'), false);
});

done();
