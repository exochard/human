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

/**
 * Whether a rate rule may fire.
 *
 * A rate alone is not enough, and the benchmark is what proved it. The source
 * studies count per document, not per 1000 words; converting to a rate without
 * a floor on the absolute count means that in a 200-word README a single
 * instance scores 5.0 and fails a budget of 4.0. One tricolon is ordinary
 * human writing. The published human average is 3.73 per document.
 *
 * So a rule fires only when the document is long enough for a rate to be
 * stable AND the raw count is high enough to be a habit rather than an
 * instance.
 */
function overBudget(count, rate, budget, words, minCount) {
  return words >= MIN_WORDS_FOR_RATE
    && count >= (minCount === undefined ? 1 : minCount)
    && rate > budget;
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

module.exports = { makeResult, ratePer1000, overBudget, round2, MIN_WORDS_FOR_RATE };
