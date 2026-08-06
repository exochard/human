---
name: changelog
applies_to: CHANGELOG files
budgets_note: Invariants apply, though entries are usually short enough that rate rules stay quiet. emoji-heading advises.
---

# changelog

A changelog is read by someone deciding whether to upgrade, and by someone who just upgraded
and now something is broken. Both want the same thing: what will bite me.

## Shape

Group by what a change means to the reader, not by what it meant to you. Breaking changes go
first, every time. State them as an instruction — what the reader must now do differently.

One line per change, in the past tense, naming the observable effect rather than the
implementation. `Fixed: headings after a horizontal rule are no longer dropped` beats
`Refactored frontmatter parsing logic`. The reader does not have your file tree in their head.

Version numbers and dates are not decoration. A changelog entry with no version is a note to
yourself.

## What the checker looks for

`emoji-heading` advises. Rate rules rarely fire because entries are short, which is correct:
brevity is the register.

## Examples

Implementation-facing:

<!-- human:off -->
> ### Changed
> - Refactored the text extraction module
> - Updated configuration handling
> - Various improvements and bug fixes
<!-- human:on -->

Reader-facing:

<!-- human:off -->
> ### Fixed
> - Headings following a `---` horizontal rule are no longer silently dropped. Documents
>   affected by this need no action; re-run the check to see them.
>
> ### Changed
> - `--fix` now exits 2 instead of rewriting. Rewriting prose mechanically was not safe.
>   Use the report and edit by hand.
<!-- human:on -->

"Various improvements and bug fixes" tells the reader to go read the diff, which is the one
thing a changelog exists to prevent.

## The test

Read the entry as somebody whose build just broke. If it does not tell them whether this
release is the cause, rewrite it.
