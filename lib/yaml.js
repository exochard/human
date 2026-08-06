'use strict';

/**
 * A YAML parser covering exactly the subset the rules/ files use, and no more.
 *
 * The plugin takes no runtime dependencies, so it carries its own parser. The
 * design rule that follows from that: anything outside the supported subset
 * throws with a line number rather than being guessed at. A rules file that
 * silently half-parses would disable checks without saying so, which is the
 * one failure mode a style gate must never have.
 *
 * Supported: comments, `key: value`, nested maps by space indent, `- scalar`
 * sequences, `- key: value` sequences of maps, quoted strings, integers,
 * floats, booleans, nulls, and inline scalar sequences `[a, b, c]`.
 *
 * Not supported, and each throws: block scalars (| >), anchors and aliases
 * (& *), flow mappings ({...}), multiple documents (---), tab indentation.
 */

function fail(lineNo, message) {
  throw new Error(`yaml:${lineNo}: ${message}`);
}

function tokenize(text) {
  const tokens = [];
  const lines = String(text).split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const lineNo = i + 1;
    if (raw.trim() === '' || raw.trim().startsWith('#')) continue;

    const leading = raw.match(/^[ \t]*/)[0];
    if (leading.includes('\t')) fail(lineNo, 'tab indentation is not supported; use spaces');

    const content = raw.trim();
    if (content === '---' || content === '...') {
      fail(lineNo, 'multiple documents are not supported');
    }
    if (/^-{3,}$/.test(content)) fail(lineNo, 'document markers are not supported');

    tokens.push({ indent: leading.length, content, lineNo });
  }
  return tokens;
}

function stripComment(value) {
  // A hash only opens a comment when it is unquoted and preceded by space.
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    const end = value.indexOf(quote, 1);
    if (end === -1) return value;
    const rest = value.slice(end + 1);
    const cut = rest.search(/\s#/);
    return value.slice(0, end + 1) + (cut === -1 ? rest : rest.slice(0, cut));
  }
  const cut = value.search(/\s#/);
  return cut === -1 ? value : value.slice(0, cut);
}

function parseInlineSequence(value, lineNo) {
  const inner = value.slice(1, -1).trim();
  if (inner === '') return [];
  const items = [];
  let current = '';
  let quote = null;

  for (const ch of inner) {
    if (quote) {
      if (ch === quote) quote = null;
      else current += ch;
      continue;
    }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === ',') { items.push(current.trim()); current = ''; continue; }
    if (ch === '[' || ch === '{') fail(lineNo, 'nested inline collections are not supported');
    current += ch;
  }
  if (quote) fail(lineNo, 'unterminated quoted string in inline sequence');
  items.push(current.trim());
  return items.map((item) => coerce(item, lineNo, true));
}

function coerce(value, lineNo, alreadyUnquoted) {
  const v = alreadyUnquoted ? value : stripComment(value).trim();

  if (v === '' || v === 'null' || v === '~') return null;
  if (v.startsWith('|') || v.startsWith('>')) {
    fail(lineNo, 'block scalars (| and >) are not supported');
  }
  if (v.startsWith('&') || v.startsWith('*')) {
    fail(lineNo, 'anchors and aliases are not supported');
  }
  if (v.startsWith('{')) fail(lineNo, 'flow mappings ({...}) are not supported; use an indented block');
  if (v.startsWith('[')) {
    if (!v.endsWith(']')) fail(lineNo, 'unterminated inline sequence');
    return parseInlineSequence(v, lineNo);
  }
  if ((v.startsWith('"') && v.endsWith('"') && v.length > 1) ||
      (v.startsWith("'") && v.endsWith("'") && v.length > 1)) {
    return v.slice(1, -1);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d*\.\d+$/.test(v)) return parseFloat(v);
  return v;
}

function isSequenceItem(content) {
  return content === '-' || content.startsWith('- ');
}

/** Split `key: value` when the colon is a real separator, not part of a string. */
function splitEntry(content, lineNo) {
  if (content.startsWith('"') || content.startsWith("'")) {
    const quote = content[0];
    const end = content.indexOf(quote, 1);
    if (end === -1) fail(lineNo, 'unterminated quoted key');
    const after = content.slice(end + 1);
    if (!after.startsWith(':')) return null;
    return { key: content.slice(1, end), value: after.slice(1).trim() };
  }
  const match = content.match(/^([^:]+):(?:\s+(.*))?$/);
  if (!match) return null;
  return { key: match[1].trim(), value: (match[2] || '').trim() };
}

function parseBlock(tokens, cursor, indent) {
  if (cursor.i >= tokens.length) return null;
  return isSequenceItem(tokens[cursor.i].content)
    ? parseSequence(tokens, cursor, indent)
    : parseMapping(tokens, cursor, indent);
}

function parseSequence(tokens, cursor, indent) {
  const out = [];

  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];
    if (token.indent !== indent || !isSequenceItem(token.content)) break;

    const rest = token.content === '-' ? '' : token.content.slice(2).trim();
    cursor.i += 1;

    if (rest === '') {
      const next = tokens[cursor.i];
      if (next && next.indent > indent) out.push(parseBlock(tokens, cursor, next.indent));
      else out.push(null);
      continue;
    }

    const entry = splitEntry(rest, token.lineNo);
    if (entry) {
      // A map that begins on the dash line. Rebuild it as a standalone token
      // list: the inline entry plus every following line indented past the dash.
      const childIndent = indent + 2;
      const synthetic = [{ indent: childIndent, content: rest, lineNo: token.lineNo }];
      while (cursor.i < tokens.length && tokens[cursor.i].indent > indent) {
        synthetic.push({ ...tokens[cursor.i], indent: childIndent });
        cursor.i += 1;
      }
      const inner = { i: 0 };
      out.push(parseMapping(synthetic, inner, childIndent));
      continue;
    }

    out.push(coerce(rest, token.lineNo));
  }

  return out;
}

function parseMapping(tokens, cursor, indent) {
  const out = {};

  while (cursor.i < tokens.length) {
    const token = tokens[cursor.i];
    if (token.indent !== indent) {
      if (token.indent < indent) break;
      fail(token.lineNo, `unexpected indentation (expected ${indent} spaces, saw ${token.indent})`);
    }
    if (isSequenceItem(token.content)) break;

    const entry = splitEntry(token.content, token.lineNo);
    if (!entry) fail(token.lineNo, `expected "key: value", saw ${JSON.stringify(token.content)}`);
    cursor.i += 1;

    if (entry.value === '') {
      const next = tokens[cursor.i];
      if (next && next.indent > indent) out[entry.key] = parseBlock(tokens, cursor, next.indent);
      else if (next && next.indent === indent && isSequenceItem(next.content)) {
        out[entry.key] = parseSequence(tokens, cursor, indent);
      } else out[entry.key] = null;
    } else {
      out[entry.key] = coerce(entry.value, token.lineNo);
    }
  }

  return out;
}

function parseYaml(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return {};
  const cursor = { i: 0 };
  const value = parseBlock(tokens, cursor, tokens[0].indent);
  if (cursor.i < tokens.length) {
    fail(tokens[cursor.i].lineNo, 'trailing content could not be parsed');
  }
  return value;
}

module.exports = { parseYaml };
