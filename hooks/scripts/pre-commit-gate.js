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

/** The -m value, honouring single or double quotes. */
function messageFromCommand(command) {
  const match = command.match(/-m\s+(?:"((?:[^"\\]|\\.)*)"|'([^']*)'|(\S+))/);
  if (!match) return null;
  const value = match[1] !== undefined ? match[1].replace(/\\(.)/g, '$1') : (match[2] ?? match[3]);
  return value || null;
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
 * A PreToolUse denial goes to stderr and exits 2. Not stdout, and not exit 0.
 *
 * This was wrong in the first implementation and the tests did not catch it,
 * because they asserted the shape this file emitted rather than the shape
 * Claude Code reads. The gate reported a clean deny and blocked nothing.
 */
function deny(reason) {
  process.stderr.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
    systemMessage: reason,
  }));
  return 2;
}

function main() {
  if (process.env.HUMAN_SKIP === '1') return allow();

  const payload = readPayload();
  const command = payload && payload.tool_input && payload.tool_input.command;
  if (typeof command !== 'string') return allow();
  if (!/\bgit\s+commit\b/.test(command)) return allow();
  if (/--no-verify/.test(command)) return allow();

  const message = messageFromCommand(command) || messageFromEditmsg();
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
