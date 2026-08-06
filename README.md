# human

Measures the markdown and git text an agent writes against a published style budget. Runs in
about 0.4 ms per document, costs nothing, and calls no model.

It does not tell you who wrote the text. That distinction is the whole design, so it is worth
being blunt about: **`human` is not an AI detector.** Detecting authorship does not work
reliably and cannot be made to. Perplexity-based detectors misclassified over half of TOEFL
essays by non-native English writers as machine-generated, because low lexical variety and low
perplexity are the same signal ([Liang et al. 2023](https://arxiv.org/abs/2304.02819)). Tools
that claim otherwise are overclaiming.

What `human` does instead is what Vale does for grammar: it counts things against a number you
can look up, and shows its working.

## Install

```
/plugin marketplace add clochard04/human
/plugin install human
```

Node 18 or later. No runtime dependencies.

## What it checks

Four budgets hold everywhere. Each carries a source and a confidence level in
`rules/invariants.yml`, and each is a rate per 1000 words that also needs a minimum absolute
count before it can fire.

| Rule | Budget | Confidence | Source |
|---|---|---|---|
| tricolon | 4.0 per 1000 words, min 4 | strong | 7.13 per document in LLM text against 3.73 in human expert text, p<0.001 ([arXiv:2604.19768](https://arxiv.org/abs/2604.19768)) |
| vocab | 2.0 per 1000 words, min 3 | strong | words whose published frequency jumped 9.8x to 34.7x after 2022 ([Kobak et al.](https://arxiv.org/abs/2406.07016), [Liang et al.](https://arxiv.org/abs/2403.07183)) |
| burstiness | floor 0.35 | moderate | sentence-length variation ([arXiv:2308.09067](https://arxiv.org/abs/2308.09067)); threshold calibrated here, see `benchmark/` |
| unbacked | 1.5 per 1000 words, min 2 | weak | maintainer complaints; no controlled study, so it never gates |

Nothing is measured below 150 words, where a rate means nothing.

### Two rules that are reported and never gate

The em-dash rate is real for GPT-4o and 4.1, and a 2023 study of other model families found
the opposite direction. It tracks one generation of training data. The `not X, but Y`
construction is repeated everywhere as a giveaway and, as far as this project could find, has
never been measured against a human rhetorical baseline.

Both are counted, both are labelled `weak`, and neither can fail a document. Shipping signals
like these as hard rules is the specific mistake this plugin exists to avoid.

## Persona

A persona is a declared identity: who you are, who you write for, and the positions you hold.
`/human:human-persona` interviews you and writes it to `~/.claude/human/persona.md`, or to
`.claude/human.local.md` for one project. Project fields win over user fields one at a time,
so a project can set an audience without restating an identity.

It sits with the registers in the judgment half. An identity is not checkable by regex, and the
persona shapes what the model is told rather than what the scanner can verify.

The one mechanical part is budget adjustment, and it is bounded:

| Rule | Budget | A persona may reach |
|---|---|---|
| tricolon | 4.0 | 8.0, just above the measured LLM mean of 7.13 per document |
| vocab | 2.0 | 6.0, still far below the 71.9 the benchmark measured on machine fixtures |
| burstiness | floor 0.35 | floor 0.25, the lowest value seen anywhere in the corpus |
| unbacked | 1.5 | 4.0 |

Ask for more than the ceiling and the value is clamped. The clamp is reported by
`/human:human-doctor` and by any scan it affects, on a passing document as much as a failing
one. A rule firing under an adjusted budget names the adjustment:
`tricolon (strong, budget adjusted 4 -> 6 by persona)`. A number that moved is more interesting
than one that did not.

`allow` in the frontmatter removes domain jargon from the vocabulary list.

The persona loads on `/human:human` and `/human:human-review --persona`, not automatically.
It is large, most sessions write no prose, and paying its weight ambiently would be the wrong
trade. `SessionStart` names the file in one line so you do not have to remember it exists.

See `docs/persona-example.md` for a filled-in one.

## Registers

A commit message and a landing page cannot obey one rule set, so beyond the invariants the
rules depend on the artifact. `rules/routes.yml` maps a path to a register; when nothing
matches, the agent applies a five-question rubric, names the register it picked, and says why.

Each register has a guidance document under `skills/human/references/registers/` covering who reads that artifact and
what the shortest honest form looks like, plus its own mechanical checks. `bolded-bullets`
gates in a README and is meaningless in a commit. `commit-opener` catches a message that opens
with "This commit refactors", and exists nowhere else.

## When it runs

```
SessionStart          injects the gating budgets once, capped at 1200 characters,
                      plus one line naming a persona file if one exists
Write / Edit          nothing
PostToolUse           scans a markdown write; silent when it is within budget
                      over budget, it reports and loads the routed register document
/human:human          loads budgets, persona, and the routing table deliberately
/human:human-review   audits prose already on disk
/human:human-persona  runs the interview
/human:human-doctor   shows what is in force and why
git commit            holds a message over budget; --no-verify and HUMAN_SKIP=1 pass through
```

The register documents load lazily, on failure. A session where the prose comes out clean
costs about 200 tokens in total.

## Command line

```
node bin/human.js docs/ --quiet
node bin/human.js --json README.md --persona
node bin/human.js --doctor --path docs/adr/0001.md
git log -1 --pretty=%B | node bin/human.js --register commit
```

Exit 0 within budget, 1 over a gating rule, 2 on a configuration error.

`--fix` exists and refuses to run. A rule can tell you a sentence is over budget; it cannot
tell you what the sentence was trying to say.

## Excluding text

Any document that teaches a style has to quote the style it argues against. Fence those
quotations:

```
<!-- human:off -->
Quoted counter-example, not measured.
<!-- human:on -->
```

## Languages

English ships complete. Italian ships as a second profile at `moderate` confidence, and the
file says plainly why it is lower: no corpus study of Italian generated text exists to match
Kobak or Liang, so the list is an authored hypothesis rather than a measurement. Every tool
surveyed while designing this was English-only.

Add a language by dropping a `rules/vocab/<code>.yml` beside the others.

## How well does it work

On the fixture corpus: 4 of 6 machine-written documents flagged, 0 of 6 human-written
documents flagged. Both misses are under the 150-word floor.

The corpus was written for this benchmark by the same person who wrote the rules, which makes
that separation an upper bound rather than a field estimate. `benchmark/README.md` says so at
more length, along with the first run, which reported two false positives and one true
positive and exposed a genuine bug in the rules.

## Not covered

Code comments and docstrings, because extracting them needs a per-language parser and prose
budgets do not transfer to a one-line comment. Agent chat replies, because `caveman` already
governs that surface and two plugins issuing conflicting style verdicts on one output is worse
than either alone.

## License

MIT.
