#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { checkFile } = require('../lib/check');
const { GATING } = require('../lib/invariants');

/**
 * What the scanner costs and what it separates.
 *
 * This prints whatever it measures. A benchmark that can only produce good
 * news is not a benchmark, and the numbers here go into README.md verbatim
 * including the ones that are unflattering.
 */

const ROOT = path.join(__dirname, '..');
const FIXTURES = path.join(__dirname, 'fixtures');
const CLASSES = ['machine', 'human'];

function filesIn(cls) {
  const dir = path.join(FIXTURES, cls);
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => path.join(dir, f));
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(n, places) {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}

function measure() {
  const timings = [];
  const byClass = {};

  for (const cls of CLASSES) {
    byClass[cls] = [];
    for (const file of filesIn(cls)) {
      const started = process.hrtime.bigint();
      const report = checkFile(file, { rootDir: ROOT, lang: 'en' });
      timings.push(Number(process.hrtime.bigint() - started) / 1e6);
      byClass[cls].push({ file: path.basename(file), report });
    }
  }
  return { timings, byClass };
}

function perRuleRates(entries, ruleId) {
  return entries.map((e) => {
    const result = e.report.results.find((r) => r.id === ruleId);
    return result ? result.rate : 0;
  });
}

function main() {
  const { timings, byClass } = measure();
  const totalWords = CLASSES.reduce(
    (sum, cls) => sum + byClass[cls].reduce((s, e) => s + e.report.words, 0), 0
  );

  console.log('human — benchmark\n');
  console.log(`corpus: ${byClass.machine.length} machine, ${byClass.human.length} human, ${totalWords} words total`);
  console.log(`median runtime: ${round(median(timings), 2)} ms per document`);
  console.log(`slowest: ${round(Math.max(...timings), 2)} ms\n`);

  console.log('gating verdict by class');
  for (const cls of CLASSES) {
    const flagged = byClass[cls].filter((e) => !e.report.ok).length;
    const total = byClass[cls].length;
    console.log(`  ${cls.padEnd(8)} ${flagged}/${total} flagged`);
  }

  const machineFlagged = byClass.machine.filter((e) => !e.report.ok).length;
  const humanFlagged = byClass.human.filter((e) => !e.report.ok).length;
  console.log(`\n  true positives  ${machineFlagged}/${byClass.machine.length}`);
  console.log(`  false positives ${humanFlagged}/${byClass.human.length}`);

  console.log('\nmean rate by rule (machine vs human)');
  for (const rule of GATING) {
    const m = perRuleRates(byClass.machine, rule.id);
    const h = perRuleRates(byClass.human, rule.id);
    const mMean = m.reduce((a, b) => a + b, 0) / m.length;
    const hMean = h.reduce((a, b) => a + b, 0) / h.length;
    const sep = hMean === 0 ? (mMean === 0 ? 1 : Infinity) : mMean / hMean;
    console.log(
      `  ${rule.id.padEnd(12)} ${round(mMean, 2).toString().padStart(7)} vs ${round(hMean, 2).toString().padStart(7)}`
      + `   ${sep === Infinity ? 'inf' : `${round(sep, 2)}x`}`
    );
  }

  console.log('\nburstiness distribution (the floor is calibrated here, not from the literature)');
  for (const cls of CLASSES) {
    const values = perRuleRates(byClass[cls], 'burstiness').filter((v) => v > 0);
    if (values.length === 0) { console.log(`  ${cls.padEnd(8)} not measurable at this length`); continue; }
    console.log(`  ${cls.padEnd(8)} min ${round(Math.min(...values), 2)}  median ${round(median(values), 2)}  max ${round(Math.max(...values), 2)}`);
  }

  console.log('\nper document');
  for (const cls of CLASSES) {
    for (const e of byClass[cls]) {
      const failing = e.report.results.filter((r) => r.over && r.gates).map((r) => r.id);
      console.log(
        `  ${cls.padEnd(8)} ${e.file.padEnd(16)} ${String(e.report.words).padStart(4)}w  `
        + `${e.report.ok ? 'within budget' : `over: ${failing.join(', ')}`}`
      );
    }
  }

  return 0;
}

process.exit(main());
