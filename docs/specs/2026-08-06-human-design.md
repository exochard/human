# human — design spec

**Date:** 2026-08-06
**Status:** approved, pre-implementation
**Family:** exoClaude plugin family (`caveman`, `handoff`, `delegate`, …)

## The waste

An agent writes prose that is grammatically clean and unmistakably machine-made. A person
then rewrites it by hand. That rewrite is the waste `human` kills.

The prose in question is not blog posts. It is the writing a coding agent produces around
code: READMEs, CHANGELOGs, design docs, ADRs, commit messages, pull-request bodies. It is
public, it is what a stranger judges the project by, and open-source maintainers have begun
rejecting contributions on the strength of it alone.

## The honesty constraint

**`human` is a style-budget enforcer, not an AI detector.**

This is the load-bearing decision in the whole design. Detecting AI authorship does not work
reliably and cannot be made to. Perplexity-based detectors misclassified over half of TOEFL
essays written by non-native English speakers as machine-generated, because low lexical
variety and low perplexity are the same signal ([Liang et al. 2023, PNAS
Nexus](https://arxiv.org/abs/2304.02819)). Every competing tool leans on that class of
judgment and quietly overclaims it.

Vale lints grammar without ever claiming to know who typed the sentence. `human` takes the
same posture: it measures prose against a published budget and reports what exceeds it. No
verdict on authorship is issued, so no false accusation is possible. The rules end up nearly
identical; the claim is defensible.

A consequence worth stating plainly: `human` will flag prose a person wrote, when that person
wrote three tricolons in a row. That is correct behaviour, not a bug.

## Architecture — two layers

The central insight from brainstorming: a single fixed register applied everywhere is exactly
the incumbent failure mode. A commit message and a landing page cannot obey one rule set. So
rules split by whether they survive a change of context.

### Layer 1 — invariants

Always loaded, roughly 200 tokens, true regardless of artifact. Only rules with real evidence
behind them qualify.

| Budget | Measure | Evidence |
|---|---|---|
| Tricolon rate | parallel triads per 1000 words | 7.13/doc in LLM text vs 3.73 in human expert text, p<0.001 ([arXiv:2604.19768](https://arxiv.org/abs/2604.19768)) |
| Dated vocabulary | frequency of post-2022 spike words | large-N, causal timing ([Kobak et al., Sci. Adv. 2024](https://arxiv.org/abs/2406.07016); [Liang et al., ICML 2024](https://arxiv.org/abs/2403.07183)) |
| Burstiness floor | stdev/mean of sentence length | replicated across corpus studies ([arXiv:2308.09067](https://arxiv.org/abs/2308.09067)) |
| Unbacked adjective | superlative with no number or benchmark nearby | weakest of the four; inferred from maintainer complaints, labelled as such in the rules file |

### Demoted signals

Reported at most as advisory notes. They never gate, never block, and never count toward a
failing score.

- **Em-dash rate.** Real for GPT-4o and 4.1, and a 2023 study of other model families found
  the opposite direction. It is an artifact of one model generation's training data, not a
  property of machine text. Hard-coding it guarantees future misfires.
- **"Not X, but Y" antithesis.** Widely repeated, no controlled frequency study exists
  separating it from ordinary rhetorical human writing.

Shipping these as hard rules is precisely what makes the existing tools wrong. `human` labels
the confidence of its own signals, in the rules file, in the reader's view.

### Layer 2 — register

Routed per artifact. `rules/routes.yml` supplies a prior; the agent may override it using the
rubric in `SKILL.md`, and must then name the register and justify the choice in one line.
Overrides are logged so the routing table improves from real cases.

```
commit body       -> registers/commit.md
README.md         -> registers/readme.md
docs/**.md        -> registers/technical-doc.md
CHANGELOG.md      -> registers/changelog.md
PR / issue body   -> registers/pr.md
*.md unmatched    -> rubric decides
```

Register rules are mechanical too, but scoped. The bolded-bullet-lead-in ratio matters in a
README and means nothing in a commit message. Commit gets rules no other artifact has: a
leading-phrase regex (`^(this commit|in this commit|this change)`), bullet count against
lines changed, body length against diff size.

The rubric a register decision runs through:

1. Who reads this — a maintainer, a stranger, a buyer?
2. What breaks if the prose is wrong?
3. Is persuasion legitimate here, or is it slop?
4. Does the reader already hold a wrong belief? If not, no rebuttals and no trailing negation.
5. What is the shortest honest form?

## File formats — split by consumer

YAML for what a script reads. Markdown for what the model reads. Prose guidance stuffed into
YAML string values loses readability and gains nothing.

```
human/
  .claude-plugin/
    plugin.json
    marketplace.json
  hooks/
    hooks.json
    scripts/
      session-start.js        inject invariants once
      post-write-verify.js    scan what was just written
  rules/
    invariants.yml            the four budgets + thresholds     [script]
    routes.yml                artifact -> register prior        [script]
    registers.yml             per-register mechanical rules     [script]
    vocab/
      en.yml                  dated-frequency word lists        [script]
      it.yml
  registers/
    commit.md  readme.md  technical-doc.md
    changelog.md  pr.md                                         [model]
  SKILL.md                    router + judgment rubric          [model]
  commands/
    human.md                  /human audit and fix
  lib/
    check.js                  the deterministic scanner
    …
  tests/
  benchmark/
```

## Triggers

Session-start priming carries only the invariants, because at session start the artifact is
not yet known and no register can be routed. Register documents load lazily, on violation.
That inverts the cost curve: a session where the model writes well costs about 200 tokens
total.

```
SessionStart        inject invariants (~200 tokens, once)

Write / Edit        nothing. zero cost.

PostToolUse         lib/check.js — deterministic, milliseconds, no model call
  clean       ->    silent
  violation   ->    inject violations plus the routed register doc

/human [path]       audit or --fix prose already on disk

commit / PR gate    mechanical backstop, escape hatch required
```

This handles instruction drift better than periodic re-injection does. `caveman` fights decay
by re-injecting on every prompt, a fixed tax whether or not anything is drifting. Here the
verify hook fires on evidence, so a well-behaved session pays nothing.

## Scope

Checked: `**/*.md`, commit messages, PR and issue bodies.

Not checked: code comments, docstrings, agent chat replies. Comments would need a per-language
extractor and the prose budgets do not transfer to a one-line comment. Chat replies belong to
`caveman`, which already owns that surface; two plugins issuing conflicting style verdicts on
one output is the hook-ordering problem the family roadmap resolved once already.

## False positives

Two patterns, both proven by Vale in CI:

- A project vocabulary file for accepted jargon.
- Changed-lines-only checking by default, so a repo full of existing prose does not scream on
  the day the plugin is installed.

## Language

`vocab/en.yml` ships complete. `vocab/it.yml` ships as a second validated profile — the author
writes Italian and can check it, and per-language tell profiles are untouched ground across
every tool surveyed. The schema is per-language so a third is additive. Nothing unvalidated
ships.

## Competitive position

The niche is adjacent-occupied. [`avoid-ai-writing`](https://github.com/conorbronsdon/avoid-ai-writing)
holds 2.8k stars with 61 pattern categories; two smaller skills exist. All three scan text
that already exists and rewrite it using model judgment against a checklist. None is
deterministic, none primes, none handles a second language, and none distinguishes an
evidence-backed rule from folklore.

`human` differs on four axes: mechanical detection with zero model calls in the hot path,
per-artifact register routing instead of one flat rule set, published confidence levels per
rule, and a validated non-English profile.

One legal note: `writing-prose-like-a-human-for-agents` is CC BY-SA 4.0. Its share-alike terms
would contaminate anything derived from it. The `human` ruleset is authored from the primary
sources cited above.

## Family DNA compliance

1. **Push, not pull** — invariants inject at `SessionStart`; verification fires on `PostToolUse`.
2. **Mechanical-first** — every hook-path check is regex and arithmetic. No model call.
3. **Verification over trust** — the scanner reads what was actually written, not what the
   agent claims it wrote.
4. **Graceful degradation** — an unreadable rules file disables the check and says so; it
   never silently passes.
5. **Complete product** — tests, benchmark, README, marketplace.json ship together.
6. **Scope discipline** — code comments, chat replies, and languages beyond en/it are out.

## Success criteria

- The scanner runs in single-digit milliseconds on a typical README.
- A clean session costs ~200 tokens; cost rises only with violations.
- Every rule in `invariants.yml` carries a source URL and a confidence level.
- The fixture corpus separates machine-written from human-written docs at a rate worth
  publishing in the benchmark, reported honestly whatever it is.
- Zero model calls in any hook path, asserted by a test.

## Open questions

None blocking. The plugin name stayed `human` over the alternatives (`voice`, `tell`,
`register`); it is an adjective where the family convention favours nouns, accepted because it
reads instantly to a stranger, which is the convention's actual purpose.
