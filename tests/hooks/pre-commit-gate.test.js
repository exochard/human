'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
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
// The gate falls back to reading .git/COMMIT_EDITMSG from its cwd. Run every
// case from an empty scratch directory so the outcome cannot depend on what
// this repo happens to have committed last — that made this file pass or fail
// by luck depending on the previous commit message.
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'human-gate-'));

function run(command, env) {
  const result = spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command } }),
    encoding: 'utf8',
    cwd: SCRATCH,
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

test('multiple -m flags are judged as paragraphs of one message', () => {
  // git joins each -m with a blank line. A gate that reads only the first
  // paragraph would have allowed this: the opener is in the second one.
  const r = run('git commit -m "fix: read every -m flag in the command" -m "This commit also updates the gate tests"');
  assert.strictEqual(r.denied, true, 'the self-announcing second paragraph is judged too');
  assert.ok(r.reason.includes('commit-opener'));
});

test('-F reads the message from the file, not from the last editmsg', () => {
  fs.writeFileSync(path.join(SCRATCH, 'msg-f.txt'), 'This commit refactors the parser and updates every test\n');
  const r = run('git commit -F msg-f.txt');
  assert.strictEqual(r.denied, true);
});

test('--file reads the message from the file', () => {
  fs.writeFileSync(path.join(SCRATCH, 'msg-file.txt'), 'fix: read the -F message from disk before judging it\n');
  const r = run('git commit --file msg-file.txt');
  assert.strictEqual(r.denied, false, r.reason);
});

test('a missing -F file allows, says why on stderr, and does not fall back to the editmsg', () => {
  const result = spawnSync('node', [GATE], {
    input: JSON.stringify({ tool_input: { command: 'git commit -F does-not-exist.txt' } }),
    encoding: 'utf8',
    cwd: SCRATCH,
    env: { ...process.env, HUMAN_SKIP: '' },
  });
  assert.strictEqual(result.status, 0, 'the gate still exits 0');
  assert.strictEqual(result.stdout.trim(), '', 'no denial payload');
  assert.ok(/could not read commit message file/.test(result.stderr), 'the skip says why on stderr');
});

test('an unrecognized message shape passes rather than guessing', () => {
  // -c reuses an existing commit object as the message. This gate does not
  // parse that shape; it declines to fire instead of judging whatever the
  // last COMMIT_EDITMSG happens to hold.
  assert.strictEqual(run('git commit -c HEAD~1').denied, false);
});

test('burstiness does not gate a commit message', () => {
  // A commit body is a list of facts. Uniform sentence length there is correct
  // writing, not a tell. This fired on a real revert explanation and would have
  // blocked the commit that fixed it.
  const body = [
    'Revert the hook output change.',
    'The switch to stderr with exit two was wrong and has been reverted here.',
    'Verified against the running CLI by inspecting the session transcripts.',
    'PostToolUse with additionalContext on stdout reaches the model as intended.',
    'At exit two the same report is classified as a blocking error instead.',
    'PreToolUse with permissionDecision on stdout blocks cleanly every time.',
    'Exit two blocks too but the JSON is never parsed on that path at all.',
    'Both hooks now carry a comment saying not to repeat the change again.',
  ].join(' ');
  const r = run(`git commit -m "${body}"`);
  assert.strictEqual(r.denied, false, r.reason);
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
