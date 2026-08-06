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

  if (failing.length === 0 && advisory.length === 0) {
    lines.push('  within budget on every rule.');
    return lines.join('\n');
  }

  if (failing.length > 0) {
    lines.push('  over budget:');
    for (const r of failing) {
      lines.push(`    ${r.id} (${r.confidence}) — ${r.message}`);
      lines.push(...renderHits(r, '      '));
    }
  }

  if (advisory.length > 0 && !options.quiet) {
    lines.push('  advisory, does not gate:');
    for (const r of advisory) {
      lines.push(`    ${r.id} (${r.confidence}) — ${r.message}`);
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
