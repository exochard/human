'use strict';

const fs = require('fs');
const path = require('path');
const { extractProse, splitSentences, wordCount } = require('./text');
const { loadConfig, defaultRoot } = require('./config');
const { routeFor } = require('./routes');
const { runInvariants } = require('./invariants');
const { runRegister } = require('./registers');

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
  const lang = options.lang || config.routes.default_language || 'en';

  const routed = routeFor(relPath, config.routes);
  const register = options.register || routed.register;

  const doc = buildDoc(text, relPath);
  const results = [
    ...runInvariants(doc, config.invariants, config.vocab, lang),
    ...runRegister(doc, register, config.registers),
  ];

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
    gatingFailures,
    ok: gatingFailures === 0,
  };
}

function checkFile(absPath, opts) {
  const options = opts || {};
  const text = fs.readFileSync(absPath, 'utf8');
  const relPath = options.path
    || path.relative(options.rootDir ? path.resolve(options.rootDir) : process.cwd(), absPath)
    || path.basename(absPath);
  return checkText(text, { ...options, path: relPath });
}

module.exports = { checkText, checkFile, buildDoc };
