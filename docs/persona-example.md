# A filled-in persona

What `/human:human-persona` produces. Copy it to `~/.claude/human/persona.md` and replace
every word, or run the interview and let it write the file for you.

Nothing here is required. A persona with three sentences under "Who I am" and nothing else is
a real persona and will change the prose. Frontmatter is optional and usually stays empty.

<!-- human:off -->
```markdown
---
language: en
overrides:
  tricolon: 6.0
allow:
  - orchestration
  - worktree
---

## Who I am

I build developer tooling on my own and ship it under my name. Plugins, small
infrastructure, things that run unattended. I have been burned enough times by tools that
were confident and wrong that I would rather ship something narrow that admits its limits.

## Who I write for

Two audiences, and they want opposite things.

Developers reading a README have thirty seconds and have already decided most tools are
overselling. They want the command, the number, and the reason not to use it.

Buyers reading a landing page need the problem named in their own words before anything
else. Persuasion is legitimate there. It is not legitimate in a design document.

## Language

English is my second language; Italian is my first. I compose each one separately rather
than translating, because a translated sentence keeps the source language's rhythm and an
Italian reader hears it immediately.

In Italian the em dash is rare and reads as a loud tell, so I use a comma, a full stop, or
brackets. I avoid the connective openers: inoltre, pertanto, dunque, di conseguenza.

## Positions I hold

Infrastructure ships complete. A product that arrives as a kit of optional snippets the
buyer has to assemble is not finished, it is outsourced.

A tool that costs tokens to save tokens is a bad trade, and most of them are.

A green test suite is not evidence that anything works. I have shipped a plugin that could
not complete a single task while fifty-two tests passed.

## Never

No trailing negation. I state the positive once and stop. Defending a claim the reader
never made reads as insecurity.

No aphoristic closer on every paragraph. Twice a page, then a concrete example instead.

No signposting: "it is worth noting", "here is the thing", "in conclusion".

Plain words. Use, not utilize. Strong, not robust.

## Mine, not tells

I use three-item series more than the budget allows, deliberately, when the three things
are genuinely parallel. That is why `tricolon` is raised to 6.0 above.

I write four-word sentences next to thirty-word ones on purpose. If that ever trips a
burstiness check, the check is wrong.

`orchestration` and `worktree` are load-bearing words in what I build, not filler.

## Samples

> The background daemon is optional. It runs interval workers that each spawn a headless
> session, so it consumes tokens continuously. Start it only if you want those sweeps.

> Only bumping the version in both files forced a reinstall. The cache is keyed on version,
> and three reload cycles went into learning that.
```
<!-- human:on -->

## What the frontmatter does

`language` picks the vocabulary profile when no `--lang` is passed.

`overrides` moves a budget, up to the ceiling published beside it in `rules/invariants.yml`.
Ask for more than the ceiling and the value is clamped, with the clamp reported by
`/human:human-doctor` and by any scan it affects. Writing a large number does not defeat a
budget; it produces a line in the report saying you tried.

`allow` removes words from the vocabulary list. Use it for domain terms that are load-bearing
in your work, not for words you would rather not be told about.

## What a persona does not do

It shapes what the model is told before it writes. It does not change what the scanner can
verify: the same four budgets measure the same four things, and the only number that moves is
one you moved on purpose and can see.
