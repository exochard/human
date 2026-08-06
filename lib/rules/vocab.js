'use strict';

const { lineOf } = require('../text');
const { makeResult, ratePer1000, MIN_WORDS_FOR_RATE } = require('./result');

/**
 * Frequency of words whose published usage spiked after 2022.
 *
 * The rule is language-agnostic. The caller loads the list for the document's
 * language and passes it in, which is what makes a second language additive
 * rather than a rewrite. Multi-word entries are supported, so the Italian list
 * can carry "di conseguenza" as one item.
 */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPattern(words) {
  if (!words || words.length === 0) return null;
  // Longest first, so "senza soluzione di continuita" wins over any prefix.
  const sorted = [...words].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`(?<![\\w'’-])(?:${sorted.join('|')})(?![\\w'’-])`, 'giu');
}

const rule = {
  id: 'vocab',
  confidence: 'strong',
  gates: true,
  describe:
    'Words whose published frequency jumped sharply after 2022 (arXiv:2406.07016, arXiv:2403.07183). Every one is a legitimate word; the rate is what carries the signal.',

  check(doc, config) {
    const budget = config.budget;
    const pattern = buildPattern(config.words);
    const hits = [];

    if (pattern) {
      let match;
      while ((match = pattern.exec(doc.prose)) !== null) {
        hits.push({ line: lineOf(doc.raw, match[0]), text: match[0] });
      }
    }

    const count = hits.length;
    const rate = ratePer1000(count, doc.words);
    const over = doc.words >= MIN_WORDS_FOR_RATE && rate > budget;
    const listed = [...new Set(hits.map((h) => h.text.toLowerCase()))].slice(0, 6).join(', ');

    return makeResult(rule, {
      count,
      rate,
      budget,
      over,
      hits: hits.slice(0, 3),
      message: count === 0
        ? `no dated vocabulary (budget ${budget} per 1000 words).`
        : `${count} dated words, ${rate} per 1000 words against a budget of ${budget}: ${listed}.`,
    });
  },
};

module.exports = rule;
