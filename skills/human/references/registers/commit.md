---
name: commit
applies_to: commit messages, git tags
budgets_note: Rate rules do not run below 150 words, so most commit messages are checked only by commit-opener. The register still governs.
---

# commit

A commit message is read by someone running `git log` or `git blame` months from now, trying
to work out why a line looks the way it does. The diff already tells them what changed. They
are here for the reason.

## Shape

Imperative subject, under 72 characters, no trailing period. `fix: read the frontmatter
delimiter only on line 1` — not `fixed` and not `fixes`.

A body only when the reason is not obvious from the diff. Most commits do not need one. When
there is a body, it explains why the change was made, what was tried and rejected, or what
constraint forced the shape. Never a bullet list of the files you touched: `git diff --stat`
does that better and for free.

## What the checker looks for

`commit-opener` fires on a message that opens by announcing itself — "This commit refactors",
"In this commit", "This change adds". It gates. Those openings spend the most valuable line in
the message saying nothing.

## Examples

Restating the diff:

<!-- human:off -->
> This commit refactors the text extraction module. It updates lib/text.js to handle
> frontmatter and modifies the sentence splitting logic. Tests were also updated.
<!-- human:on -->

The reason:

<!-- human:off -->
> fix: match the frontmatter delimiter only on line 1
>
> A `---` used as a horizontal rule halfway down a document was being read as the
> frontmatter close, which silently dropped every heading after it. Three weeks in
> production before anyone noticed, because no fixture had both frontmatter and a rule.
<!-- human:on -->

Padding a one-line change:

<!-- human:off -->
> chore: comprehensive update to configuration handling
>
> - Updated config.js
> - Improved error handling
> - Enhanced maintainability
<!-- human:on -->

What it should have been:

<!-- human:off -->
> chore: name the file in the config-load error
<!-- human:on -->

## The test

Read it as the person doing the archaeology. If the subject line alone answers "why is this
line here", the message is done. If the body only tells them what the diff already shows,
delete the body.
