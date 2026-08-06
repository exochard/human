'use strict';

const { lineOf } = require('../text');
const { makeResult, ratePer1000, MIN_WORDS_FOR_RATE } = require('./result');

/**
 * A tricolon here is a three-item series closed by a conjunction: "A, B, and C".
 *
 * Items are capped at four words each. That cap is what keeps the match on real
 * series and off a long subordinate clause that happens to carry two commas,
 * which is the obvious false positive.
 */
const ITEM = "[\\w'’-]+(?:\\s+[\\w'’-]+){0,3}";

// The inner group is greedy on purpose: it swallows the whole series so the
// item count can be checked afterwards. A four-item list is not a tricolon,
// and matching only its last three would count the one shape that is evidence
// of nothing. Threeness is the entire claim.
const SERIES = new RegExp(`\\b${ITEM}(?:,\\s+${ITEM})+,\\s+(?:and|or)\\s+${ITEM}`, 'gi');

// Words that make a comma a clause boundary rather than a list separator.
const CLAUSE_MARKER = /\b(?:which|who|whom|whose|that|because|although|though|while|when|where|since|unless|if)\b/i;

const rule = {
  id: 'tricolon',
  confidence: 'strong',
  gates: true,
  describe:
    'Parallel three-item series. LLM prose averages 7.13 per document against 3.73 for human expert prose (arXiv:2604.19768). This is a budget, not a ban: the third one in a page is the problem, not the first.',

  check(doc, config) {
    const budget = config.budget;
    const hits = [];

    SERIES.lastIndex = 0;
    let match;
    while ((match = SERIES.exec(doc.prose)) !== null) {
      const text = match[0];
      if (CLAUSE_MARKER.test(text)) continue;
      // Two commas means three items. More means a longer list, which carries
      // none of the rhetorical weight this rule is about.
      if ((text.match(/,/g) || []).length !== 2) continue;
      hits.push({ line: lineOf(doc.raw, text), text });
    }

    const count = hits.length;
    const rate = ratePer1000(count, doc.words);
    const over = doc.words >= MIN_WORDS_FOR_RATE && rate > budget;

    return makeResult(rule, {
      count,
      rate,
      budget,
      over,
      hits: hits.slice(0, 3),
      message: over
        ? `${count} three-item series, ${rate} per 1000 words against a budget of ${budget}.`
        : `${count} three-item series (${rate} per 1000 words, budget ${budget}).`,
    });
  },
};

module.exports = rule;
