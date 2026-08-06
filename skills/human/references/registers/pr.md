---
name: pr
applies_to: pull-request bodies, issue bodies, issue replies
budgets_note: Invariants apply, plus bullet-per-file (gates) and bolded-bullets (advisory).
---

# pr

A pull-request body is read by a reviewer who is about to spend their attention on your diff.
Everything in the body either saves them time or wastes it. There is no neutral text.

Maintainers have started closing contributions on the strength of the description alone. curl
ended its bug-bounty programme in January 2026 after generated reports reached a fifth of
submissions while valid ones fell below five percent. The prose is not a formality.

## Shape

Lead with the motivating problem, not the change. The reviewer needs to know what was broken
before they can judge whether this fixes it.

Then the approach, and specifically what you considered and rejected. A reviewer's first
question is almost always "why not do it the other way", and answering it before they ask
saves a round trip.

Then the test plan, citing the command you actually ran and its output. A test plan asserting
success with no evidence attached is worth less than no test plan, because it invites trust
you have not earned.

If something is untested, say so plainly. "Not tested against Windows paths — I have no Windows
box" is useful. Silence on the same point is not.

## What the checker looks for

`bullet-per-file` gates above three bullets that restate a changed filename. The reviewer has
the diff stat. A bullet per file duplicates it and buries the two lines that mattered.

`bolded-bullets` advises.

## Examples

Long and shallow:

<!-- human:off -->
> ## Summary
> This PR refactors the text extraction module to improve maintainability.
>
> ## Changes
> - Updated `lib/text.js`
> - Updated `lib/yaml.js`
> - Updated `lib/check.js`
> - Added tests in `tests/lib/text.test.js`
>
> ## Test plan
> - [x] All tests pass
<!-- human:on -->

Short and useful:

<!-- human:off -->
> A `---` used as a horizontal rule was parsed as the frontmatter close, so every heading
> after it vanished from the extracted prose. It shipped three weeks ago; no fixture had both
> frontmatter and a rule, so the suite stayed green.
>
> The fix restricts the delimiter to line 1. I considered tracking fence state through the
> whole document and rejected it: the delimiter is only ever legal on line 1, so position is
> the cheaper invariant.
>
> `npm test` — 13 files, 78 cases, all passing. The new fixture in `text.test.js:41` fails
> against the old parser, which I checked by reverting the one-line change.
<!-- human:on -->

## The test

Ask whether a reviewer who read only your description would know where to look first. If not,
the description is decoration.
