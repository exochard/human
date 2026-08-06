'use strict';

/**
 * Turning a markdown document into the prose a style rule should actually
 * measure.
 *
 * Order matters here. Fenced code goes first, so that a `#` on a shell line is
 * never read as a heading and a semicolon-heavy source file never lands in the
 * sentence-length statistics. Everything downstream assumes code is gone.
 */

const ABBREVIATIONS = ['e.g', 'i.e', 'etc', 'vs', 'cf', 'al', 'Dr', 'Mr', 'Mrs', 'Ms', 'No', 'Fig', 'approx'];

/** Split YAML frontmatter from the body. Only a delimiter on line 1 counts. */
function stripFrontmatter(md) {
  const text = String(md);
  if (!text.startsWith('---\n') && !text.startsWith('---\r\n')) {
    return { frontmatter: null, body: text };
  }
  const rest = text.slice(text.indexOf('\n') + 1);
  const close = rest.search(/^---\s*$/m);
  if (close === -1) return { frontmatter: null, body: text };
  const frontmatter = rest.slice(0, close);
  const after = rest.slice(close);
  return { frontmatter, body: after.slice(after.indexOf('\n') + 1) };
}

/**
 * Regions fenced off from checking.
 *
 * Any document that teaches a style has to quote the style it argues against,
 * and those quotations would otherwise fail the very rules they illustrate.
 * The fence is deliberately verbose to write, so reaching for it stays a
 * decision rather than a reflex.
 */
const OFF_FENCE = /<!--\s*human:off\s*-->[\s\S]*?(?:<!--\s*human:on\s*-->|$)/g;

function extractProse(md) {
  let text = stripFrontmatter(md).body;

  // Fenced-off regions go before anything else, so a counter-example inside
  // one is never measured no matter what it contains.
  text = text.replace(OFF_FENCE, '\n');

  // Fenced code first, replaced by blank lines so line-oriented rules that
  // still look at the raw text keep roughly the right offsets.
  text = text.replace(/^[ \t]*(```|~~~)[\s\S]*?^[ \t]*\1[ \t]*$/gm, '\n');
  // An unterminated fence swallows the rest of the document, which is what a
  // markdown renderer does too.
  text = text.replace(/^[ \t]*(```|~~~)[\s\S]*$/m, '\n');

  text = text.replace(/<!--[\s\S]*?-->/g, ' ');
  text = text.replace(/`[^`\n]*`/g, ' ');
  text = text.replace(/^ {4,}\S.*$/gm, ' '); // indented code blocks

  // Images before links, since the image syntax contains the link syntax.
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  text = text.replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  text = text.replace(/^\s*\[[^\]]+\]:\s*\S+.*$/gm, ' '); // link reference definitions
  text = text.replace(/<https?:\/\/[^>]+>/g, ' ');
  text = text.replace(/https?:\/\/\S+/g, ' ');

  text = text.replace(/^\s*\|.*\|\s*$/gm, ' '); // table rows
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, ' '); // horizontal rules
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, ''); // heading markers, text kept
  text = text.replace(/^\s{0,3}>\s?/gm, ''); // block quote markers
  text = text.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, ''); // list markers
  text = text.replace(/\*\*([^*]*)\*\*/g, '$1');
  text = text.replace(/(^|\W)[*_]([^*_\n]+)[*_](?=\W|$)/g, '$1$2');
  text = text.replace(/~~([^~]*)~~/g, '$1');
  text = text.replace(/<\/?[a-zA-Z][^>]*>/g, ' '); // inline HTML tags

  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}

function splitSentences(prose) {
  const text = String(prose).replace(/\s+/g, ' ').trim();
  if (text === '') return [];

  // Mask the dots that do not end a sentence with a NUL, split on what is
  // left, then restore. NUL cannot occur in the source markdown, so it is a
  // safe placeholder.
  const DOT = String.fromCharCode(0);
  let masked = text;
  for (const abbr of ABBREVIATIONS) {
    masked = masked.replace(new RegExp(`\\b${abbr.replace(/\./g, '\\.')}\\.`, 'g'), abbr + DOT);
  }
  masked = masked.replace(/(\d)\.(\d)/g, `$1${DOT}$2`);

  return masked
    .split(/(?<=[.!?])["')\]]*\s+(?=["'(\[]*[A-Z0-9])/)
    .map((s) => s.split(DOT).join('.').trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 3);
}

function wordCount(text) {
  return String(text).split(/\s+/).filter(Boolean).length;
}

/** 1-indexed line of the first occurrence of `excerpt`, or 0 when absent. */
function lineOf(raw, excerpt) {
  if (!excerpt) return 0;
  const idx = String(raw).indexOf(excerpt);
  if (idx === -1) return 0;
  return String(raw).slice(0, idx).split('\n').length;
}

module.exports = { stripFrontmatter, extractProse, splitSentences, wordCount, lineOf };
