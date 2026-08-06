'use strict';

const fs = require('fs');
const path = require('path');
const { extractProse, splitSentences, wordCount } = require('./text');
const { loadConfig, defaultRoot } = require('./config');
const { routeFor } = require('./routes');
const { runInvariants } = require('./invariants');
const { runRegister } = require('./registers');
const { applyPersona, isPersonaPath } = require('./persona');

/**
 * The scanner.
 *
 * Everything here is regex and arithmetic. There is no model call, no network
 * access, and no subprocess, and a test asserts as much by reading this file.
 * That constraint is the product: a check that costs nothing can run on every
 * write without anyone weighing whether it is worth it.
 */

function buildDoc(text, relPath) {
  const prose = extractProse(text);
  return {
    path: relPath,
    raw: String(text),
    prose,
    sentences: splitSentences(prose),
    words: wordCount(prose),
  };
}

function checkText(text, opts) {
  const options = opts || {};
  const config = loadConfig(options.rootDir || defaultRoot());
  const relPath = options.path || 'input.md';

  const routed = routeFor(relPath, config.routes);
  const register = options.register || routed.register;

  // A persona may move a budget within its published ceiling. Everything it
  // moved is recorded so the report can name it: a number that changed is more
  // interesting than one that did not, and hiding it would make this tool's
  // own output the kind of thing it exists to distrust.
  const persona = options.persona || null;
  const applied = applyPersona(config.invariants, persona, config.vocab);
  const invariants = applied.invariants;
  const vocab = applied.vocab || config.vocab;
  const lang = options.lang || (persona && persona.language) || config.routes.default_language || 'en';

  const adjustments = {};
  for (const [id, entry] of Object.entries(invariants.rules || {})) {
    const original = config.invariants.rules[id] || {};
    const key = entry.floor !== undefined && entry.floor !== null ? 'floor' : 'budget';
    if (original[key] !== entry[key]) adjustments[id] = { from: original[key], to: entry[key] };
  }

  const doc = buildDoc(text, relPath);
  const results = [
    ...runInvariants(doc, invariants, vocab, lang),
    ...runRegister(doc, register, config.registers),
  ];

  for (const result of results) {
    if (adjustments[result.id]) result.adjustedFrom = adjustments[result.id].from;
  }

  const gatingFailures = results.filter((r) => r.over && r.gates).length;

  return {
    path: relPath,
    register: register || null,
    matched: routed.matched,
    overridden: Boolean(options.register) && options.register !== routed.register,
    lang,
    words: doc.words,
    sentences: doc.sentences.length,
    results,
    personaSources: persona ? persona.sources : [],
    adjustments,
    clamps: applied.clamps,
    unknownOverrides: applied.unknown,
    gatingFailures,
    ok: gatingFailures === 0,
  };
}

function checkFile(absPath, opts) {
  const options = opts || {};
  // A file describing how you write is not a document written in your style.
  // Scanning it would be a category error, so it is skipped outright.
  if (isPersonaPath(absPath)) return null;

  const text = fs.readFileSync(absPath, 'utf8');
  const relPath = options.path
    || path.relative(options.rootDir ? path.resolve(options.rootDir) : process.cwd(), absPath)
    || path.basename(absPath);
  return checkText(text, { ...options, path: relPath });
}

module.exports = { checkText, checkFile, buildDoc };
