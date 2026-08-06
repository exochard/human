# Changelog

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
