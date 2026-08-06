# human Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Claude Code plugin that enforces a published prose style budget on the markdown and git text an agent writes, using deterministic scripts with zero model calls in any hook path.

**Architecture:** Two rule layers. Invariants (four evidence-backed budgets) inject once at session start and are checked on every prose write. Register rules are artifact-scoped, routed by a YAML table with a model-side override rubric, and load lazily only when a check fails. A hand-rolled YAML subset parser keeps the package dependency-free.

**Tech Stack:** Node ≥18, CommonJS, zero runtime dependencies. Self-contained test runner in the style of the sibling `handoff` plugin (each `*.test.js` is its own process, exits 0 or 1).

## Global Constraints

- Node `>=18`. CommonJS (`require`, `'use strict'`). No `import`.
- **Zero runtime dependencies.** No npm packages in `dependencies` or `devDependencies`.
- **No model calls anywhere in `lib/` or `hooks/`.** Asserted by a test.
- Every file under 500 lines.
- YAML is for script-read data (`rules/**`). Markdown is for model-read guidance (`registers/**`, `SKILL.md`).
- Every rule carries a `confidence` field: `strong`, `moderate`, or `weak`. Rules with confidence `weak` never gate.
- Demoted signals (`em-dash`, `antithesis`) are advisory only and must never contribute to a failing exit code.
- Plugin name `human`. Author `clochard04 <peppecastellos245@icloud.com>`. License MIT.
- Repo root is `/home/peppe/Projects/Plugins/exoClaude/human`, its own git repo (already `git init`ed).
- Never add a `Co-Authored-By` trailer to commits.

---

### Task 1: Repo scaffold and test runner

**Files:**
- Create: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `LICENSE`, `.gitignore`
- Create: `tests/run-all.js`
- Test: `tests/scaffold.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs every `tests/**/*.test.js` (excluding `tests/helpers/`) as its own child process and aggregates exit codes.

- [ ] **Step 1: Write the failing test**

`tests/scaffold.test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

test('plugin.json declares name human and MIT license', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/plugin.json'), 'utf8'));
  assert.strictEqual(p.name, 'human');
  assert.strictEqual(p.license, 'MIT');
});

test('package.json has zero dependencies', () => {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.deepStrictEqual(p.dependencies || {}, {});
  assert.deepStrictEqual(p.devDependencies || {}, {});
});

test('marketplace.json lists the human plugin at ./', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin/marketplace.json'), 'utf8'));
  const entry = m.plugins.find((x) => x.name === 'human');
  assert.ok(entry, 'human entry present');
  assert.strictEqual(entry.source, './');
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/scaffold.test.js`
Expected: FAIL, `ENOENT` on `.claude-plugin/plugin.json`.

- [ ] **Step 3: Create the scaffold files**

`package.json`:

```json
{
  "name": "human",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "test": "node tests/run-all.js",
    "benchmark": "node benchmark/run-benchmark.js",
    "check": "node bin/human.js"
  },
  "engines": { "node": ">=18" }
}
```

`.claude-plugin/plugin.json`:

```json
{
  "name": "human",
  "version": "0.1.0",
  "description": "Enforces a published prose style budget on the markdown and git text an agent writes. Deterministic checks, zero model calls in the hook path, per-artifact register routing, and a stated confidence level on every rule.",
  "author": { "name": "clochard04", "email": "peppecastellos245@icloud.com" },
  "license": "MIT",
  "keywords": ["claude-code", "prose", "style", "writing", "linter", "mechanical", "ai-tells", "readme", "commit-message"],
  "commands": ["./commands/"]
}
```

`.claude-plugin/marketplace.json` mirrors the `handoff` shape with one plugin entry named `human`, `"source": "./"`, `"category": "workflow"`, same version and keywords.

`.gitignore`: `node_modules/`, `.human/`, `*.log`.

`LICENSE`: MIT, copyright 2026 clochard04.

`tests/run-all.js`: copy the structure from `../handoff/tests/run-all.js` — walk `tests/`, skip `tests/helpers/`, `spawnSync('node', [file])` each `*.test.js`, print a summary, exit non-zero if any child did.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS, 1 file, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: scaffold human plugin with zero-dep test runner"
```

---

### Task 2: YAML subset parser

The rules live in YAML and the package takes no dependencies, so it needs its own parser. It supports exactly the subset the rule files use and throws with a line number on anything else, rather than guessing.

**Files:**
- Create: `lib/yaml.js`
- Test: `tests/lib/yaml.test.js`

**Interfaces:**
- Produces: `parseYaml(text) -> object`. Throws `Error` whose message starts with `yaml:<line>:` on unsupported syntax.
- Supported: `#` comments, `key: value`, nested maps by two-space indent, `- scalar` lists, `- key: value` lists of maps, single- and double-quoted strings, integers, floats, `true`/`false`/`null`, and empty values meaning `null`.
- Unsupported and must throw: block scalars (`|`, `>`), anchors (`&`, `*`), flow collections (`{`, `[` at value position), tabs for indentation.

- [ ] **Step 1: Write the failing test**

`tests/lib/yaml.test.js`:

```js
'use strict';
const assert = require('assert');
const { parseYaml } = require('../../lib/yaml');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

test('parses scalars and types', () => {
  const r = parseYaml('name: tricolon\nbudget: 4.0\ncount: 3\nenabled: true\nnote:\n');
  assert.strictEqual(r.name, 'tricolon');
  assert.strictEqual(r.budget, 4);
  assert.strictEqual(r.count, 3);
  assert.strictEqual(r.enabled, true);
  assert.strictEqual(r.note, null);
});

test('strips comments and blank lines', () => {
  const r = parseYaml('# leading\nname: x   # trailing\n\n');
  assert.strictEqual(r.name, 'x');
});

test('parses nested maps by indent', () => {
  const r = parseYaml('rules:\n  tricolon:\n    budget: 4.0\n    confidence: strong\n');
  assert.strictEqual(r.rules.tricolon.budget, 4);
  assert.strictEqual(r.rules.tricolon.confidence, 'strong');
});

test('parses scalar lists', () => {
  const r = parseYaml('words:\n  - delve\n  - realm\n  - "not: a map"\n');
  assert.deepStrictEqual(r.words, ['delve', 'realm', 'not: a map']);
});

test('parses lists of maps', () => {
  const r = parseYaml('routes:\n  - match: "README.md"\n    register: readme\n  - match: "docs/**"\n    register: technical-doc\n');
  assert.strictEqual(r.routes.length, 2);
  assert.strictEqual(r.routes[1].register, 'technical-doc');
});

test('throws with line number on block scalar', () => {
  assert.throws(() => parseYaml('a: 1\ntext: |\n  hello\n'), /^Error: yaml:2:/);
});

test('throws on tab indentation', () => {
  assert.throws(() => parseYaml('a:\n\tb: 1\n'), /^Error: yaml:2:/);
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/yaml.test.js`
Expected: FAIL, `Cannot find module '../../lib/yaml'`.

- [ ] **Step 3: Implement `lib/yaml.js`**

Line-based recursive parser. Tokenise every non-blank, non-comment line into `{ indent, raw, lineNo }`, rejecting tabs. Parse a block at a given indent: if the first line starts with `- ` it is a sequence, otherwise a mapping. For `key:` with an empty value, look ahead — a deeper indent means a nested block, otherwise `null`. Scalar coercion order: quoted string, `true`/`false`/`null`, integer, float, bare string. Strip a trailing ` #` comment only when unquoted.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/yaml.test.js`
Expected: PASS, 7 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/yaml.js tests/lib/yaml.test.js && git commit -m "feat: add zero-dep YAML subset parser that fails loudly on unsupported syntax"
```

---

### Task 3: Prose extraction and sentence splitting

Rules must measure prose, not code. A README full of shell blocks would otherwise score as one enormous run-on sentence.

**Files:**
- Create: `lib/text.js`
- Test: `tests/lib/text.test.js`

**Interfaces:**
- Produces:
  - `stripFrontmatter(md) -> { frontmatter: string|null, body: string }`
  - `extractProse(md) -> string` — removes YAML frontmatter, fenced code, inline code, HTML comments, link targets (keeps link text), and markdown table rows. Heading text is kept.
  - `splitSentences(prose) -> string[]` — splits on `.`, `!`, `?` followed by whitespace and an uppercase letter or digit. Does not split on a known abbreviation (`e.g.`, `i.e.`, `etc.`, `vs.`, `cf.`, `Dr.`, `Mr.`, `Ms.`, `No.`) or on a decimal point. Drops fragments under three words.
  - `wordCount(text) -> number`
  - `lineOf(raw, excerpt) -> number` — 1-indexed line of the first occurrence, or `0` when absent.

- [ ] **Step 1: Write the failing test**

`tests/lib/text.test.js`:

```js
'use strict';
const assert = require('assert');
const { stripFrontmatter, extractProse, splitSentences, wordCount, lineOf } = require('../../lib/text');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

test('strips frontmatter', () => {
  const r = stripFrontmatter('---\ntitle: x\n---\nBody here.\n');
  assert.strictEqual(r.frontmatter.trim(), 'title: x');
  assert.strictEqual(r.body.trim(), 'Body here.');
});

test('extractProse removes fenced code', () => {
  const p = extractProse('Real prose here.\n\n```js\nconst x = 1;\n```\n\nMore prose.\n');
  assert.ok(!p.includes('const x'));
  assert.ok(p.includes('Real prose here.'));
  assert.ok(p.includes('More prose.'));
});

test('extractProse removes inline code but keeps link text', () => {
  const p = extractProse('Use `npm test` and see [the docs](https://example.com/x).');
  assert.ok(!p.includes('npm test'));
  assert.ok(!p.includes('example.com'));
  assert.ok(p.includes('the docs'));
});

test('extractProse keeps heading text', () => {
  assert.ok(extractProse('## Getting started\n').includes('Getting started'));
});

test('splitSentences handles abbreviations and decimals', () => {
  const s = splitSentences('The rate is 7.13 per doc. That beats e.g. the human baseline. Done.');
  assert.strictEqual(s.length, 3);
});

test('splitSentences drops fragments under three words', () => {
  assert.deepStrictEqual(splitSentences('Ok. This one is long enough to count.').length, 1);
});

test('wordCount counts words not characters', () => {
  assert.strictEqual(wordCount('one two three'), 3);
});

test('lineOf finds the 1-indexed line', () => {
  assert.strictEqual(lineOf('alpha\nbeta\ngamma', 'beta'), 2);
  assert.strictEqual(lineOf('alpha', 'zzz'), 0);
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/text.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/text.js`**

Replace fenced blocks with a blank line before anything else, so a `#` inside a code block is never read as a heading. Then inline code, HTML comments, image and link syntax (keeping the text), leading list markers and heading hashes, emphasis markers, and table rows (a line whose trimmed form starts and ends with `|`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/text.test.js`
Expected: PASS, 8 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/text.js tests/lib/text.test.js && git commit -m "feat: extract prose from markdown and split sentences"
```

---

### Task 4: Rule contract and the tricolon rule

Every rule shares one shape so `check.js` can run them uniformly.

**Files:**
- Create: `lib/rules/tricolon.js`
- Test: `tests/rules/tricolon.test.js`

**Interfaces:**
- A **rule module** exports `{ id, confidence, gates, describe, check }`.
  - `id: string`, `confidence: 'strong'|'moderate'|'weak'`, `gates: boolean` (may a failure cause a non-zero exit).
  - `check(doc, config) -> RuleResult`
- A **doc** is `{ path, raw, prose, sentences, words }` where `words` is a number.
- A **RuleResult** is `{ id, confidence, gates, count, rate, budget, over: boolean, hits: [{ line, text }], message }`. `rate` is per 1000 words, rounded to two decimals.
- `config` for this rule is `{ budget: number }` from `rules/invariants.yml`.

- [ ] **Step 1: Write the failing test**

`tests/rules/tricolon.test.js`:

```js
'use strict';
const assert = require('assert');
const rule = require('../../lib/rules/tricolon');
const { extractProse, splitSentences, wordCount } = require('../../lib/text');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

function doc(md) {
  const prose = extractProse(md);
  return { path: 'x.md', raw: md, prose, sentences: splitSentences(prose), words: wordCount(prose) };
}

test('rule declares its contract', () => {
  assert.strictEqual(rule.id, 'tricolon');
  assert.strictEqual(rule.confidence, 'strong');
  assert.strictEqual(rule.gates, true);
});

test('detects a three-item series with terminal conjunction', () => {
  const r = rule.check(doc('It is fast, cheap, and reliable in every case tested here today.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
  assert.ok(r.hits[0].text.includes('cheap'));
});

test('detects a multi-word triad', () => {
  const r = rule.check(doc('We ship the parser, the linter, and the formatter together in one package.'), { budget: 4 });
  assert.strictEqual(r.count, 1);
});

test('does not fire on a two-item pair', () => {
  const r = rule.check(doc('It is fast and cheap, which is all that this particular project ever needed.'), { budget: 4 });
  assert.strictEqual(r.count, 0);
});

test('reports rate per 1000 words and flags over budget', () => {
  const body = 'It is fast, cheap, and reliable. ' + 'word '.repeat(90);
  const r = rule.check(doc(body), { budget: 4 });
  assert.ok(r.rate > 4, `rate ${r.rate} should exceed budget on a short doc`);
  assert.strictEqual(r.over, true);
});

test('under budget on a long clean document', () => {
  const r = rule.check(doc('word '.repeat(2000)), { budget: 4 });
  assert.strictEqual(r.over, false);
  assert.strictEqual(r.count, 0);
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/rules/tricolon.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/rules/tricolon.js`**

```js
'use strict';

// A tricolon here is a three-item series closed by a conjunction: "A, B, and C".
// Each item is 1-4 words, which keeps the match on real series and off long
// subordinate clauses that happen to carry two commas.
const ITEM = "[\\w'’-]+(?:\\s+[\\w'’-]+){0,3}";
const SERIES = new RegExp(`\\b${ITEM},\\s+${ITEM},\\s+(?:and|or)\\s+${ITEM}`, 'gi');

module.exports = {
  id: 'tricolon',
  confidence: 'strong',
  gates: true,
  describe: 'Parallel three-item series. LLM prose averages 7.13 per document against 3.73 for human expert prose (arXiv:2604.19768).',
  check(doc, config) { /* match SERIES over doc.prose, map to hits via lineOf, compute rate */ },
};
```

`rate = words > 0 ? round(count * 1000 / words, 2) : 0`. `over = words >= 150 && rate > budget` — below 150 words the rate is too noisy to gate on, which is stated in the message.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/rules/tricolon.test.js`
Expected: PASS, 6 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/tricolon.js tests/rules/tricolon.test.js && git commit -m "feat: add tricolon rate rule"
```

---

### Task 5: Vocabulary rule and the en/it word lists

**Files:**
- Create: `lib/rules/vocab.js`, `rules/vocab/en.yml`, `rules/vocab/it.yml`
- Test: `tests/rules/vocab.test.js`

**Interfaces:**
- `check(doc, config)` where `config` is `{ budget: number, words: string[] }`. The caller loads the list for the document's language and passes it in; the rule itself is language-agnostic.
- Matching is case-insensitive, whole-word, and stem-aware for the listed forms only — the YAML lists each surface form explicitly rather than inferring morphology.

- [ ] **Step 1: Write the failing test**

`tests/rules/vocab.test.js`:

```js
'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const rule = require('../../lib/rules/vocab');
const { parseYaml } = require('../../lib/yaml');
const { extractProse, splitSentences, wordCount } = require('../../lib/text');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

function doc(md) {
  const prose = extractProse(md);
  return { path: 'x.md', raw: md, prose, sentences: splitSentences(prose), words: wordCount(prose) };
}

const EN = parseYaml(fs.readFileSync(path.join(__dirname, '../../rules/vocab/en.yml'), 'utf8'));

test('en list contains the documented spike words', () => {
  for (const w of ['delve', 'seamless', 'robust', 'leverage', 'comprehensive']) {
    assert.ok(EN.words.includes(w), `${w} present in en.yml`);
  }
});

test('en list carries a source URL', () => {
  assert.ok(/^https?:\/\//.test(EN.source), 'source is a URL');
});

test('matches whole words only', () => {
  const r = rule.check(doc('The robustness of the harness was never in question at all.'), { budget: 2, words: ['robust', 'harness'] });
  assert.strictEqual(r.count, 1);
  assert.strictEqual(r.hits[0].text.toLowerCase(), 'harness');
});

test('is case-insensitive', () => {
  const r = rule.check(doc('Delve into this at some length before you commit to anything.'), { budget: 2, words: ['delve'] });
  assert.strictEqual(r.count, 1);
});

test('ignores words inside code fences', () => {
  const r = rule.check(doc('Clean prose here for the reader.\n\n```js\nconst robust = 1;\n```\n'), { budget: 2, words: ['robust'] });
  assert.strictEqual(r.count, 0);
});

test('it list exists and is non-empty', () => {
  const IT = parseYaml(fs.readFileSync(path.join(__dirname, '../../rules/vocab/it.yml'), 'utf8'));
  assert.ok(IT.words.length > 5);
  assert.ok(IT.words.includes('inoltre'));
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/rules/vocab.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the rule and both word lists**

`rules/vocab/en.yml`:

```yaml
language: en
confidence: strong
source: "https://arxiv.org/abs/2406.07016"
note: "Words whose published frequency jumped sharply after 2022. Kobak et al. measured the shift in PubMed abstracts; Liang et al. measured 9.8x to 34.7x jumps for specific adjectives in ICLR peer reviews. Presence is not proof of anything. Rate against a budget is the signal."
words:
  - delve
  - delves
  - delving
  - intricate
  - intricacies
  - showcase
  - showcasing
  - underscore
  - underscores
  - pivotal
  - realm
  - meticulous
  - meticulously
  - commendable
  - garner
  - garnered
  - encompass
  - encompasses
  - seamless
  - seamlessly
  - robust
  - comprehensive
  - leverage
  - leveraging
  - utilize
  - utilizing
  - foster
  - fostering
  - landscape
  - tapestry
  - myriad
  - unlock
  - unlocking
  - elevate
  - empower
  - empowering
  - transformative
  - holistic
  - streamline
  - streamlining
  - harness
  - harnessing
  - testament
  - crucial
  - cutting-edge
```

`rules/vocab/it.yml` uses the same schema, `language: it`, `confidence: moderate`, and a `note` stating plainly that no published corpus study of Italian LLM output exists, so the list is authored from the connectives and registers that machine-translated and model-generated Italian over-reaches for: `inoltre`, `pertanto`, `dunque`, `altresì`, `di conseguenza`, `in conclusione`, `fondamentale`, `nel panorama`, `in tal senso`, `approfondire`, `robusto`, `senza soluzione di continuità`, `sfruttare`, `all'avanguardia`.

`lib/rules/vocab.js` builds one alternation regex from the escaped words, wrapped in `\b…\b`, and runs it over `doc.prose`. Because `doc.prose` already has code stripped, the code-fence case passes for free.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/rules/vocab.test.js`
Expected: PASS, 6 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/vocab.js rules/vocab tests/rules/vocab.test.js && git commit -m "feat: add dated-vocabulary rule with sourced en and it word lists"
```

---

### Task 6: Burstiness and unbacked-adjective rules

Grouped because both read `doc.sentences` and neither is large enough to carry its own review gate.

**Files:**
- Create: `lib/rules/burstiness.js`, `lib/rules/unbacked.js`
- Test: `tests/rules/burstiness.test.js`, `tests/rules/unbacked.test.js`

**Interfaces:**
- `burstiness.check(doc, config)` with `config = { floor: number, minSentences: number }`. Reports `rate` as the coefficient of variation of sentence length (stdev ÷ mean, two decimals). `over` is true when `doc.sentences.length >= minSentences && rate < floor` — this rule fails *below* its threshold, the inverse of the others, so the field is still named `over` for a uniform contract and the message says "below floor".
- `unbacked.check(doc, config)` with `config = { budget: number, adjectives: string[] }`. Flags a listed adjective in a sentence containing no digit. Confidence `weak`, `gates: false`.

- [ ] **Step 1: Write the failing tests**

`tests/rules/burstiness.test.js`:

```js
'use strict';
const assert = require('assert');
const rule = require('../../lib/rules/burstiness');
const { extractProse, splitSentences, wordCount } = require('../../lib/text');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}
function doc(md) {
  const prose = extractProse(md);
  return { path: 'x.md', raw: md, prose, sentences: splitSentences(prose), words: wordCount(prose) };
}

const FLAT = Array.from({ length: 10 }, () => 'This sentence carries exactly eight words here.').join(' ');
const BURSTY = [
  'It broke.',
  'The parser had been reading the frontmatter delimiter as a horizontal rule for three weeks before anybody noticed the headings were vanishing.',
  'Nobody noticed because the tests only ever fed it bodies without frontmatter.',
  'That was the bug.',
  'Adding one fixture with frontmatter turned the whole suite red immediately.',
  'Good.',
].join(' ');

test('rule declares its contract', () => {
  assert.strictEqual(rule.id, 'burstiness');
  assert.strictEqual(rule.confidence, 'moderate');
  assert.strictEqual(rule.gates, true);
});

test('flags uniform sentence length as below floor', () => {
  const r = rule.check(doc(FLAT), { floor: 0.35, minSentences: 5 });
  assert.strictEqual(r.over, true, `cv ${r.rate} should be below floor`);
});

test('passes varied sentence length', () => {
  const r = rule.check(doc(BURSTY), { floor: 0.35, minSentences: 5 });
  assert.strictEqual(r.over, false, `cv ${r.rate} should clear floor`);
});

test('never fires below minSentences', () => {
  const r = rule.check(doc('One short line here. Another short line here.'), { floor: 0.35, minSentences: 5 });
  assert.strictEqual(r.over, false);
});

process.exit(failures === 0 ? 0 : 1);
```

`tests/rules/unbacked.test.js` asserts: `gates` is `false` and `confidence` is `weak`; `'The parser is blazing fast in every benchmark we ran.'` produces one hit; `'The parser runs in 3 ms, which is blazing fast.'` produces none because the sentence carries a digit; and the rule reports a rate per 1000 words.

- [ ] **Step 2: Run them to verify they fail**

Run: `node tests/rules/burstiness.test.js && node tests/rules/unbacked.test.js`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement both rules**

`burstiness.js` computes mean and population standard deviation over sentence word counts, `rate = stdev / mean`. Hits are the three sentences closest to the mean, which is what a writer needs to see to fix the problem.

`unbacked.js` iterates `doc.sentences`, and for each sentence testing positive on the adjective alternation and negative on `/\d/`, records the matched adjective and its line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/rules/burstiness.test.js && node tests/rules/unbacked.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/burstiness.js lib/rules/unbacked.js tests/rules/ && git commit -m "feat: add burstiness floor and unbacked-adjective rules"
```

---

### Task 7: Demoted signals

Reported, never gating. Their existence in the codebase with `gates: false` is the design's honesty claim made executable.

**Files:**
- Create: `lib/rules/demoted.js`
- Test: `tests/rules/demoted.test.js`

**Interfaces:**
- Exports an array of two rule modules, `[emDash, antithesis]`, both `confidence: 'weak'`, both `gates: false`.
- `emDash` counts `—` per 1000 words against `config.budget`.
- `antithesis` counts trailing-negation and explicit `not X, it's Y` constructions against `config.budget`.

- [ ] **Step 1: Write the failing test**

`tests/rules/demoted.test.js`:

```js
'use strict';
const assert = require('assert');
const rules = require('../../lib/rules/demoted');

let failures = 0;
function test(name, fn) {
  try { fn(); console.log(`  ok - ${name}`); }
  catch (e) { failures++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

test('exports exactly two rules', () => assert.strictEqual(rules.length, 2));

test('every demoted rule is weak and non-gating', () => {
  for (const r of rules) {
    assert.strictEqual(r.confidence, 'weak', `${r.id} confidence`);
    assert.strictEqual(r.gates, false, `${r.id} must never gate`);
  }
});

test('every demoted rule explains why it is demoted', () => {
  for (const r of rules) assert.ok(r.describe.length > 40, `${r.id} describe`);
});

process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/rules/demoted.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/rules/demoted.js`**

Each `describe` states the reason for demotion in one sentence: the em-dash rate is a GPT-4o-era training artifact whose direction reversed across model families, and the antithesis construction has no controlled frequency study behind it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/rules/demoted.test.js`
Expected: PASS, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/rules/demoted.js tests/rules/demoted.test.js && git commit -m "feat: add em-dash and antithesis as explicitly non-gating advisory signals"
```

---

### Task 8: invariants.yml and the invariants runner

**Files:**
- Create: `rules/invariants.yml`, `lib/invariants.js`
- Test: `tests/lib/invariants.test.js`

**Interfaces:**
- `loadInvariants(rootDir) -> { rules: object, meta: object }` reads and parses `rules/invariants.yml`.
- `runInvariants(doc, invariants, lang) -> RuleResult[]` runs the four gating rules plus both demoted rules, in that order, passing each its config slice and the vocabulary list for `lang`.
- Graceful degradation: an unreadable or unparseable `invariants.yml` throws an `Error` whose message names the file and the parse position. Callers catch it and report; nothing silently passes.

- [ ] **Step 1: Write the failing test**

Assert that `rules/invariants.yml` has an entry for every rule id, that each entry carries `budget` (or `floor`), `confidence`, and `source`; that `runInvariants` returns six results in a stable order; that no gating rule has confidence `weak`; and that `loadInvariants` on a directory with no rules file throws a message containing `invariants.yml`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/invariants.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `rules/invariants.yml` and `lib/invariants.js`**

```yaml
version: 1
note: "Budgets are rates per 1000 words unless stated. Every rule carries a confidence level and a source. Rules with confidence weak never gate; they are reported so a writer can judge for themselves."
rules:
  tricolon:
    budget: 4.0
    confidence: strong
    gates: true
    source: "https://arxiv.org/abs/2604.19768"
  vocab:
    budget: 2.0
    confidence: strong
    gates: true
    source: "https://arxiv.org/abs/2406.07016"
  burstiness:
    floor: 0.35
    minSentences: 8
    confidence: moderate
    gates: true
    source: "https://arxiv.org/abs/2308.09067"
    note: "The floor is calibrated on this repo's fixture corpus, not taken from the literature, which reports a direction rather than a threshold. See benchmark output."
  unbacked:
    budget: 1.5
    confidence: weak
    gates: false
    source: "inference from maintainer complaints; no controlled study"
    adjectives: [blazing, seamless, effortless, powerful, incredible, amazing, revolutionary, game-changing, lightning-fast, unparalleled, best-in-class, world-class]
  em-dash:
    budget: 1.2
    confidence: weak
    gates: false
    source: "https://www.seangoedecke.com/em-dashes/"
    note: "Real for GPT-4o and 4.1. A 2023 study of other model families found the opposite direction. Advisory only."
  antithesis:
    budget: 0.4
    confidence: weak
    gates: false
    source: "no controlled study located"
    note: "Widely repeated, never measured against a human rhetorical baseline. Advisory only."
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/invariants.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rules/invariants.yml lib/invariants.js tests/lib/invariants.test.js && git commit -m "feat: add invariants config with per-rule confidence and sources"
```

---

### Task 9: Register routing

**Files:**
- Create: `rules/routes.yml`, `lib/routes.js`
- Test: `tests/lib/routes.test.js`

**Interfaces:**
- `routeFor(relPath, routes) -> { register: string, matched: boolean }`. Returns `{ register: null, matched: false }` when nothing matches, which is the signal for the model to apply the rubric.
- Glob support is deliberately narrow: `*` matches within a path segment, `**` matches across segments, everything else is literal. First match in file order wins, so `routes.yml` is ordered most-specific first.

- [ ] **Step 1: Write the failing test**

Assert `README.md` routes to `readme`; `docs/adr/0001-x.md` routes to `technical-doc`; `CHANGELOG.md` to `changelog`; `notes/random.md` returns `matched: false`; and that a `COMMIT_EDITMSG` path routes to `commit`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/routes.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `rules/routes.yml` and `lib/routes.js`**

```yaml
version: 1
note: "First match wins, so this file is ordered most-specific first. A path that matches nothing is not an error: it is handed to the rubric in SKILL.md, and the agent names and justifies the register itself."
routes:
  - match: "**/COMMIT_EDITMSG"
    register: commit
  - match: "README.md"
    register: readme
  - match: "**/README.md"
    register: readme
  - match: "CHANGELOG.md"
    register: changelog
  - match: "docs/**/*.md"
    register: technical-doc
  - match: "**/*.pr.md"
    register: pr
```

Compile each `match` to a regex: escape regex metacharacters, then replace the `**/` token with `(?:.*/)?`, `**` with `.*`, and `*` with `[^/]*`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/routes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rules/routes.yml lib/routes.js tests/lib/routes.test.js && git commit -m "feat: route artifacts to registers with a narrow glob matcher"
```

---

### Task 10: Register-scoped mechanical rules

**Files:**
- Create: `rules/registers.yml`, `lib/registers.js`
- Test: `tests/lib/registers.test.js`

**Interfaces:**
- `runRegister(doc, registerName, registersConfig) -> RuleResult[]`. An unknown register name returns `[]` rather than throwing, because the model may name a register the config does not know.
- Checks implemented, each toggled per register in `registers.yml`:
  - `bolded-bullets` — fraction of bullets matching `/^\s*[-*]\s+\*\*/`, over a `maxRatio`, minimum three bullets before it can fire.
  - `emoji-heading` — count of headings containing an emoji, over a budget of zero.
  - `commit-opener` — `/^(this commit|in this commit|this change|this pr)\b/i` on the first line.
  - `bullet-per-file` — bullets whose text is dominated by a path-like token, against a budget.

- [ ] **Step 1: Write the failing test**

Assert a README body with four of five bullets bolded fires `bolded-bullets`; a body with two bullets does not (below the minimum); `## 🚀 Features` fires `emoji-heading`; a commit body starting `This commit refactors the parser` fires `commit-opener`; and `runRegister(doc, 'nonexistent', cfg)` returns `[]`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/registers.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Write `rules/registers.yml` and `lib/registers.js`**

```yaml
version: 1
registers:
  readme:
    checks:
      bolded-bullets: { maxRatio: 0.5, minBullets: 3, gates: true }
      emoji-heading: { budget: 0, gates: false }
  technical-doc:
    checks:
      bolded-bullets: { maxRatio: 0.6, minBullets: 3, gates: true }
      emoji-heading: { budget: 0, gates: true }
  changelog:
    checks:
      emoji-heading: { budget: 0, gates: false }
  commit:
    checks:
      commit-opener: { gates: true }
  pr:
    checks:
      bullet-per-file: { budget: 3, gates: true }
      bolded-bullets: { maxRatio: 0.6, minBullets: 3, gates: false }
```

`lib/registers.js` reads bullets from `doc.raw` (not `doc.prose`, since prose extraction strips list markers) and headings from `doc.raw` too.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/registers.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rules/registers.yml lib/registers.js tests/lib/registers.test.js && git commit -m "feat: add register-scoped mechanical checks"
```

---

### Task 11: The scanner and the report formatter

**Files:**
- Create: `lib/check.js`, `lib/format.js`
- Test: `tests/lib/check.test.js`, `tests/no-model-calls.test.js`

**Interfaces:**
- `checkText(text, opts) -> Report` where `opts = { path, lang, rootDir, register }`. `register` overrides routing when supplied.
- `checkFile(absPath, opts) -> Report`.
- A **Report** is `{ path, register, matched, words, results: RuleResult[], gatingFailures: number, ok: boolean }`. `ok` is `gatingFailures === 0`.
- `formatReport(report, { color }) -> string` renders a compact block: one line per rule that is over, each showing count, rate, budget, confidence, and up to three `line: excerpt` hits. Rules under budget are summarised in a single trailing line. Non-gating failures are printed under an `advisory` heading and never counted in `gatingFailures`.

- [ ] **Step 1: Write the failing tests**

`tests/lib/check.test.js` asserts: a clean document returns `ok: true`; a document breaching only `em-dash` returns `ok: true` with an advisory present; a document breaching `tricolon` returns `ok: false`; `register` is `readme` for a `README.md` path; and `formatReport` output contains the word `advisory` when a demoted rule fires and never contains the phrase `AI-generated` or `detected` anywhere (the honesty constraint, asserted).

`tests/no-model-calls.test.js` walks every `.js` under `lib/`, `hooks/`, and `bin/` and asserts none contains `anthropic`, `openai`, `fetch(`, `https.request`, `child_process`, or `require('http`. `child_process` is banned in `lib/` only; `hooks/` and `bin/` may use it for git, so the test allows it there and asserts the command invoked is `git`.

- [ ] **Step 2: Run them to verify they fail**

Run: `node tests/lib/check.test.js`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `lib/check.js` and `lib/format.js`**

`checkText` builds the doc via `lib/text`, loads config via `lib/invariants` and `lib/routes`, runs invariants then register checks, and tallies `gatingFailures` from results where `over && gates`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS across every file so far.

- [ ] **Step 5: Commit**

```bash
git add lib/check.js lib/format.js tests/ && git commit -m "feat: add scanner orchestration and report formatting"
```

---

### Task 12: Register guidance documents and SKILL.md

The model-read half. These carry judgment the scanner cannot: what a register is *for*, and how to choose one when the routing table has no entry.

**Files:**
- Create: `SKILL.md`, `registers/commit.md`, `registers/readme.md`, `registers/technical-doc.md`, `registers/changelog.md`, `registers/pr.md`
- Test: `tests/registers-docs.test.js`

**Interfaces:**
- Every file in `registers/` has YAML frontmatter with `name`, `applies_to`, and `budgets_note`.
- Every register named in `rules/routes.yml` and `rules/registers.yml` has a matching file in `registers/`, asserted by the test — this is the contract that stops config and guidance drifting apart.
- `SKILL.md` has frontmatter with `name: human` and a `description` that states the trigger conditions.

- [ ] **Step 1: Write the failing test**

```js
test('every routed register has a guidance document', () => {
  const routes = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/routes.yml'), 'utf8'));
  const registers = parseYaml(fs.readFileSync(path.join(ROOT, 'rules/registers.yml'), 'utf8'));
  const named = new Set([...routes.routes.map((r) => r.register), ...Object.keys(registers.registers)]);
  for (const name of named) {
    assert.ok(fs.existsSync(path.join(ROOT, 'registers', `${name}.md`)), `registers/${name}.md exists`);
  }
});

test('every register document declares frontmatter', () => {
  for (const f of fs.readdirSync(path.join(ROOT, 'registers'))) {
    const raw = fs.readFileSync(path.join(ROOT, 'registers', f), 'utf8');
    assert.ok(raw.startsWith('---\n'), `${f} has frontmatter`);
  }
});

test('SKILL.md contains the five-question rubric', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8');
  for (const n of ['1.', '2.', '3.', '4.', '5.']) assert.ok(raw.includes(n), `rubric item ${n}`);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/registers-docs.test.js`
Expected: FAIL, `registers/commit.md` missing.

- [ ] **Step 3: Write the documents**

`SKILL.md` holds the routing table summary, the five-question rubric verbatim from the spec, the override protocol (name the register, justify in one line), and a short statement that `human` measures a budget and does not judge authorship.

Each register document states: who reads this artifact, what the shortest honest form looks like, two or three concrete before-and-after pairs drawn from real prose, and which mechanical checks apply. `commit.md` covers imperative subject, why over what, and no body when the diff speaks for itself. `readme.md` covers leading with what the tool does, no emoji headings, no bolded-bullet grid, and no adjective without a number. `pr.md` covers the motivating problem first and a test plan that cites the command actually run.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/registers-docs.test.js`
Expected: PASS, 3 cases.

- [ ] **Step 5: Commit**

```bash
git add SKILL.md registers/ tests/registers-docs.test.js && git commit -m "docs: add register guidance documents and the routing skill"
```

---

### Task 13: CLI and the /human command

**Files:**
- Create: `bin/human.js`, `commands/human.md`
- Test: `tests/bin/cli.test.js`

**Interfaces:**
- `node bin/human.js [paths...] [--fix] [--json] [--lang en|it] [--register <name>] [--quiet]`
- With no paths, reads stdin. Exit code `0` when every report is `ok`, `1` when any gating rule is over, `2` on a configuration error.
- `--fix` is **report-only in v0.1.0** and must print `--fix is not implemented; mechanical rewriting of prose is not safe to automate` and exit `2`. The flag exists so the interface is settled; the behaviour is deliberately withheld until the register documents have proven themselves.

- [ ] **Step 1: Write the failing test**

Assert: a clean fixture exits `0`; a tricolon-heavy fixture exits `1`; `--json` emits parseable JSON with a `results` array; `--fix` exits `2` with the stated message; and a missing path exits `2`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/bin/cli.test.js`
Expected: FAIL, `bin/human.js` missing.

- [ ] **Step 3: Implement the CLI and the command document**

`commands/human.md` documents `/human [path]`, `/human --diff` for changed lines only, and states that the command reports and never rewrites in this version.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/bin/cli.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add bin/ commands/ tests/bin/ && git commit -m "feat: add human CLI and /human command"
```

---

### Task 14: Session-start hook

**Files:**
- Create: `hooks/hooks.json`, `hooks/scripts/session-start.js`
- Test: `tests/hooks/session-start.test.js`

**Interfaces:**
- Reads `rules/invariants.yml`, renders the gating budgets plus a one-line disposition, and writes it to stdout as `additionalContext` in the Claude Code hook JSON shape.
- Hard budget: the rendered brief must be **under 1200 characters**, asserted by a test. That is the ~200-token figure the spec promises, and the test is what keeps the promise honest as rules are added.
- Never throws. On any error it emits an empty context and a one-line note on stderr.

- [ ] **Step 1: Write the failing test**

Assert: running the script produces valid JSON on stdout; the rendered text is under 1200 characters; it names all four gating rules; it does not name the demoted rules (they are advisory, and spending session-start tokens on them breaks the budget); and running it with a corrupt `invariants.yml` exits `0` with an empty context rather than crashing the session.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/hooks/session-start.test.js`
Expected: FAIL, script missing.

- [ ] **Step 3: Implement the hook and `hooks.json`**

`hooks.json` registers `SessionStart` with id `human:session-start` and `PostToolUse` with id `human:post-write-verify`, matching the `handoff` plugin's file shape.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/hooks/session-start.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/ tests/hooks/ && git commit -m "feat: inject invariant budgets once at session start under a 1200-character cap"
```

---

### Task 15: Post-write verification hook

**Files:**
- Create: `hooks/scripts/post-write-verify.js`
- Test: `tests/hooks/post-write-verify.test.js`

**Interfaces:**
- Reads the `PostToolUse` payload from stdin, extracts `tool_input.file_path`, and returns immediately with empty output when the path is not `*.md` — the zero-cost path for the overwhelming majority of writes.
- On a markdown path, runs `checkFile`. When `ok`, emits nothing. When not `ok`, emits the formatted report **plus the contents of the routed register document**, which is the lazy load the spec describes.
- Never blocks. It emits context; the agent decides.
- Wall-clock budget: the whole hook completes in under 50 ms on a 5 kB README, asserted by a test.

- [ ] **Step 1: Write the failing test**

Assert: a non-markdown path produces empty stdout; a clean markdown file produces empty stdout; a violating markdown file produces output containing both the rule id and text from the routed register document; malformed stdin exits `0` silently; and the 50 ms budget holds on a generated 5 kB fixture.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/hooks/post-write-verify.test.js`
Expected: FAIL, script missing.

- [ ] **Step 3: Implement the hook**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS across the whole suite.

- [ ] **Step 5: Commit**

```bash
git add hooks/scripts/post-write-verify.js tests/hooks/post-write-verify.test.js && git commit -m "feat: verify markdown writes and lazily load the routed register on failure"
```

---

### Task 16: Benchmark and fixture corpus

The family DNA requires a benchmark, and this one has a second job: it calibrates the burstiness floor, which the literature does not supply.

**Files:**
- Create: `benchmark/run-benchmark.js`, `benchmark/fixtures/machine/*.md`, `benchmark/fixtures/human/*.md`, `benchmark/README.md`
- Test: `tests/benchmark.test.js`

**Interfaces:**
- At least six fixtures per class. The `human` class is drawn from prose written before 2022 or from this repo's own hand-written documents; the `machine` class is generated slop in the same genres. Provenance for every fixture is recorded in `benchmark/README.md`.
- `run-benchmark.js` prints: median scanner runtime in milliseconds, the separation the gating rules achieve between the two classes, and the token cost of a clean session against a violating one.
- **The benchmark reports whatever it finds.** If separation is poor, the number is published and the README says so. A benchmark that can only produce good news is not a benchmark.

- [ ] **Step 1: Write the failing test**

Assert: at least six fixtures exist per class; every fixture parses without throwing; and `run-benchmark.js` exits `0` and prints a line matching `/median runtime: \d+(\.\d+)? ?ms/`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/benchmark.test.js`
Expected: FAIL, fixtures missing.

- [ ] **Step 3: Write the fixtures and the benchmark**

- [ ] **Step 4: Run it and record the result**

Run: `npm run benchmark`
Expected: prints the three figures. Copy them into `benchmark/README.md` verbatim, including the burstiness floor the corpus actually supports, and update `rules/invariants.yml` if the measured floor differs from the placeholder `0.35`.

- [ ] **Step 5: Commit**

```bash
git add benchmark/ tests/benchmark.test.js rules/invariants.yml && git commit -m "test: add fixture corpus and benchmark, calibrate burstiness floor from measured data"
```

---

### Task 17: README, CHANGELOG, and self-check

The plugin's own README must pass its own scanner. Anything less would be indefensible.

**Files:**
- Create: `README.md`, `CHANGELOG.md`
- Test: `tests/dogfood.test.js`

**Interfaces:**
- `tests/dogfood.test.js` runs `checkFile` over `README.md`, `CHANGELOG.md`, `SKILL.md`, every file in `registers/`, and both documents under `docs/`, and asserts every report is `ok`.

- [ ] **Step 1: Write the failing test**

```js
test('every document this plugin ships passes its own gating rules', () => {
  const targets = [ 'README.md', 'CHANGELOG.md', 'SKILL.md',
    ...fs.readdirSync(path.join(ROOT, 'registers')).map((f) => `registers/${f}`) ];
  for (const t of targets) {
    const report = checkFile(path.join(ROOT, t), { rootDir: ROOT, lang: 'en' });
    assert.strictEqual(report.ok, true,
      `${t} fails its own rules:\n${formatReport(report, { color: false })}`);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/dogfood.test.js`
Expected: FAIL, `README.md` missing.

- [ ] **Step 3: Write README.md and CHANGELOG.md, then fix whatever the test flags**

The README states what the plugin does, the honesty constraint, the four budgets with their sources and confidence levels, the two demoted signals and why, install instructions, and the benchmark numbers. If the scanner flags the README, the README changes — never the budget.

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS, every file.

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md tests/dogfood.test.js && git commit -m "docs: add README and CHANGELOG, both passing the plugin's own gating rules"
```

---

### Task 18: Commit and PR gate

Last because it is the most intrusive, and because everything it calls must be proven first.

**Files:**
- Create: `hooks/scripts/pre-commit-gate.js`
- Modify: `hooks/hooks.json`
- Test: `tests/hooks/pre-commit-gate.test.js`

**Interfaces:**
- Registered as `PreToolUse` on `Bash`, id `human:pre-commit-gate`. Returns immediately unless the command matches `/\bgit\s+commit\b/`.
- Extracts the message from `-m` or from `.git/COMMIT_EDITMSG`, runs `checkText` with `register: 'commit'`, and on a gating failure emits a `deny` decision naming the violated rule.
- Escape hatches, both honoured: the environment variable `HUMAN_SKIP=1`, and `--no-verify` present in the command.
- A commit message under 15 words never gates. Rate-based rules are meaningless at that length and would only produce noise.

- [ ] **Step 1: Write the failing test**

Assert: a non-commit Bash command passes through untouched; `git commit -m "fix: correct the off-by-one in the frontmatter delimiter check"` passes; a message opening `This commit refactors…` is denied and the reason names `commit-opener`; `HUMAN_SKIP=1` allows the same message through; `--no-verify` allows it through; and a five-word message never gates.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/hooks/pre-commit-gate.test.js`
Expected: FAIL, script missing.

- [ ] **Step 3: Implement the gate and register it in `hooks.json`**

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/ tests/hooks/pre-commit-gate.test.js && git commit -m "feat: gate git commit messages on the commit register, with two escape hatches"
```

---

## Self-review against the spec

**Spec coverage.** Honesty constraint — Tasks 7, 11 (asserted in test), 17. Four invariants — Tasks 4, 5, 6, 8. Demoted signals — Task 7. Register layer and rubric — Tasks 9, 10, 12. YAML/Markdown split by consumer — Tasks 2, 8, 9, 10, 12. Four triggers — Tasks 13 (`/human`), 14 (session start), 15 (post-write), 18 (commit gate). Scope limited to markdown and git text — Task 15 returns early on non-markdown; code comments and chat replies appear nowhere. False-positive handling — changed-lines-only lands as `--diff` in Task 13; the project vocabulary file is **not** in this plan and is deferred to v0.2.0, recorded here rather than left as a silent gap. Language profiles — Task 5. Tests and benchmark — Tasks 16, 17. Family DNA — the no-model-calls test in Task 11 asserts rule 2, graceful degradation is asserted in Tasks 8, 14, 15.

**Placeholder scan.** No `TBD` or `TODO` remains. `--fix` in Task 13 is not a placeholder: it is a deliberately unimplemented flag with a specified error message and exit code, and the reason is stated.

**Type consistency.** `RuleResult` fields (`id`, `confidence`, `gates`, `count`, `rate`, `budget`, `over`, `hits`, `message`) are identical across Tasks 4, 5, 6, 7, 10, 11. `doc` fields (`path`, `raw`, `prose`, `sentences`, `words`) match across Tasks 3–11. `checkFile`/`checkText`/`formatReport` signatures in Task 11 match their use in Tasks 13, 15, 17. Burstiness inverts the comparison but keeps the `over` field name, which is stated explicitly in Task 6.

**Deferred to v0.2.0, on purpose:** mechanical `--fix` rewriting, a project vocabulary file for accepted jargon, and PR-body checking through `gh`.
