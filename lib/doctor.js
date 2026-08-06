'use strict';

const fs = require('fs');
const path = require('path');
const { loadConfig, defaultRoot } = require('./config');
const { loadPersona, applyPersona } = require('./persona');
const { routeFor } = require('./routes');

/**
 * What is actually in force right now.
 *
 * Budgets are adjustable, personas are merged from two files, and a route can
 * be overridden. Any of those can surprise a reader looking at a report, so
 * there has to be one place that answers "why did it decide that" without
 * anybody reading source.
 */

function line(label, value) {
  return `  ${String(label).padEnd(16)} ${value}`;
}

function runDoctor(opts) {
  const options = opts || {};
  const root = options.rootDir || defaultRoot();
  const out = [];

  let config;
  try {
    config = loadConfig(root);
  } catch (e) {
    return `human doctor\n\n  config          BROKEN — ${e.message}\n`;
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(root, '.claude-plugin/plugin.json'), 'utf8'));
  out.push('human doctor', '');
  out.push(line('version', manifest.version));
  out.push(line('rules', path.join(root, 'rules')));

  let persona = null;
  let personaError = null;
  try {
    persona = loadPersona({ cwd: options.cwd || process.cwd(), homeDir: options.homeDir });
  } catch (e) {
    personaError = e.message;
  }

  out.push('');
  if (personaError) out.push(line('persona', `BROKEN — ${personaError}`));
  else if (!persona) out.push(line('persona', 'none — run /human:human-persona to create one'));
  else {
    out.push(line('persona', `${persona.sources.length} source(s)`));
    for (const source of persona.sources) out.push(line('', source));
    if (persona.language) out.push(line('language', persona.language));
    if (persona.allow.length) out.push(line('allowed words', persona.allow.join(', ')));
  }

  const applied = applyPersona(config.invariants, persona, config.vocab);

  out.push('', '  budgets in force');
  for (const [id, entry] of Object.entries(applied.invariants.rules || {})) {
    const original = config.invariants.rules[id];
    const key = entry.floor !== undefined && entry.floor !== null ? 'floor' : 'budget';
    const moved = original[key] !== entry[key] ? `  (adjusted from ${original[key]})` : '';
    const gate = entry.gates ? 'gates' : 'advisory';
    out.push(`    ${id.padEnd(12)} ${key} ${String(entry[key]).padEnd(6)} ${entry.confidence.padEnd(9)} ${gate}${moved}`);
  }

  for (const clamp of applied.clamps) {
    out.push(`    clamped: ${clamp.rule} asked ${clamp.requested}, ceiling ${clamp.ceiling}, applied ${clamp.applied}`);
  }
  for (const id of applied.unknown) {
    out.push(`    ignored: "${id}" is not a rule`);
  }

  const langs = Object.keys(applied.vocab || config.vocab).sort();
  out.push('', line('vocabularies', langs.join(', ')));

  out.push('', '  registers');
  for (const name of Object.keys(config.registers.registers).sort()) {
    const doc = path.join(root, 'skills/human/references/registers', `${name}.md`);
    out.push(`    ${name.padEnd(14)} ${fs.existsSync(doc) ? 'guidance present' : 'GUIDANCE MISSING'}`);
  }

  if (options.path) {
    const routed = routeFor(options.path, config.routes);
    out.push('', line('path', options.path));
    out.push(line('resolves to', routed.matched ? `${routed.register}  (via ${routed.via})` : 'no match — the rubric decides'));
  }

  out.push('');
  return out.join('\n');
}

module.exports = { runDoctor };
