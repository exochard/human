'use strict';

const { extractProse, splitSentences, wordCount } = require('../../lib/text');

/** Build the doc shape every rule consumes, from raw markdown. */
function makeDoc(md, path) {
  const prose = extractProse(md);
  return {
    path: path || 'fixture.md',
    raw: md,
    prose,
    sentences: splitSentences(prose),
    words: wordCount(prose),
  };
}

module.exports = { makeDoc };
