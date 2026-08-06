'use strict';

const { makeResult, round2 } = require('./result');

/**
 * Variation in sentence length, as the coefficient of variation (stdev over
 * mean). Human prose swings; generated prose tends toward a uniform length.
 *
 * This is the one rule that fails BELOW its threshold. It keeps the `over`
 * field name anyway so the scanner can tally failures without special-casing
 * it, and the message says "below floor" so a reader is never misled.
 *
 * The floor is calibrated on this repo's fixture corpus, not taken from the
 * literature, which reports a direction rather than a number. See benchmark/.
 */

const rule = {
  id: 'burstiness',
  confidence: 'moderate',
  gates: true,
  describe:
    'Coefficient of variation of sentence length. Generated prose clusters around one length; human prose swings (arXiv:2308.09067). Fails below the floor, not above it.',

  check(doc, config) {
    const floor = config.floor;
    const minSentences = config.minSentences || 8;
    const lengths = doc.sentences.map((s) => s.split(/\s+/).filter(Boolean).length);

    if (lengths.length < minSentences) {
      return makeResult(rule, {
        count: lengths.length,
        rate: 0,
        budget: floor,
        over: false,
        message: `${lengths.length} sentences, below the ${minSentences} needed to measure variation.`,
      });
    }

    const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
    const cv = mean > 0 ? round2(Math.sqrt(variance) / mean) : 0;
    const over = cv < floor;

    // The sentences nearest the mean are the ones a writer needs to see: they
    // are what is flattening the rhythm.
    const hits = doc.sentences
      .map((text, i) => ({ text, delta: Math.abs(lengths[i] - mean) }))
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 3)
      .map((h) => ({ line: 0, text: h.text.slice(0, 70) }));

    return makeResult(rule, {
      count: lengths.length,
      rate: cv,
      budget: floor,
      over,
      hits: over ? hits : [],
      message: over
        ? `sentence-length variation ${cv} is below the floor of ${floor} across ${lengths.length} sentences (mean ${round2(mean)} words).`
        : `sentence-length variation ${cv} clears the floor of ${floor}.`,
    });
  },
};

module.exports = rule;
