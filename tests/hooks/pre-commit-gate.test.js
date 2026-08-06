'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, done } = require('../helpers/harness');

const ROOT = path.join(__dirname, '../..');
const GATE = path.join(ROOT, 'hooks/scripts/pre-commit-gate.js');

/**
 * A PreToolUse denial is `permissionDecision` on stdout at exit 0.
 *
 * Confirmed against the running CLI, not read off a doc: the denied call comes
 * back with toolDenialKind "permission-rule" and a tool_result equal to the
 * reason string. An earlier edit moved this to stderr with exit 2 on the
 * strength of a documentation line; that path blocks but hands the model a JSON
 * blob wrapped in a generic hook-error prefix, and it was reverted.
 */
function run(command, env) {
  const result = spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    env: { ...process.env, HUMAN_SKIP: '', ...(env || {}) },
  });

  assert.strictEqual(result.status, 0, 'the gate always exits 0; the decision travels in the payload');
  assert.strictEqual(result.stderr.trim(), '', 'nothing goes to stderr; exit 2 there reads as a hook error');

  if (result.stdout.trim() === '') return { denied: false, reason: '', status: 0 };

  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.hookSpecificOutput.permissionDecision, 'deny');
  const reason = payload.hookSpecificOutput.permissionDecisionReason;
  assert.ok(reason, 'the denial explains itself');
  return { denied: true, reason, status: 0 };
}

test('hooks.json registers the gate on Bash', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.strictEqual(hooks.hooks.PreToolUse[0].id, 'human:pre-commit-gate');
  assert.strictEqual(hooks.hooks.PreToolUse[0].matcher, 'Bash');
});

test('a non-commit command passes through untouched', () => {
  assert.strictEqual(run('npm test').denied, false);
  assert.strictEqual(run('git status --short').denied, false);
});

test('a good commit message passes', () => {
  const r = run('git commit -m "fix: read the frontmatter delimiter only on line 1"');
  assert.strictEqual(r.denied, false, r.reason);
});

test('a self-announcing message is denied and the reason names the rule', () => {
  const r = run('git commit -m "This commit refactors the parser and updates every test"');
  assert.strictEqual(r.denied, true);
  assert.ok(r.reason.includes('commit-opener'));
});

test('HUMAN_SKIP=1 lets the same message through', () => {
  const r = run('git commit -m "This commit refactors the parser and updates every test"', { HUMAN_SKIP: '1' });
  assert.strictEqual(r.denied, false);
});

test('--no-verify lets the same message through', () => {
  const r = run('git commit --no-verify -m "This commit refactors the parser and updates tests"');
  assert.strictEqual(r.denied, false);
});

test('the denial names both escape hatches', () => {
  const r = run('git commit -m "This commit refactors the parser and updates every test"');
  assert.ok(r.reason.includes('--no-verify'));
  assert.ok(r.reason.includes('HUMAN_SKIP'));
});

test('a short message is not gated by rate rules', () => {
  assert.strictEqual(run('git commit -m "fix: off-by-one"').denied, false);
});

test('a short message is still gated by commit-opener', () => {
  const r = run('git commit -m "This commit fixes it"');
  assert.strictEqual(r.denied, true, 'commit-opener applies at any length');
});

test('single quotes are handled', () => {
  assert.strictEqual(run("git commit -m 'This commit refactors the parser entirely'").denied, true);
});

test('a commit with no -m and no COMMIT_EDITMSG passes rather than guessing', () => {
  assert.strictEqual(run('git commit').denied, false);
});

test('the gate exits 0 whether it allows or denies', () => {
  assert.strictEqual(run('npm test').status, 0);
  assert.strictEqual(run('git commit -m "This commit refactors things"').status, 0);
});

test('the denial payload names the event and carries the decision on stdout', () => {
  const result = spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command: 'git commit -m "This commit refactors the parser"' } }),
    encoding: 'utf8',
    env: { ...process.env, HUMAN_SKIP: '' },
  });
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.strictEqual(payload.hookSpecificOutput.permissionDecision, 'deny');
  assert.strictEqual(result.stderr.trim(), '', 'stderr with exit 2 would surface as a hook error, not a reason');
});

done();
