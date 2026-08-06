'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseYaml } = require('../lib/yaml');
const { test, done } = require('./helpers/harness');

const ROOT = path.join(__dirname, '..');

const routes = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/routes.yml'), 'utf8'));
const registers = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/registers.yml'), 'utf8'));

test('every routed register has a guidance document', () => {
  const named = new Set([
    ...routes.routes.map((r) => r.register),
    ...Object.keys(registers.registers),
  ]);
  for (const name of named) {
    assert.ok(
      fs.existsSync(path.join(ROOT, 'registers', `${name}.md`)),
      `registers/${name}.md exists — config and guidance must not drift apart`
    );
  }
});

test('every guidance document is named in the config', () => {
  const named = new Set([
    ...routes.routes.map((r) => r.register),
    ...Object.keys(registers.registers),
  ]);
  for (const file of fs.readdirSync(path.join(ROOT, 'registers'))) {
    const name = path.basename(file, '.md');
    assert.ok(named.has(name), `registers/${file} is orphaned; nothing routes to it`);
  }
});

test('every register document declares frontmatter', () => {
  for (const file of fs.readdirSync(path.join(ROOT, 'registers'))) {
    const raw = fs.readFileSync(path.join(ROOT, 'registers', file), 'utf8');
    assert.ok(raw.startsWith('---\n'), `${file} opens with frontmatter`);
    const fm = parseYaml(raw.slice(4, raw.indexOf('\n---', 4)));
    assert.strictEqual(fm.name, path.basename(file, '.md'), `${file} frontmatter name matches filename`);
    assert.ok(fm.applies_to, `${file} declares applies_to`);
    assert.ok(fm.budgets_note, `${file} declares budgets_note`);
  }
});

test('SKILL.md declares frontmatter and the five-question rubric', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  assert.ok(raw.startsWith('---\n'), 'SKILL.md opens with frontmatter');
  const fm = parseYaml(raw.slice(4, raw.indexOf('\n---', 4)));
  assert.strictEqual(fm.name, 'human');
  assert.ok(fm.description.length > 60, 'description states when to invoke');
  for (const n of ['1.', '2.', '3.', '4.', '5.']) {
    assert.ok(raw.includes(n), `rubric item ${n} present`);
  }
});

test('SKILL.md states the honesty constraint', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  assert.ok(/does not judge who wrote/i.test(raw), 'SKILL.md disclaims authorship detection');
});

done();
