#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { checkText } = require('../../lib/check');

/**
 * The one place human blocks rather than reports.
 *
 * A commit message is the shortest and most permanent prose in a repository,
 * and it is the one artifact nobody revises later. That is what earns a gate
 * here and nowhere else.
 *
 * Two escape hatches, both honoured without argument: HUMAN_SKIP=1 and
 * --no-verify. A gate with no way past it gets disabled wholesale, which
 * leaves you with no gate at all.
 */

const PLUGIN_ROOT = path.join(__dirname, '../..');
const MIN_WORDS = 15;

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() === '' ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Split a command into words the way a shell would: runs of non-space
 * characters, quotes group and protect spaces, backslashes escape the next
 * character inside or outside double quotes. Single quotes protect
 * everything literally, as a shell does.
 */
function splitWords(command) {
  const words = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else current += ch;
      continue;
    }
    if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === '\\' && i + 1 < command.length) { current += command[i + 1]; i += 1; }
      else current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current !== '') { words.push(current); current = ''; }
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '\\' && i + 1 < command.length) { current += command[i + 1]; i += 1; continue; }
    current += ch;
  }
  if (current !== '') words.push(current);
  return words;
}

/**
 * The commit message as git would assemble it. Every -m/--message value
 * becomes a paragraph; git joins multiple -m flags with a blank line, and so
 * does this. -F/--file reads the message from that file. Combined short
 * flags (-am) end in the flag that takes the value, and a value may be
 * attached to its flag (-m"text"), as git allows.
 *
 * Returns null when the command names no message source at all, leaving the
 * COMMIT_EDITMSG fallback to the caller. Returns '' when a source was named
 * but could not be read: falling back to the editmsg then would mean judging
 * the previous commit's message, which is worse than not judging. Anything
 * unrecognized is the same deal — a gate that guesses is worse than one that
 * declines to fire.
 */
function messageFromCommand(command) {
  const words = splitWords(command);
  const paragraphs = [];
  let file = null;

  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    const isMessageFlag = word === '-m' || word === '--message' || /^-[^-][a-zA-Z]*m$/.test(word);
    const isFileFlag = word === '-F' || word === '--file' || /^-[^-][a-zA-Z]*F$/.test(word);
    if (isMessageFlag || isFileFlag) {
      // The value is the next word; combined shorts like -am end here too.
      // A flag with no value after it is a command git itself will refuse.
      if (i + 1 >= words.length) return '';
      i += 1;
      if (isMessageFlag) paragraphs.push(words[i]);
      else file = words[i];
      continue;
    }
    if (word.startsWith('--message=')) { paragraphs.push(word.slice('--message='.length)); continue; }
    if (word.startsWith('--file=')) { file = word.slice('--file='.length); continue; }
    if (/^-m(.+)/.test(word)) { paragraphs.push(word.slice(2)); continue; }
    if (/^-F(.+)/.test(word)) { file = word.slice(2); continue; }
  }

  const text = paragraphs.map((p) => p.trim()).filter(Boolean).join('\n\n');
  if (text) return text;
  if (file !== null) return readMessageFile(file);
  return null;
}

/**
 * A -F/--file message, or null when the file cannot be read. The hook's cwd
 * is the session's cwd and the command may cd elsewhere first; only the
 * common case is handled, as in messageFromEditmsg. A missing file is
 * announced on stderr rather than skipped in silence.
 */
function readMessageFile(file) {
  try {
    return fs.readFileSync(path.resolve(file), 'utf8').trim() || null;
  } catch (e) {
    process.stderr.write(`human: could not read commit message file ${file}; allowing\n`);
    return null;
  }
}

function messageFromEditmsg() {
  // A git repo may sit anywhere above the cwd; only the common case is handled,
  // because a gate that guesses is worse than one that declines to fire.
  const candidate = path.join(process.cwd(), '.git/COMMIT_EDITMSG');
  try {
    const raw = fs.readFileSync(candidate, 'utf8');
    return raw.split('\n').filter((l) => !l.startsWith('#')).join('\n').trim() || null;
  } catch (e) {
    return null;
  }
}

function allow() {
  return 0;
}

/**
 * Deny through `permissionDecision` on stdout, at exit 0.
 *
 * Verified against the running CLI (v2.1.268): the denied Bash call comes back
 * with `toolDenialKind: "permission-rule"` and a tool_result that is exactly
 * the reason string below. Clean block, clean explanation.
 *
 * Do not "fix" this to stderr with exit 2. That path was tried and reverted.
 * Exit 2 does block, but Claude Code does not parse JSON on that path: it wraps
 * whatever is on stderr verbatim behind a generic `PreToolUse:Bash hook error:`
 * prefix, so the model receives a JSON blob inside an error message instead of
 * a reason. It only reads well if the model does the untangling, which is this
 * hook's job, not the model's.
 */
function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  return 0;
}

function main() {
  if (process.env.HUMAN_SKIP === '1') return allow();

  const payload = readPayload();
  const command = payload && payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string') return allow();
  if (!/\bgit\s+commit\b/.test(command)) return allow();
  if (/--no-verify/.test(command)) return allow();

  const fromCommand = messageFromCommand(command);
  // null means no message source was named and the editor fallback applies;
  // anything else, including '', means a source was named and the editmsg
  // would be the previous commit's message, not this one's.
  const message = fromCommand === null ? messageFromEditmsg() : fromCommand;
  if (!message) return allow();

  // Rate rules mean nothing at this length, and commit-opener is the only
  // check that can fire on a short subject anyway.
  const words = message.split(/\s+/).filter(Boolean).length;

  let report;
  try {
    report = checkText(message, {
      rootDir: PLUGIN_ROOT,
      path: 'COMMIT_EDITMSG',
      register: 'commit',
      lang: process.env.HUMAN_LANG || 'en',
    });
  } catch (e) {
    process.stderr.write(`human: ${e.message}\n`);
    return allow();
  }

  const failing = report.results.filter((r) => r.over && r.gates);
  const relevant = words < MIN_WORDS ? failing.filter((r) => r.id === 'commit-opener') : failing;
  if (relevant.length === 0) return allow();

  const reasons = relevant.map((r) => `  ${r.id}: ${r.message}`).join('\n');
  return deny(
    `human: the commit message is over budget on the commit register.\n\n${reasons}\n\n`
    + 'Rewrite it: imperative subject, and a body only when the diff does not already\n'
    + 'explain why. To commit anyway, add --no-verify or set HUMAN_SKIP=1.'
  );
}

process.exit(main());
