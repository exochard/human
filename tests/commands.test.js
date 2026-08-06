'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, done } = require('./helpers/harness');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'bin/human.js');
const NAMES = ['human', 'human-review', 'human-persona', 'human-doctor'];

function read(name) {
  return fs.readFileSync(path.join(ROOT, 'commands', `${name}.md`), 'utf8');
}

test('every documented command exists with frontmatter and a description', () => {
  for (const name of NAMES) {
    const p = path.join(ROOT, 'commands', `${name}.md`);
    assert.ok(fs.existsSync(p), `commands/${name}.md exists`);
    const raw = read(name);
    assert.ok(raw.startsWith('---\n'), `${name} opens with frontmatter`);
    assert.ok(/^description: \S/m.test(raw), `${name} declares a description`);
  }
});

test('no command file is left over from the pre-split layout', () => {
  const files = fs.readdirSync(path.join(ROOT, 'commands')).filter((f) => f.endsWith('.md')).sort();
  assert.deepStrictEqual(files, NAMES.map((n) => `${n}.md`).sort());
});

test('every command references the plugin root portably', () => {
  for (const name of NAMES) {
    const raw = read(name);
    if (!raw.includes('bin/human.js') && !raw.includes('skills/human')) continue;
    assert.ok(raw.includes('${CLAUDE_PLUGIN_ROOT}'), `${name} uses \${CLAUDE_PLUGIN_ROOT}`);
  }
});

test('the persona command asks about language footing', () => {
  const raw = read('human-persona');
  assert.ok(/second language/i.test(raw), 'asks whether English is a second language');
  assert.ok(/bilingual/i.test(raw));
  assert.ok(/one question at a time/i.test(raw), 'the interview is paced');
});

test('the persona command says what a persona does not do', () => {
  assert.ok(/does not change what the scanner can verify/i.test(read('human-persona')));
});

test('the persona command fences the sample block', () => {
  assert.ok(read('human-persona').includes('human:off'), 'samples are quoted evidence, not measured prose');
});

test('the loader command does not read every register up front', () => {
  assert.ok(/Do \*\*not\*\* read every register document now/.test(read('human')));
});

test('--doctor reports budgets, persona state, and exits 0', () => {
  const r = spawnSync('node', [CLI, '--doctor'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.ok(/budgets in force/.test(r.stdout));
  assert.ok(/tricolon/.test(r.stdout));
  assert.ok(/persona/i.test(r.stdout));
  assert.ok(/registers/.test(r.stdout));
});

test('--doctor --path resolves a register', () => {
  const r = spawnSync('node', [CLI, '--doctor', '--path', 'docs/adr/0001.md'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.ok(/technical-doc/.test(r.stdout), r.stdout);
});

test('--doctor names every register that has a guidance document', () => {
  const r = spawnSync('node', [CLI, '--doctor'], { encoding: 'utf8' });
  assert.ok(!/GUIDANCE MISSING/.test(r.stdout), 'every configured register has its document');
});

test('--persona with no persona file warns and still checks', () => {
  const r = spawnSync('node', [CLI, '--persona'], {
    input: 'Ordinary prose that nobody would flag at all.', encoding: 'utf8',
    env: { ...process.env, HOME: path.join(ROOT, 'tests', 'no-such-home') },
  });
  assert.strictEqual(r.status, 0);
  assert.ok(/no persona file found/.test(r.stderr), r.stderr);
});

done();
