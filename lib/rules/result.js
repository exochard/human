'use strict';

/**
 * The single shape every rule returns, so the scanner can treat rules
 * uniformly and the formatter can render them without special cases.
 *
 * `over` means "this rule is unhappy". Most rules are unhappy above their
 * budget; burstiness is unhappy below its floor. Keeping one field name for
 * both is what lets check.js tally failures without knowing which is which.
 */

const MIN_WORDS_FOR_RATE = 150;

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Occurrences per 1000 words. */
function ratePer1000(count, words) {
  return words > 0 ? round2((count * 1000) / words) : 0;
}

function makeResult(rule, fields) {
  return {
    id: rule.id,
    confidence: rule.confidence,
    gates: rule.gates,
    count: 0,
    rate: 0,
    budget: null,
    over: false,
    hits: [],
    message: '',
    ...fields,
  };
}

module.exports = { makeResult, ratePer1000, round2, MIN_WORDS_FOR_RATE };
