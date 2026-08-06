#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { checkFile } = require('../../lib/check');
const { formatReport } = require('../../lib/format');

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
  const docPath = path.join(PLUGIN_ROOT, 'registers', `${register}.md`);
  try {
    return fs.readFileSync(docPath, 'utf8');
  } catch (e) {
    return '';
  }
}

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
