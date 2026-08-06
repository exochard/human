# human v0.2.0 — persona layer

**Date:** 2026-08-06
**Status:** approved, pre-implementation
**Extends:** `2026-08-06-human-design.md`

## The gap

v0.1.0 knows two things about prose: rules that hold for everyone, and rules that hold for an
artifact. It knows nothing about the person the prose belongs to.

That is a real hole. Two writers producing the same README should not produce the same README.
One is an Italian founder shipping infrastructure to developers who distrust marketing; the
other is a consultant writing for buyers. The register is identical and the prose should not be.

## What a persona is

A declared identity document. The user states who they are, who they write for, and how they
work, and the plugin hands that to the model before it writes.

It is not a language profile. `rules/vocab/it.yml` says what Italian machine prose over-reaches
for; a persona says who is writing and why. They compose: an Italian persona and the Italian
vocabulary profile are different objects and both apply.

## Which layer it belongs to

The judgment half, with registers, not the mechanical half with the invariants.

"Peppe is an Italian founder who ships infrastructure and dislikes being sold to" is not
checkable by regex, and pretending otherwise would be the same overclaim this plugin was built
to avoid. The docs say so directly: the persona shapes what the model writes; it does not
change what the scanner can verify.

The one exception is budget adjustment, which is mechanical and is specified below.

## What the interview extracts

Vague self-description produces vague guidance, so the interview asks for things that change
output.

| Field | Why it changes the prose |
|---|---|
| Role and what you build | A plugin author writing for developers is a different register from a consultant writing for buyers |
| Audience, per context | Many people have two and write differently for each |
| Language footing | Native, second language, or bilingual; and if bilingual, whether you compose each language separately or translate |
| Positions you hold | Recurring opinions that should surface in prose written as you |
| Things you never do | Existing personal rules, stated once and applied everywhere |
| Things that look like tells but are yours | The escape valve; without it a persona can only restrict |
| Two or three real samples | The only part that is evidence rather than self-report, and the strongest signal in the file |

The language-footing question earns its place beyond taste. Non-native English writers are the
population that authorship detectors falsely flag, at rates above fifty percent
([Liang et al. 2023](https://arxiv.org/abs/2304.02819)). `human` accuses nobody, so the harm
does not arise, but guidance written blind would quietly push a second-language writer toward a
native-idiom register they never asked for. Asking is cheaper than assuming.

## Storage

```
.claude/human.local.md        project, checked in or not
~/.claude/human/persona.md    user, travels across repos
```

Project wins where both exist, field by field rather than wholesale, so a project can set an
audience without restating an identity.

Format is markdown with YAML frontmatter: frontmatter for what scripts read, body for what the
model reads. The same split the rest of the plugin uses.

Persona files are excluded from scanning. A file describing how you write is not a document
written in your style, and flagging it would be a category error.

## Budget adjustment

A persona may move a budget, within a published ceiling, and every adjustment is visible.

```yaml
overrides:
  tricolon: 6.0     # ceiling 8.0
allow:
  - orchestration   # domain jargon, removed from the vocabulary list
```

Three rules govern this:

1. **Ceilings are published** in `rules/invariants.yml` next to the budget, with the reasoning.
   The tricolon ceiling is 8.0 because the measured LLM mean is 7.13 per document: a persona
   raising it to the ceiling is declaring "I accept prose at the machine average", which is a
   defensible thing to want and an honest thing to have written down.
2. **An override past the ceiling is clamped and reported.** It is never silently accepted and
   never silently ignored. `human-doctor` shows the clamp; so does the scan report.
3. **A report under an adjusted budget names the adjustment.** `tricolon (strong, budget
   adjusted 4.0 -> 6.0 by persona)`. A number that moved is more interesting than one that did
   not, and hiding it would make the tool's own output untrustworthy.

`allow` removes words from the vocabulary list for this user or project. It closes a v0.1.0
limit: a repo with real domain jargon currently has no way to declare it.

## Loading

**On command only.** `/human:human` and `/human:human-review` load the persona; nothing else
does.

This is a deliberate exception to the family's push-not-pull rule and the cost is real: prose
written before the command is run gets the invariants and not the identity. It is accepted
because a persona is large, most sessions write no prose at all, and paying its token weight
ambiently in every code session would be the wrong trade.

The mitigation is one line. When a persona file exists, the `SessionStart` hook names it and
says how to load it. Roughly fifteen tokens, no content, and the writer never has to remember
the file is there.

## Commands

| Command | Does |
|---|---|
| `/human:human` | Loads invariants, persona, and the register index deliberately |
| `/human:human-review` | Analyses files, a directory, or `--diff`. This is v0.1.0's `human.md`, renamed |
| `/human:human-persona` | Runs the interview; `--show` and `--edit` for an existing file |
| `/human:human-doctor` | What is active now: budgets, adjustments and clamps, persona source, routing resolution for a given path |

A separate `human-allow` command was considered and rejected. An allowlist is two lines of
persona frontmatter and does not need its own verb.

## Success criteria

- A persona file changes what the model is told and never changes what the scanner claims to
  verify.
- Every budget adjustment is visible in both `human-doctor` and any report it affects.
- An override past its ceiling is clamped, and the clamp is reported in both places.
- Persona files are never scanned.
- `SessionStart` stays under its 1200-character cap with the persona pointer added.
- Zero model calls in any hook path, still asserted by the existing test.

## Out of scope

Deriving a persona from writing samples by measurement rather than self-report. It is the
obvious next step and it needs a corpus of the user's writing large enough to compute stable
statistics, which most users do not have. Revisit when someone does.
