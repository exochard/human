'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { checkFile } = require('../lib/check');
const { formatReport } = require('../lib/format');
const { test, done } = require('./helpers/harness');

/**
 * Every document this plugin ships passes its own gating rules.
 *
 * If the rules are not livable, this is where that shows up, and the fix is
 * the prose rather than the budget. A style tool whose own README fails its
 * own check has answered the only question a reader really has.
 */

const ROOT = path.join(__dirname, '..');

function shipped() {
  const targets = ['README.md', 'CHANGELOG.md', 'SKILL.md', 'commands/human.md', 'benchmark/README.md'];
  for (const f of fs.readdirSync(path.join(ROOT, 'registers'))) targets.push(`registers/${f}`);
  for (const dir of ['docs/specs', 'docs/plans']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) targets.push(`${dir}/${f}`);
  }
  return targets;
}

test('every shipped document is within budget on its gating rules', () => {
  const failures = [];
  for (const target of shipped()) {
    const report = checkFile(path.join(ROOT, target), { rootDir: ROOT, path: target, lang: 'en' });
    if (!report.ok) failures.push(formatReport(report, { quiet: true }));
  }
  assert.strictEqual(failures.length, 0, `\n${failures.join('\n\n')}`);
});

test('the README states that the tool is not a detector', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(/not an AI detector/i.test(readme));
});

test('the README publishes a source for every gating rule', () => {
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  for (const id of ['tricolon', 'vocab', 'burstiness', 'unbacked']) {
    assert.ok(readme.includes(id), `${id} documented`);
  }
  assert.ok((readme.match(/arxiv\.org/g) || []).length >= 4, 'sources are linked, not asserted');
});

test('the CHANGELOG records the known limits', () => {
  const changelog = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
  assert.ok(/Known limits/i.test(changelog));
  assert.ok(/`--fix` is not implemented/.test(changelog));
});

done();
