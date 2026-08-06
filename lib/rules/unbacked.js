'use strict';

const { lineOf } = require('../text');
const { makeResult, ratePer1000, overBudget } = require('./result');

/**
 * A superlative in a sentence carrying no number.
 *
 * "Blazing fast" is a claim with nothing behind it. "Runs in 3 ms, which is
 * blazing fast" is the same claim with evidence, and passes. The digit test is
 * crude on purpose: it is cheap, it has no false negatives worth worrying
 * about, and its false positives are all sentences that would read better with
 * a number in them anyway.
 *
 * Confidence is weak and this rule never gates. It comes from maintainer
 * complaints, not from a controlled study, and it is labelled as such.
 */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const rule = {
  id: 'unbacked',
  confidence: 'weak',
  gates: false,
  describe:
    'Superlatives in a sentence with no number in it. Inferred from what maintainers say gives away generated documentation; no controlled study supports it, so it never gates.',

  check(doc, config) {
    const budget = config.budget;
    const adjectives = config.adjectives || [];
    const hits = [];

    if (adjectives.length > 0) {
      const pattern = new RegExp(
        `(?<![\\w'’-])(?:${adjectives.map(escapeRegex).join('|')})(?![\\w'’-])`,
        'iu'
      );
      for (const sentence of doc.sentences) {
        if (/\d/.test(sentence)) continue;
        const match = sentence.match(pattern);
        if (match) hits.push({ line: lineOf(doc.raw, match[0]), text: match[0] });
      }
    }

    const count = hits.length;
    const rate = ratePer1000(count, doc.words);
    const over = overBudget(count, rate, budget, doc.words, config.minCount);

    return makeResult(rule, {
      count,
      rate,
      budget,
      over,
      hits: hits.slice(0, 3),
      message: count === 0
        ? `no unbacked superlatives.`
        : `${count} superlatives in sentences with no number, ${rate} per 1000 words against a budget of ${budget}.`,
    });
  },
};

module.exports = rule;
