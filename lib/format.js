'use strict';

/**
 * Rendering a report.
 *
 * Two sections, and the split is the point. What is over a gating budget goes
 * first and is worth acting on. What is merely advisory goes under its own
 * heading with its confidence attached, so a reader can dismiss it without
 * having to look anything up.
 *
 * The formatter never says "AI-generated" or "detected". This tool measures a
 * budget; it does not know who wrote the text, and a test asserts that the
 * language here keeps that promise.
 */

/**
 * The parenthetical after a rule id. When a persona moved the budget, that
 * fact goes here rather than in a footnote: the reader is looking at a number
 * and deserves to know it is not the published one.
 */
function label(result) {
  if (result.adjustedFrom === undefined) return result.confidence;
  return `${result.confidence}, budget adjusted ${result.adjustedFrom} -> ${result.budget} by persona`;
}

function renderHits(result, indent) {
  return result.hits
    .filter((h) => h && h.text)
    .map((h) => `${indent}${h.line ? `line ${h.line}: ` : ''}${h.text}`);
}

function formatReport(report, opts) {
  const options = opts || {};
  const lines = [];
  const failing = report.results.filter((r) => r.over && r.gates);
  const advisory = report.results.filter((r) => r.over && !r.gates);

  const where = report.register
    ? `${report.path} [${report.register}${report.overridden ? ', overridden' : ''}]`
    : `${report.path} [no register matched]`;
  lines.push(`${where}  ${report.words} words, ${report.sentences} sentences`);

  // A clamp is the persona asking for something it did not get, and an unknown
  // override is a typo silently doing nothing. Both are reported before any
  // verdict, because both are true whether or not the document passed.
  const notes = [];
  for (const clamp of report.clamps || []) {
    notes.push(
      `  clamped: persona asked for ${clamp.rule} ${clamp.requested}, ceiling is ${clamp.ceiling}, applied ${clamp.applied}.`
    );
  }
  for (const id of report.unknownOverrides || []) {
    notes.push(`  ignored: persona overrides "${id}", which is not a rule.`);
  }
  lines.push(...notes);

  if (failing.length === 0 && advisory.length === 0) {
    lines.push('  within budget on every rule.');
    return lines.join('\n');
  }

  if (failing.length > 0) {
    lines.push('  over budget:');
    for (const r of failing) {
      lines.push(`    ${r.id} (${label(r)}) — ${r.message}`);
      lines.push(...renderHits(r, '      '));
    }
  }

  if (advisory.length > 0 && !options.quiet) {
    lines.push('  advisory, does not gate:');
    for (const r of advisory) {
      lines.push(`    ${r.id} (${label(r)}) — ${r.message}`);
      lines.push(...renderHits(r, '      '));
    }
  }


  const clean = report.results.filter((r) => !r.over).map((r) => r.id);
  if (clean.length > 0) lines.push(`  within budget: ${clean.join(', ')}`);

  return lines.join('\n');
}

/** The one-line summary a hook injects when it has little room. */
function formatBrief(report) {
  const failing = report.results.filter((r) => r.over && r.gates);
  if (failing.length === 0) return `${report.path}: within budget.`;
  return `${report.path}: ${failing.map((r) => `${r.id} ${r.rate}/${r.budget}`).join(', ')}`;
}

module.exports = { formatReport, formatBrief };
