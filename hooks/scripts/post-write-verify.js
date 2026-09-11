#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { checkFile } = require('../../lib/check');
const { formatReport } = require('../../lib/format');
const { isPersonaPath } = require('../../lib/persona');

/**
 * Measure a markdown write, and say nothing unless it is over budget.
 *
 * This is where the cost curve inverts. A non-markdown path returns before
 * doing any work at all, which is almost every write. A clean markdown file
 * costs a few milliseconds of regex and produces no output, so it costs no
 * tokens either. Only a failure loads the register document, and by then the
 * tokens are buying something.
 *
 * It never blocks. It reports; the agent decides.
 */

const PLUGIN_ROOT = path.join(__dirname, '../..');

function readPayload() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() === '' ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function filePathFrom(payload) {
  const input = payload && payload.tool_input;
  if (!input) return null;
  return input.file_path || input.filePath || input.path || null;
}

function registerDoc(register) {
  if (!register) return '';
  const docPath = path.join(PLUGIN_ROOT, 'skills/human/references/registers', `${register}.md`);
  try {
    return fs.readFileSync(docPath, 'utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Report through `additionalContext` on stdout, at exit 0.
 *
 * Verified against the running CLI (v2.1.268) rather than inferred: this shape
 * produces a dedicated `hook_additional_context` attachment carrying the report
 * straight into the model's context, which is exactly what is wanted.
 *
 * Do not "fix" this to stderr with exit 2. That path was tried and reverted.
 * Claude Code classifies an exit-2 PostToolUse as a `hook_blocking_error` — an
 * error on the tool call rather than a note about it — and the observed result
 * was the model unsure whether the write had even succeeded. This hook reports;
 * it must never look like a block.
 */
function emit(context) {
  if (context) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: context },
    }));
  }
  return 0;
}

function main() {
  const payload = readPayload();
  const target = filePathFrom(payload);

  if (!target || !target.endsWith('.md')) return emit('');
  // A file describing how you write is not a document written in your style.
  if (isPersonaPath(target)) return emit('');
  if (!fs.existsSync(target)) return emit('');

  let report;
  try {
    report = checkFile(target, { rootDir: PLUGIN_ROOT, lang: process.env.HUMAN_LANG || 'en' });
  } catch (e) {
    process.stderr.write(`human: ${e.message}\n`);
    return emit('');
  }

  if (report.ok) return emit('');

  const parts = [
    'human: this file is over budget on a gating rule.',
    '',
    formatReport(report, { quiet: true }),
    '',
  ];

  const doc = registerDoc(report.register);
  if (doc) {
    parts.push(`Register guidance for "${report.register}":`, '', doc);
  } else {
    parts.push(
      'No register matched this path. Apply the rubric in the human skill, name the',
      'register you chose, and say why in one line.'
    );
  }

  parts.push('', 'Fix the prose. Changing a budget to pass is almost always the wrong move.');

  return emit(parts.join('\n'));
}

process.exit(main());
