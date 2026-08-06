'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { test, done } = require('../helpers/harness');

const ROOT = path.join(__dirname, '../..');
const SESSION_START = path.join(ROOT, 'hooks/scripts/session-start.js');
const POST_WRITE = path.join(ROOT, 'hooks/scripts/post-write-verify.js');
const MAX_CHARS = 1200;

function run(script, stdin, env) {
  return spawnSync('node', [script], {
    input: stdin === undefined ? '' : stdin,
    encoding: 'utf8',
    env: { ...process.env, ...(env || {}) },
  });
}

/** SessionStart injects through stdout JSON; that field is documented for it. */
function contextOf(result) {
  if (!result.stdout || result.stdout.trim() === '') return '';
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
}

/**
 * PostToolUse reports through additionalContext on stdout at exit 0, which the
 * CLI turns into a hook_additional_context attachment. Exit 2 with stderr was
 * tried and reverted: the CLI classifies it as hook_blocking_error, and the
 * model came away unsure whether the write had succeeded.
 */
function feedbackOf(result) {
  if (!result.stdout || result.stdout.trim() === '') return '';
  return JSON.parse(result.stdout).hookSpecificOutput.additionalContext;
}
function assertSilent(result, why) {
  assert.strictEqual(result.status, 0, why);
  assert.strictEqual(result.stdout.trim(), '', why);
  assert.strictEqual(result.stderr.trim(), '', why);
}

// ---- hooks.json ----

test('hooks.json registers both hooks with stable ids', () => {
  const hooks = JSON.parse(fs.readFileSync(path.join(ROOT, 'hooks/hooks.json'), 'utf8'));
  assert.strictEqual(hooks.hooks.SessionStart[0].id, 'human:session-start');
  assert.strictEqual(hooks.hooks.PostToolUse[0].id, 'human:post-write-verify');
  assert.strictEqual(hooks.hooks.PostToolUse[0].matcher, 'Write|Edit');
});

// ---- session-start ----

test('session-start emits valid hook JSON', () => {
  const r = run(SESSION_START);
  assert.strictEqual(r.status, 0);
  const parsed = JSON.parse(r.stdout);
  assert.strictEqual(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
});

test('session-start stays under the character cap', () => {
  const context = contextOf(run(SESSION_START));
  assert.ok(context.length <= MAX_CHARS, `injected ${context.length} chars, cap ${MAX_CHARS}`);
});

test('session-start names every gating rule', () => {
  const context = contextOf(run(SESSION_START));
  for (const id of ['tricolon', 'vocab', 'burstiness']) {
    assert.ok(context.includes(id), `${id} named`);
  }
});

test('session-start omits the advisory rules', () => {
  const context = contextOf(run(SESSION_START));
  for (const id of ['em-dash', 'antithesis']) {
    assert.ok(!context.includes(id), `${id} costs session-start tokens for nothing`);
  }
});

test('session-start repeats the honesty constraint', () => {
  assert.ok(/does not judge who wrote/i.test(contextOf(run(SESSION_START))));
});

// ---- post-write-verify ----

test('a non-markdown path produces no output', () => {
  assertSilent(run(POST_WRITE, JSON.stringify({ tool_input: { file_path: '/tmp/thing.js' } })), 'non-markdown');
});

test('malformed stdin exits 0 silently', () => {
  assertSilent(run(POST_WRITE, 'not json at all'), 'malformed stdin');
});

test('empty stdin exits 0 silently', () => {
  assertSilent(run(POST_WRITE, ''), 'empty stdin');
});

test('a missing file produces no output', () => {
  assertSilent(run(POST_WRITE, JSON.stringify({ tool_input: { file_path: '/tmp/does-not-exist-xyz.md' } })), 'missing file');
});

test('a clean markdown file produces no output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-hook-'));
  const file = path.join(dir, 'notes.md');
  fs.writeFileSync(file, [
    'The parser reads the frontmatter delimiter only on line one.',
    'Before that it matched anywhere, so a horizontal rule halfway down swallowed every heading after it.',
    'Nobody noticed for three weeks.',
    'One fixture fixed that.',
    'The change itself is four characters long.',
  ].join(' '));
  assertSilent(run(POST_WRITE, JSON.stringify({ tool_input: { file_path: file } })), 'clean file');
});

test('a violating README reports and loads its register document', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-hook-'));
  const file = path.join(dir, 'README.md');
  fs.writeFileSync(file, ('This comprehensive solution is designed to seamlessly streamline your workflow. '
    + 'It is robust, powerful, and scalable. '
    + 'By leveraging a cutting-edge architecture, it will empower your team. '
    + 'We utilize a holistic approach to unlock transformative outcomes. ').repeat(5));

  const result = run(POST_WRITE, JSON.stringify({ tool_input: { file_path: file } }));
  assert.strictEqual(result.status, 0, 'reporting is not blocking');
  const context = feedbackOf(result);
  assert.ok(context.includes('vocab'), 'names the rule that fired');
  assert.ok(context.includes('Register guidance for "readme"'), 'lazily loaded the register doc');
  assert.ok(/Cover the project name/.test(context), 'the register document body is present');
});

test('the hook reports without denying anything', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-hook-'));
  const file = path.join(dir, 'README.md');
  fs.writeFileSync(file, 'It is robust, powerful, and scalable. '.repeat(40));
  const r = run(POST_WRITE, JSON.stringify({ tool_input: { file_path: file } }));
  assert.strictEqual(r.status, 0, 'exit 2 would surface as a blocking error on a write that succeeded');
  assert.strictEqual(r.stderr.trim(), '');
  assert.ok(!/permissionDecision/.test(r.stdout), 'PostToolUse reports; it does not deny');
});

test('a persona path is never scanned', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-hook-'));
  const file = path.join(dir, '.claude', 'human.local.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'It is robust, powerful, and comprehensive. '.repeat(40));
  assertSilent(run(POST_WRITE, JSON.stringify({ tool_input: { file_path: file } })),
    'a file about how you write is not written in your style');
});

test('session-start names a persona when one exists', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'human-home-'));
  const file = path.join(home, '.claude', 'human', 'persona.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, '---\nlanguage: en\n---\n\nI build infrastructure.\n');

  const context = contextOf(spawnSync('node', [SESSION_START], {
    input: '', encoding: 'utf8', cwd: home, env: { ...process.env, HOME: home },
  }));
  assert.ok(/A persona is on disk/.test(context), context);
  assert.ok(/\/human:human-load/.test(context), 'names the command that loads it');
  assert.ok(!context.includes('I build infrastructure'), 'names the file without loading its content');
  assert.ok(context.length <= MAX_CHARS, `injected ${context.length} chars, cap ${MAX_CHARS}`);
});

test('session-start says nothing about a persona when none exists', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'human-home-'));
  const context = contextOf(spawnSync('node', [SESSION_START], {
    input: '', encoding: 'utf8', cwd: home, env: { ...process.env, HOME: home },
  }));
  assert.ok(!/persona/i.test(context), 'no pointer to a file that is not there');
});

test('the hook completes within 250 ms on a 5 kB document', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-hook-'));
  const file = path.join(dir, 'big.md');
  fs.writeFileSync(file, 'The quick brown fox jumped over the lazy dog and kept running. '.repeat(90));
  const started = process.hrtime.bigint();
  run(POST_WRITE, JSON.stringify({ tool_input: { file_path: file } }));
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  // Generous, because it includes node process startup. The scanner itself is
  // measured properly in the benchmark.
  assert.ok(ms < 250, `took ${Math.round(ms)} ms`);
});

done();
