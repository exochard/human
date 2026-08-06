# Changelog

## 0.2.0 — 2026-08-06

### Breaking

- `SKILL.md` moved from the plugin root to `skills/human/SKILL.md`, and the register guidance
  from `registers/` to `skills/human/references/registers/`. The old layout was wrong: Claude
  Code discovers skills at `skills/<name>/SKILL.md` and nowhere else, so the routing table and
  the register rubric were never loaded by anything while every test reported green. Anyone who
  referenced those paths directly needs to update them.
- `/human` is now `/human:human-review`. `/human:human-load` is a different command that loads
  the conventions rather than auditing a file. It is not called `/human:human` because the
  skill directory is also named `human`, and the two would resolve to the same invocation.

### Added

- **Persona layer.** A declared identity — who you are, who you write for, the positions you
  hold — read from `~/.claude/human/persona.md` or `.claude/human.local.md`, with project
  fields winning over user fields one at a time. It shapes what the model is told and does not
  change what the scanner verifies.
- Budget adjustment from persona frontmatter, bounded by a ceiling published beside each budget
  in `rules/invariants.yml`. An override past its ceiling is clamped, and the clamp is reported
  by the doctor and by any scan it affects, on a passing document as much as a failing one. A
  rule firing under an adjusted budget names the adjustment.
- `allow` in persona frontmatter removes domain jargon from the vocabulary list. Closes the
  v0.1.0 limit that a repo with real jargon had no way to declare it.
- `/human:human-load` loads budgets, persona, and the routing table deliberately.
- `/human:human-persona` runs the interview, with `--show` and `--edit`.
- `/human:human-doctor` and `--doctor` report what is in force: budgets with their adjustments
  and clamps, persona sources, vocabularies, register guidance, and the register a given path
  resolves to. Always exits 0, because a diagnostic that can fail is not a diagnostic.
- `--persona` on the CLI applies the persona to a scan.
- `SessionStart` names an existing persona file in one line, without loading it.
- Layout tests: skill location, component directories at plugin root, command frontmatter, and
  every `hooks.json` command resolving to a file that exists.
- `docs/persona-example.md`, a complete filled-in persona.

### Fixed

- Command basenames no longer collide with the skill directory. `commands/human.md` and
  `skills/human/` both resolved to `/human:human`, and `claude plugin details` listed two
  components called `human`. The loader is `/human:human-load`, and a test asserts no command
  basename ever matches a skill directory again.

### Reverted during development

Mid-development both hooks were switched from stdout at exit 0 to stderr at exit 2, on the
strength of a line in the hook documentation. That change was wrong and has been reverted.
Behaviour against the running CLI, checked by inspecting session transcripts rather than
reading docs:

- `PostToolUse` with `additionalContext` on stdout at exit 0 produces a
  `hook_additional_context` attachment and reaches the model exactly as intended. At exit 2
  the same report is classified `hook_blocking_error`, and the model came away unsure whether
  the write had succeeded — the opposite of a hook whose contract is "reports, never blocks".
- `PreToolUse` with `permissionDecision` on stdout at exit 0 blocks cleanly, with
  `toolDenialKind: "permission-rule"` and the reason string delivered verbatim. Exit 2 also
  blocks, but Claude Code does not parse JSON on that path: it wraps stderr behind a generic
  `hook error:` prefix, so the model receives a JSON blob instead of a reason.

Both hooks carry a comment saying not to make that change again, and the tests assert the
verified shapes. Worth recording rather than quietly reverting: the wrong version was written
because a documentation line was read as a full contract, and only running the thing settled it.
- Persona files are never scanned. A file describing how you write is not a document written in
  your style.

### Known limits

- Deriving a persona from writing samples by measurement rather than self-report. It needs a
  corpus of the user's writing large enough for stable statistics, which most users do not have.
- Everything still listed under 0.1.0 below except the vocabulary allowlist, which shipped.

## 0.1.0 — 2026-08-06

First release.

### Added

- Four invariant budgets, each with a source URL and a stated confidence level: tricolon rate,
  post-2022 vocabulary, sentence-length variation, and superlatives with no number behind them.
- Two advisory signals, `em-dash` and `antithesis`, which are counted and can never gate. A
  test asserts they stay that way.
- Register routing. `rules/routes.yml` maps a path to a register; an unmatched path is handed
  to the rubric in `skills/human/SKILL.md` rather than treated as an error. Guidance documents for `commit`,
  `readme`, `technical-doc`, `changelog`, and `pr`.
- Register-scoped mechanical checks: `bolded-bullets`, `emoji-heading`, `commit-opener`, and
  `bullet-per-file`.
- `SessionStart` hook injecting the gating budgets once, under a 1200-character cap that a test
  enforces.
- `PostToolUse` hook that returns immediately on a non-markdown path, stays silent on a clean
  one, and loads the routed register document only when a gating rule is over budget.
- `PreToolUse` gate on `git commit`. Both `--no-verify` and `HUMAN_SKIP=1` pass through.
- `/human` command and a CLI. Exit 0 within budget, 1 over a gating rule, 2 on a configuration
  error.
- `<!-- human:off -->` fences, so a document can quote the style it argues against.
- English and Italian vocabulary profiles.
- A YAML subset parser, so the package has no runtime dependencies. It throws with a line
  number on anything outside the subset rather than half-parsing a rules file in silence.
- Benchmark and a twelve-document fixture corpus.

### Known limits

- `--fix` is not implemented. It exits 2 and explains why. Rewriting prose mechanically is not
  safe: a rule can tell you a sentence is over budget, not what it was trying to say.
- No project vocabulary file yet, so a repo with heavy domain jargon has no way to allow it.
- Changed-lines-only checking is not implemented, so a repo installs into whatever prose debt
  it already has.
- The benchmark corpus was written by the author of the rules. The reported separation is an
  upper bound, not a field estimate.
- Code comments, docstrings, and PR bodies fetched through `gh` are all out of scope.
