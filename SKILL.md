---
name: human
description: Use when writing or revising prose that ships — READMEs, docs, CHANGELOGs, ADRs, design notes, commit messages, PR and issue bodies. Supplies the register to write in and the budgets the text will be measured against. Invoke before writing the prose, and again when a check reports a rule over budget.
---

# human

This plugin measures prose against a published budget. It does not judge who wrote the text,
and it cannot: detecting authorship is unreliable, and perplexity detectors flag over half of
TOEFL essays by non-native English writers. Saying "this reads as generated" would be a claim
nobody can support. Saying "nine three-item series in four hundred words" is a measurement.

Write to the register. The budgets are the floor, not the goal.

## Two layers

**Invariants** hold whatever you are writing. They are injected at session start and checked
on every markdown write. Four of them gate: tricolon rate, dated vocabulary, sentence-length
variation, and superlatives with no number behind them. Two more are reported and never gate,
because the evidence does not support gating them.

**Register** depends on the artifact. A commit message and a landing page cannot obey one rule
set. `rules/routes.yml` picks a register from the path; when it has no entry, you pick.

## Choosing a register

Look up the path in `rules/routes.yml` first. That covers the common cases and costs nothing.

When nothing matches, or when the match is plainly wrong for what you are actually writing,
run the rubric:

1. Who reads this — a maintainer, a stranger, a buyer?
2. What breaks if the prose is wrong?
3. Is persuasion legitimate here, or is it slop?
4. Does the reader already hold a wrong belief? If not, drop the rebuttals and the trailing
   negation. Defending a claim nobody attacked reads as insecurity.
5. What is the shortest honest form?

Then say which register you chose and why, in one line, before you write. An override that
turns out to be right is a routing-table entry somebody should add later.

## The registers

| Register | Artifact | Read |
|---|---|---|
| `commit` | commit messages | `registers/commit.md` |
| `readme` | README files | `registers/readme.md` |
| `technical-doc` | docs, ADRs, design notes | `registers/technical-doc.md` |
| `changelog` | CHANGELOG entries | `registers/changelog.md` |
| `pr` | pull-request and issue bodies | `registers/pr.md` |

Read the one you picked. Do not read all five.

## What the budgets mean

A budget is a rate, measured per 1000 words, and nothing is measured below 150 words where a
rate means nothing. Going over is a prompt to look, not proof of anything. The third tricolon
on a page is the problem; the first is just a sentence.

When a check reports a rule over budget, the fix is the prose. Changing the budget to pass is
available and is almost always the wrong move — the numbers come from published corpus studies
and each one carries its source in `rules/invariants.yml`.

## What the tool cannot do

It counts. It cannot tell whether a paragraph says anything, whether a claim is true, or
whether the reader will care. Prose can sit inside every budget and still be worth deleting.
That judgment is yours, and it is the part that matters.
