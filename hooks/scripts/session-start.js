#!/usr/bin/env node
'use strict';

const path = require('path');
const { loadConfig } = require('../../lib/config');

/**
 * Inject the invariant budgets once, at session start.
 *
 * Only the invariants, and only the gating ones. The register documents cannot
 * be injected here because the artifact is not known yet, and spending the
 * session-start budget on advisory rules would push out the ones worth acting
 * on. Registers load later, lazily, and only when a check actually fails.
 *
 * The hard cap below is what keeps that promise honest as rules are added.
 */

const MAX_CHARS = 1200;

function render(invariants) {
  const rules = invariants.rules || {};
  const gating = Object.entries(rules).filter(([, e]) => e && e.gates);

  const lines = [
    'human: prose written this session is measured against these budgets.',
    'They apply to markdown and git text. Rates are per 1000 words and are not',
    'measured below 150 words.',
    '',
  ];

  for (const [id, entry] of gating) {
    const bound = entry.budget !== undefined && entry.budget !== null
      ? `max ${entry.budget}`
      : `min ${entry.floor}`;
    lines.push(`  ${id}: ${bound} (${entry.confidence})`);
  }

  lines.push(
    '',
    'Register depends on the artifact; a commit message and a README do not',
    'obey one rule set. Read the human skill for the routing table and the',
    'rubric before writing prose that ships.',
    'This measures a budget. It does not judge who wrote the text.'
  );

  return lines.join('\n');
}

/**
 * One line naming an existing persona, and nothing more.
 *
 * The persona itself loads on command only. That is a deliberate exception to
 * the push-not-pull rule: a persona is large, most sessions write no prose at
 * all, and paying its weight ambiently in every code session would be the
 * wrong trade. Naming the file costs about fifteen tokens and means nobody has
 * to remember it exists.
 */
function personaLine() {
  try {
    const { findPersona } = require('../../lib/persona');
    const { userPath, projectPath } = findPersona(process.cwd());
    const found = projectPath || userPath;
    if (!found) return '';
    return `\nA persona is on disk (${found}). Run /human:human to load it.`;
  } catch (e) {
    return '';
  }
}

function main() {
  let context = '';
  try {
    const config = loadConfig(path.join(__dirname, '../..'));
    const rendered = render(config.invariants) + personaLine();
    context = rendered.length <= MAX_CHARS ? rendered : `${rendered.slice(0, MAX_CHARS - 20)}\n[truncated]`;
  } catch (e) {
    // A broken rules file must not take the session down with it. Say so on
    // stderr, inject nothing, and let the session proceed unmeasured.
    process.stderr.write(`human: ${e.message}\n`);
    context = '';
  }

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: context },
  }));
  return 0;
}

process.exit(main());
