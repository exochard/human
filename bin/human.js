#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { checkFile, checkText } = require('../lib/check');
const { formatReport } = require('../lib/format');
const { defaultRoot } = require('../lib/config');
const { loadPersona } = require('../lib/persona');
const { runDoctor } = require('../lib/doctor');

/**
 * The command-line entry point.
 *
 * Exit codes: 0 when every report is within budget, 1 when a gating rule is
 * over, 2 on a configuration or usage error. A style gate that cannot tell
 * "your prose is over budget" from "I could not read my own rules" is useless
 * in CI, so those two stay distinct.
 */

const USAGE = `usage: human [paths...] [options]

  --doctor           what is in force now: budgets, persona, registers
  --path <p>         with --doctor, show which register a path resolves to
  --persona          load the persona file and apply its adjustments
  --fix              not implemented; see below
  --json             machine-readable report
  --lang <en|it>     vocabulary profile (default en)
  --register <name>  override the routed register
  --quiet            omit advisory findings
  --help

With no paths, reads stdin. Exit 0 within budget, 1 over a gating rule,
2 on a configuration error.`;

function parseArgs(argv) {
  const opts = { paths: [], json: false, quiet: false, fix: false, lang: null, register: null,
    doctor: false, persona: false, pathHint: null };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') return { ...opts, help: true };
    else if (arg === '--json') opts.json = true;
    else if (arg === '--quiet') opts.quiet = true;
    else if (arg === '--fix') opts.fix = true;
    else if (arg === '--doctor') opts.doctor = true;
    else if (arg === '--persona') opts.persona = true;
    else if (arg === '--path') { opts.pathHint = argv[i + 1]; i += 1; }
    else if (arg === '--lang') { opts.lang = argv[i + 1]; i += 1; }
    else if (arg === '--register') { opts.register = argv[i + 1]; i += 1; }
    else if (arg.startsWith('-')) { opts.unknown = arg; return opts; }
    else opts.paths.push(arg);
  }
  return opts;
}

function expand(target, out) {
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(target)) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      expand(path.join(target, entry), out);
    }
  } else if (target.endsWith('.md')) {
    out.push(target);
  }
  return out;
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (e) {
    return '';
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { console.log(USAGE); return 0; }
  // A diagnostic that can fail is not a diagnostic, so this always exits 0.
  if (opts.doctor) { console.log(runDoctor({ path: opts.pathHint })); return 0; }
  if (opts.unknown) { console.error(`human: unknown option ${opts.unknown}\n\n${USAGE}`); return 2; }

  if (opts.fix) {
    console.error(
      'human: --fix is not implemented. Rewriting prose mechanically is not safe: a rule\n'
      + 'can tell you a sentence is over budget, but not what the sentence was trying to say.\n'
      + 'Read the report and edit by hand.'
    );
    return 2;
  }

  let persona = null;
  if (opts.persona) {
    try {
      persona = loadPersona({});
    } catch (e) {
      console.error(`human: ${e.message}`);
      return 2;
    }
    if (!persona) console.error('human: --persona given but no persona file found; continuing without one');
  }

  const base = {
    rootDir: defaultRoot(),
    lang: opts.lang || null,
    register: opts.register || undefined,
    persona,
  };
  const reports = [];

  try {
    if (opts.paths.length === 0) {
      const text = readStdin();
      if (text.trim() === '') { console.error(`human: nothing to check\n\n${USAGE}`); return 2; }
      reports.push(checkText(text, { ...base, path: opts.register === 'commit' ? 'COMMIT_EDITMSG' : 'stdin.md' }));
    } else {
      const files = [];
      for (const target of opts.paths) expand(target, files);
      if (files.length === 0) { console.error('human: no markdown files matched'); return 2; }
      for (const file of files) {
        const report = checkFile(file, { ...base, path: path.relative(process.cwd(), file) || file });
        // checkFile returns null for a persona file, which is skipped on purpose.
        if (report) reports.push(report);
      }
      if (reports.length === 0) { console.error('human: every matched file was a persona file'); return 2; }
    }
  } catch (e) {
    console.error(`human: ${e.message}`);
    return 2;
  }

  if (opts.json) {
    console.log(JSON.stringify({ reports, ok: reports.every((r) => r.ok) }, null, 2));
  } else {
    for (const report of reports) console.log(formatReport(report, { quiet: opts.quiet }));
  }

  return reports.every((r) => r.ok) ? 0 : 1;
}

process.exit(main());
