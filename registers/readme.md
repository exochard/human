---
name: readme
applies_to: README files at any depth
budgets_note: All four invariants apply, plus bolded-bullets (gates) and emoji-heading (advisory).
---

# readme

A README is read by a stranger deciding in about twenty seconds whether this project is worth
their afternoon. They have not agreed to anything yet, so every adjective is a cost and every
number is a reason to keep reading.

## Shape

Open with what the thing does, in a sentence, in the reader's terms. Not what it is built on,
not what category it belongs to. If a command's output or a screenshot shows it faster than a
paragraph, lead with that instead.

Sections exist because you needed them. A table of contents on a document that fits in one
scroll is decoration. The Contributing / License / Acknowledgements trio appended to a
forty-line personal project is filler that a reader learns to skip, which trains them to skip
the parts that mattered.

## What the checker looks for

`bolded-bullets` gates above half the bullets opening with a **bolded lead-in**. Almost nobody
formats a list that way by hand, and a grid of bolded stubs reads as a feature matrix rather
than as writing.

`emoji-heading` advises. An emoji in a heading is not a crime; a full set of them across every
section is a template.

`unbacked` advises on superlatives in sentences carrying no number. "Blazing fast" is a claim
with nothing behind it. "Runs in 3 ms" is the same claim, kept.

## Examples

The template:

<!-- human:off -->
> ## 🚀 Overview
>
> A **comprehensive**, **robust** solution designed to seamlessly streamline your workflow.
>
> ### Key Benefits
> - **Automatic injection** — context when you need it
> - **Zero configuration** — works out of the box
> - **Token efficient** — reduces overhead significantly
<!-- human:on -->

The same project, written:

<!-- human:off -->
> Every session you start, you re-explain the same thing. This stops that.
>
> It reads HANDOFF.md at startup and injects the parts you will actually need: 3224
> characters out of 7429 on this repo's own file. The rest stays on disk.
>
> It does not summarise with a model. A hook that spends tokens to save tokens is a bad
> trade.
<!-- human:on -->

The difference is not tone. The second one has a number in it, states a tradeoff, and takes a
position somebody could disagree with.

## The test

Cover the project name and read it. If the text could describe four other projects, it is
describing none of them.
