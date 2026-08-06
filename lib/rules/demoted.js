'use strict';

const { lineOf } = require('../text');
const { makeResult, ratePer1000, overBudget } = require('./result');

/**
 * Signals that are widely repeated and poorly evidenced.
 *
 * They are reported because a writer may still want to know, and they never
 * gate because the evidence does not support gating. Shipping these as hard
 * rules is the specific mistake this plugin exists to avoid, so their
 * `gates: false` is asserted by a test rather than left to good intentions.
 */

function rateRule({ id, describe, pattern, messageFor }) {
  const rule = {
    id,
    confidence: 'weak',
    gates: false,
    describe,
    check(doc, config) {
      const budget = config.budget;
      const hits = [];
      const re = new RegExp(pattern.source, pattern.flags);
      let match;
      while ((match = re.exec(doc.prose)) !== null) {
        hits.push({ line: lineOf(doc.raw, match[0]), text: match[0].trim().slice(0, 60) });
        if (match[0].length === 0) re.lastIndex += 1;
      }
      const count = hits.length;
      const rate = ratePer1000(count, doc.words);
      const over = overBudget(count, rate, budget, doc.words, config.minCount);
      return makeResult(rule, {
        count, rate, budget, over,
        hits: hits.slice(0, 3),
        message: messageFor(count, rate, budget),
      });
    },
  };
  return rule;
}

const emDash = rateRule({
  id: 'em-dash',
  describe:
    'Em dashes per 1000 words. Real for GPT-4o and 4.1, and a 2023 study of other model families found the opposite direction (arXiv:2308.09067). It tracks one generation of training data rather than machine text as such, so it is advisory and never gates.',
  pattern: /—/g,
  messageFor: (count, rate, budget) =>
    `${count} em dashes, ${rate} per 1000 words (advisory budget ${budget}).`,
});

const antithesis = rateRule({
  id: 'antithesis',
  describe:
    'The "not X, it is Y" construction and its trailing-negation variant. Repeated everywhere as a giveaway and, as far as this project could find, never measured against a human rhetorical baseline. Advisory only.',
  pattern: new RegExp(
    [
      "\\b(?:it'?s|it is|that'?s|this is)\\s+not\\s+[^.;:]{2,60}?[,;:]\\s*(?:it'?s|it is)\\b",
      '\\bnot\\s+(?:just|only|merely)\\s+[^.;:]{2,60}?,\\s*but\\b',
      '[,—–]\\s*not\\s+(?:a|an|the|just|merely|some)?\\s*\\w',
      '\\brather\\s+than\\b',
    ].join('|'),
    'gi'
  ),
  messageFor: (count, rate, budget) =>
    `${count} antithesis constructions, ${rate} per 1000 words (advisory budget ${budget}).`,
});

module.exports = [emDash, antithesis];
