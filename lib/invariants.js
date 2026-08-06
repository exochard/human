'use strict';

const tricolon = require('./rules/tricolon');
const vocab = require('./rules/vocab');
const burstiness = require('./rules/burstiness');
const unbacked = require('./rules/unbacked');
const demoted = require('./rules/demoted');

/**
 * The invariant layer: rules that hold whatever the artifact is.
 *
 * Order is stable and deliberate. Gating rules first, in descending evidence
 * strength, then the advisory ones. A reader scanning the report top-down
 * meets the claims worth acting on before the ones worth ignoring.
 */

const GATING = [tricolon, vocab, burstiness, unbacked];
const ALL = [...GATING, ...demoted];

function configFor(id, invariants, vocabLists, lang) {
  const entry = (invariants.rules && invariants.rules[id]) || {};
  if (id !== 'vocab') return entry;

  const list = vocabLists[lang] || vocabLists.en || { words: [] };
  return { ...entry, words: list.words || [] };
}

function runInvariants(doc, invariants, vocabLists, lang) {
  return ALL.map((rule) => {
    const result = rule.check(doc, configFor(rule.id, invariants, vocabLists, lang));
    // The config file is the authority on whether a rule gates. A rule module
    // declaring gates:true cannot promote itself past a config that says no.
    const entry = (invariants.rules && invariants.rules[rule.id]) || {};
    if (typeof entry.gates === 'boolean') result.gates = entry.gates && rule.gates;
    return result;
  });
}

module.exports = { runInvariants, GATING, ALL };
