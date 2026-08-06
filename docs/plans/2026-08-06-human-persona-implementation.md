# human v0.2.0 persona layer — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user declare who they are, hand that to the model before it writes, and allow visible bounded adjustment of the style budgets.

**Architecture:** A third layer above invariants and registers. Model-read prose plus a small machine-read frontmatter block that may move a budget within a published ceiling. Loads on command only; `SessionStart` merely names the file.

**Tech Stack:** Unchanged. Node ≥18, CommonJS, zero runtime dependencies.

## Global Constraints

- Everything from `2026-08-06-human-implementation.md` still applies: zero dependencies, no model calls in `lib/` or `hooks/`, files under 500 lines, no `Co-Authored-By` trailer.
- A budget adjustment is never silent. It appears in `human-doctor` output and in any report it affects.
- An override past its ceiling is clamped, and the clamp is reported. Never accepted silently, never dropped silently.
- Persona files are never scanned by the checker.
- `SessionStart` output stays under 1200 characters.
- Version becomes `0.2.0` in **both** `plugin.json` and `marketplace.json`. The existing test asserts they match; the roadmap records three wasted reload cycles when they did not.

---

### Task 1: Ceilings in the invariants config

**Files:**
- Modify: `rules/invariants.yml`
- Test: `tests/lib/config-routes.test.js`

**Interfaces:**
- Produces: every gating rule entry gains `ceiling` (for budget rules) or `floorCeiling` (for burstiness, which fails below its threshold and therefore loosens downward).

- [ ] **Step 1: Add the assertion to the existing config test**

```js
test('every gating rule publishes a ceiling with its reasoning', () => {
  for (const [id, entry] of Object.entries(cfg.invariants.rules)) {
    if (!entry.gates) continue;
    const bound = entry.ceiling !== undefined ? entry.ceiling : entry.floorCeiling;
    assert.ok(bound !== undefined, `${id} publishes a ceiling a persona cannot pass`);
    if (entry.budget !== undefined && entry.budget !== null) {
      assert.ok(entry.ceiling > entry.budget, `${id} ceiling must be above its budget`);
    }
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/config-routes.test.js`
Expected: FAIL, `tricolon publishes a ceiling a persona cannot pass`.

- [ ] **Step 3: Add the ceilings**

```yaml
  tricolon:
    budget: 4.0
    ceiling: 8.0
    minCount: 4
```

with `note:` extended to carry the reasoning: 8.0 sits just above the measured LLM mean of 7.13 per document, so a persona raising it to the ceiling is declaring that it accepts prose at the machine average.

`vocab: ceiling: 6.0` (three times the budget; the benchmark machine mean was 71.9, so 6.0 stays far below anything the corpus called slop). `burstiness: floorCeiling: 0.25`, the lowest value observed anywhere in the fixture corpus. `unbacked: ceiling: 4.0`, though it does not gate.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/config-routes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add rules/invariants.yml tests/lib/config-routes.test.js
git commit -m "feat: publish a ceiling for every gating budget"
```

---

### Task 2: Persona loading, merging, and clamping

**Files:**
- Create: `lib/persona.js`
- Test: `tests/lib/persona.test.js`

**Interfaces:**
- `findPersona(cwd, homeDir) -> { projectPath, userPath }` — locates `.claude/human.local.md` upward from `cwd`, and `<homeDir>/.claude/human/persona.md`.
- `loadPersona(opts) -> Persona | null` where `opts = { cwd, homeDir }`.
- A **Persona** is `{ sources: string[], frontmatter: object, body: string, overrides: object, allow: string[], clamps: Clamp[] }`.
- A **Clamp** is `{ rule: string, requested: number, applied: number, ceiling: number }`.
- `applyPersona(invariants, persona) -> { invariants, clamps }` returns a copy with budgets moved and never mutates its input.
- `isPersonaPath(p) -> boolean` — true for `human.local.md` and `human/persona.md`.
- Project frontmatter merges over user frontmatter field by field. Bodies concatenate, user first, each under a heading naming its source.
- A persona that fails to parse throws with a message naming the file. It never degrades to "no persona", because silently writing without a declared identity is the failure the layer exists to prevent.

- [ ] **Step 1: Write the failing test**

`tests/lib/persona.test.js`:

```js
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { loadPersona, applyPersona, isPersonaPath } = require('../../lib/persona');
const { loadConfig, defaultRoot } = require('../../lib/config');
const { test, done } = require('../helpers/harness');

const cfg = loadConfig(defaultRoot());

function scratch(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'human-persona-'));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return dir;
}

const USER = ['---', 'language: en', 'overrides:', '  tricolon: 6.0', 'allow:', '  - orchestration',
  '---', '', '## Who I am', '', 'I build developer infrastructure.', ''].join('\n');

test('returns null when no persona exists', () => {
  const dir = scratch({ 'README.md': 'x' });
  assert.strictEqual(loadPersona({ cwd: dir, homeDir: dir }), null);
});

test('loads a user persona and exposes body and overrides', () => {
  const dir = scratch({ '.claude/human/persona.md': USER });
  const p = loadPersona({ cwd: path.join(dir, 'nothing'), homeDir: dir });
  assert.strictEqual(p.overrides.tricolon, 6);
  assert.deepStrictEqual(p.allow, ['orchestration']);
  assert.ok(p.body.includes('developer infrastructure'));
});

test('project frontmatter wins field by field', () => {
  const dir = scratch({
    '.claude/human/persona.md': USER,
    'proj/.claude/human.local.md': ['---', 'overrides:', '  vocab: 3.0', '---', '', 'Project voice.', ''].join('\n'),
  });
  const p = loadPersona({ cwd: path.join(dir, 'proj'), homeDir: dir });
  assert.strictEqual(p.overrides.vocab, 3, 'project override applied');
  assert.strictEqual(p.overrides.tricolon, 6, 'user override survives');
  assert.strictEqual(p.sources.length, 2);
});

test('an override past its ceiling is clamped and recorded', () => {
  const dir = scratch({ '.claude/human/persona.md':
    ['---', 'overrides:', '  tricolon: 99', '---', '', 'x', ''].join('\n') });
  const p = loadPersona({ cwd: dir, homeDir: dir });
  const { invariants, clamps } = applyPersona(cfg.invariants, p);
  assert.strictEqual(clamps.length, 1);
  assert.strictEqual(clamps[0].requested, 99);
  assert.strictEqual(clamps[0].applied, cfg.invariants.rules.tricolon.ceiling);
  assert.strictEqual(invariants.rules.tricolon.budget, cfg.invariants.rules.tricolon.ceiling);
});

test('applyPersona never mutates the config it was given', () => {
  const dir = scratch({ '.claude/human/persona.md':
    ['---', 'overrides:', '  tricolon: 6.0', '---', '', 'x', ''].join('\n') });
  const before = cfg.invariants.rules.tricolon.budget;
  applyPersona(cfg.invariants, loadPersona({ cwd: dir, homeDir: dir }));
  assert.strictEqual(cfg.invariants.rules.tricolon.budget, before);
});

test('allow removes words from the vocabulary list', () => {
  const dir = scratch({ '.claude/human/persona.md':
    ['---', 'allow:', '  - robust', '---', '', 'x', ''].join('\n') });
  const p = loadPersona({ cwd: dir, homeDir: dir });
  const { vocab } = applyPersona(cfg.invariants, p, cfg.vocab);
  assert.ok(!vocab.en.words.includes('robust'));
  assert.ok(cfg.vocab.en.words.includes('robust'), 'the source list is untouched');
});

test('a malformed persona throws and names the file', () => {
  const dir = scratch({ '.claude/human/persona.md': '---\noverrides:\n\ttricolon: 6\n---\n\nx\n' });
  assert.throws(() => loadPersona({ cwd: dir, homeDir: dir }), /persona\.md/);
});

test('persona paths are recognised so they are never scanned', () => {
  assert.strictEqual(isPersonaPath('.claude/human.local.md'), true);
  assert.strictEqual(isPersonaPath('/home/x/.claude/human/persona.md'), true);
  assert.strictEqual(isPersonaPath('docs/persona-notes.md'), false);
});

done();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/persona.test.js`
Expected: FAIL, `Cannot find module '../../lib/persona'`.

- [ ] **Step 3: Implement `lib/persona.js`**

Reuse `stripFrontmatter` from `lib/text.js` and `parseYaml` from `lib/yaml.js`. Walk up from `cwd` at most 20 levels looking for `.claude/human.local.md`. Clamping compares against `ceiling` for budget rules and `floorCeiling` for `burstiness`, where a persona loosens by moving the floor *down*.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/lib/persona.test.js`
Expected: PASS, 8 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/persona.js tests/lib/persona.test.js
git commit -m "feat: load persona files, merge project over user, clamp overrides to ceilings"
```

---

### Task 3: Wire the persona into the scanner and the report

**Files:**
- Modify: `lib/check.js`, `lib/format.js`
- Test: `tests/lib/check-persona.test.js`

**Interfaces:**
- `checkText(text, opts)` accepts `opts.persona`. When present, budgets and vocabulary come from `applyPersona`.
- The Report gains `adjustments: {ruleId: {from, to}}` and `clamps: Clamp[]`.
- Each RuleResult affected gains `adjustedFrom: number`.
- `formatReport` renders `tricolon (strong, budget adjusted 4.0 -> 6.0 by persona)` and prints a `clamped:` block when any clamp occurred.
- `checkFile` returns `null` for a persona path rather than scanning it.

- [ ] **Step 1: Write the failing test**

Assert: a document over the default tricolon budget but under an adjusted one reports `ok: true`; the affected result carries `adjustedFrom: 4`; `formatReport` on a firing adjusted rule contains `budget adjusted`; a clamped persona produces a `clamped:` line in the report; and `checkFile` on `.claude/human.local.md` returns `null`.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/lib/check-persona.test.js`
Expected: FAIL, `opts.persona` ignored.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS. The v0.1.0 tests must still pass untouched — a report with no persona is byte-identical to before.

- [ ] **Step 5: Commit**

```bash
git add lib/check.js lib/format.js tests/lib/check-persona.test.js
git commit -m "feat: apply persona budgets in the scanner and name every adjustment in the report"
```

---

### Task 4: The four commands

**Files:**
- Create: `commands/human-review.md`, `commands/human-persona.md`, `commands/human-doctor.md`
- Modify: `commands/human.md` (becomes the loader; its old content moves to `human-review.md`)
- Create: `lib/doctor.js`, and extend `bin/human.js` with a `--doctor` flag
- Test: `tests/commands.test.js`, extend `tests/bin/cli.test.js`

**Interfaces:**
- `runDoctor(opts) -> string` reports: plugin version, persona sources or "none", every gating budget with its adjustment and clamp state, the vocabulary language in use and any allowed words, and the register a supplied `--path` resolves to.
- `node bin/human.js --doctor [--path <p>]` prints it. Exit 0 always, since a diagnostic that fails is useless.
- Every command file carries frontmatter with `description` and `allowed-tools`.

- [ ] **Step 1: Write the failing test**

```js
test('every documented command file exists with frontmatter', () => {
  for (const name of ['human', 'human-review', 'human-persona', 'human-doctor']) {
    const p = path.join(ROOT, 'commands', `${name}.md`);
    assert.ok(fs.existsSync(p), `commands/${name}.md exists`);
    const raw = fs.readFileSync(p, 'utf8');
    assert.ok(raw.startsWith('---\n'), `${name} has frontmatter`);
    assert.ok(/description:/.test(raw), `${name} declares a description`);
  }
});

test('the persona command asks for language footing', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'commands/human-persona.md'), 'utf8');
  assert.ok(/second language|native|bilingual/i.test(raw));
});

test('--doctor reports budgets and exits 0', () => {
  const r = spawnSync('node', [CLI, '--doctor'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.ok(/tricolon/.test(r.stdout));
  assert.ok(/persona/i.test(r.stdout));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/commands.test.js`
Expected: FAIL, `commands/human-review.md` missing.

- [ ] **Step 3: Write the commands and the doctor**

`human-persona.md` runs the interview one question at a time, covering the seven fields in the spec, then writes the file and shows it. It states plainly that the persona shapes what the model writes and does not change what the scanner verifies.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add commands/ lib/doctor.js bin/human.js tests/
git commit -m "feat: split the commands into loader, review, persona, and doctor"
```

---

### Task 5: The session-start pointer

**Files:**
- Modify: `hooks/scripts/session-start.js`, `hooks/scripts/post-write-verify.js`
- Test: extend `tests/hooks/hooks.test.js`

**Interfaces:**
- When a persona file exists, `SessionStart` appends one line naming its path and the command that loads it. When none exists, it appends nothing.
- The 1200-character cap still holds with the line present, asserted by the existing test.
- `post-write-verify` skips persona paths.

- [ ] **Step 1: Write the failing test**

Assert: with a persona present the injected context names it and mentions `/human:human`; with none present the context contains no mention of a persona; the cap holds in both cases; and `post-write-verify` on a persona path emits nothing.

- [ ] **Step 2: Run it to verify it fails**

Run: `node tests/hooks/hooks.test.js`
Expected: FAIL, no persona line.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/ tests/hooks/hooks.test.js
git commit -m "feat: name an existing persona at session start without loading it"
```

---

### Task 6: Documentation, version bump, and dogfood

**Files:**
- Modify: `README.md`, `CHANGELOG.md`, `SKILL.md`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`
- Create: `docs/persona-example.md`
- Test: `tests/dogfood.test.js` picks the new files up automatically

**Interfaces:**
- Version `0.2.0` in both manifests. The existing scaffold test asserts they agree.
- `README.md` gains a persona section stating what the layer does and does not do, and the ceiling table.
- `docs/persona-example.md` is a complete filled-in example, fenced with `human:off` where it quotes sample prose.

- [ ] **Step 1: Bump both manifests and run the scaffold test**

Run: `node tests/scaffold.test.js`
Expected: PASS with `0.2.0` in both.

- [ ] **Step 2: Write the documentation**

- [ ] **Step 3: Run the dogfood test**

Run: `node tests/dogfood.test.js`
Expected: PASS. Every new document must clear its own gating rules; when one does not, the prose changes and not the budget.

- [ ] **Step 4: Run the full suite and the benchmark**

Run: `npm test && npm run benchmark`
Expected: PASS, and the benchmark numbers unchanged, since no rule logic moved.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: document the persona layer and bump to 0.2.0"
```

---

## Self-review against the spec

**Spec coverage.** Persona as a judgment layer — Tasks 2, 4 (the command states it). Seven interview fields — Task 4. Storage and project-over-user merge — Task 2. Persona files never scanned — Tasks 2 (`isPersonaPath`), 3 (`checkFile`), 5 (`post-write-verify`). Bounded adjustment with published ceilings — Tasks 1, 2. Clamped and reported — Tasks 2, 3, 4. Adjustment named in the report — Task 3. `allow` list — Tasks 2, 3. Load on command only — Task 4. Session-start pointer — Task 5. Four commands — Task 4. Cap still holds — Task 5. No model calls — the existing test covers `lib/` and `hooks/` and needs no change.

**Placeholder scan.** None.

**Type consistency.** `Persona` and `Clamp` fields are identical across Tasks 2, 3, 4. `applyPersona(invariants, persona, vocab)` takes a third argument in the `allow` test in Task 2 and is used that way in Task 3; the signature is `(invariants, persona, vocab)` with `vocab` optional, returning `{ invariants, vocab, clamps }`.

**Deferred:** deriving a persona from writing samples by measurement rather than self-report.
