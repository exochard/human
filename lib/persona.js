'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseYaml } = require('./yaml');
const { stripFrontmatter } = require('./text');

/**
 * The persona layer: who is writing, handed to the model before it writes.
 *
 * This layer belongs with the registers, in the judgment half. "An Italian
 * founder shipping infrastructure to developers who distrust marketing" is not
 * checkable by regex, and pretending otherwise would be the same overclaim the
 * rest of the plugin refuses to make. The persona shapes what the model is
 * told; it does not change what the scanner can verify.
 *
 * The one mechanical exception is budget adjustment, and it is bounded. A
 * persona may loosen a budget as far as the ceiling published beside it in
 * rules/invariants.yml, and no further. Past the ceiling the value is clamped
 * and the clamp is reported. Never accepted in silence, never dropped in
 * silence: the point of a visible adjustment is that it stays visible.
 */

const PROJECT_FILE = path.join('.claude', 'human.local.md');
const USER_FILE = path.join('.claude', 'human', 'persona.md');
const MAX_WALK = 20;

/** Rules that loosen by moving their threshold down rather than up. */
const INVERTED = { burstiness: { key: 'floor', ceiling: 'floorCeiling' } };

function normalize(p) {
  return String(p).replace(/\\/g, '/');
}

function isPersonaPath(p) {
  const target = normalize(p);
  return target.endsWith('.claude/human.local.md') || target.endsWith('.claude/human/persona.md');
}

function findProject(cwd) {
  let dir = path.resolve(cwd);
  for (let i = 0; i < MAX_WALK; i += 1) {
    const candidate = path.join(dir, PROJECT_FILE);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findPersona(cwd, homeDir) {
  const userPath = path.join(homeDir || os.homedir(), USER_FILE);
  return {
    userPath: fs.existsSync(userPath) ? userPath : null,
    projectPath: findProject(cwd || process.cwd()),
  };
}

function readOne(absPath) {
  let raw;
  try {
    raw = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    const err = new Error(`human: cannot read persona at ${absPath}: ${e.message}`);
    err.code = 'HUMAN_PERSONA';
    throw err;
  }

  const { frontmatter, body } = stripFrontmatter(raw);
  let parsed = {};
  if (frontmatter !== null && frontmatter.trim() !== '') {
    try {
      parsed = parseYaml(frontmatter);
    } catch (e) {
      const err = new Error(`human: cannot parse persona frontmatter in ${absPath}: ${e.message}`);
      err.code = 'HUMAN_PERSONA';
      throw err;
    }
  }
  return { frontmatter: parsed || {}, body: body.trim() };
}

function loadPersona(opts) {
  const options = opts || {};
  const { userPath, projectPath } = findPersona(options.cwd, options.homeDir);
  if (!userPath && !projectPath) return null;

  const sources = [];
  const bodies = [];
  let frontmatter = {};

  for (const [label, source] of [['user', userPath], ['project', projectPath]]) {
    if (!source) continue;
    const one = readOne(source);
    sources.push(source);
    // Project wins field by field, so a project can set an audience without
    // having to restate an identity.
    frontmatter = {
      ...frontmatter,
      ...one.frontmatter,
      overrides: { ...(frontmatter.overrides || {}), ...(one.frontmatter.overrides || {}) },
      allow: [...(frontmatter.allow || []), ...(one.frontmatter.allow || [])],
    };
    if (one.body) bodies.push(`<!-- ${label}: ${source} -->\n\n${one.body}`);
  }

  return {
    sources,
    frontmatter,
    body: bodies.join('\n\n'),
    overrides: frontmatter.overrides || {},
    allow: frontmatter.allow || [],
    language: frontmatter.language || null,
  };
}

/**
 * Apply a persona's adjustments, returning copies. Never mutates its inputs:
 * the loaded config is cached per root and shared across every check in the
 * process, so mutating it would leak one document's persona into the next.
 */
function applyPersona(invariants, persona, vocabLists) {
  if (!persona) return { invariants, vocab: vocabLists, clamps: [], unknown: [] };

  const next = JSON.parse(JSON.stringify(invariants));
  const clamps = [];
  const unknown = [];

  for (const [id, requested] of Object.entries(persona.overrides || {})) {
    const entry = next.rules && next.rules[id];
    if (!entry || typeof requested !== 'number') { unknown.push(id); continue; }

    const inverted = INVERTED[id];
    const key = inverted ? inverted.key : 'budget';
    const ceiling = inverted ? entry[inverted.ceiling] : entry.ceiling;
    const current = entry[key];

    // Tightening needs no ceiling. Only loosening does, and which direction
    // counts as loosening depends on the rule.
    const loosening = inverted ? requested < current : requested > current;
    if (loosening && ceiling !== undefined && ceiling !== null) {
      const past = inverted ? requested < ceiling : requested > ceiling;
      if (past) {
        clamps.push({ rule: id, requested, applied: ceiling, ceiling });
        entry[key] = ceiling;
        continue;
      }
    }
    entry[key] = requested;
  }

  let vocab = vocabLists;
  const allow = (persona.allow || []).map((w) => String(w).toLowerCase());
  if (vocabLists && allow.length > 0) {
    vocab = {};
    for (const [lang, list] of Object.entries(vocabLists)) {
      vocab[lang] = { ...list, words: (list.words || []).filter((w) => !allow.includes(String(w).toLowerCase())) };
    }
  }

  return { invariants: next, vocab, clamps, unknown };
}

module.exports = { loadPersona, findPersona, applyPersona, isPersonaPath };
