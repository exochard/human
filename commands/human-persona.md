---
description: Interview the user about how they write and save it as a persona the plugin applies to future prose.
argument-hint: "[--show] [--edit] [--project]"
allowed-tools: Bash(node:*), Read, Write, Edit, AskUserQuestion
---

Build or inspect the user's persona: a declared identity the plugin hands to the model before
it writes.

## First, branch on `$ARGUMENTS`

- `--show`: run `node "${CLAUDE_PLUGIN_ROOT}/bin/human.js" --doctor`, read the persona files it
  lists, show them, and stop.
- `--edit`: read the existing persona, ask what to change, apply it, and stop.
- Otherwise: run the interview below.

## Where to write it

Default to `~/.claude/human/persona.md` — an identity travels between repositories. Write to
`.claude/human.local.md` in the current repository instead when `$ARGUMENTS` contains
`--project`, or when the answers are plainly about one project rather than about the person.

## The interview

Ask **one question at a time** with AskUserQuestion. Offer concrete options rather than an open
prompt wherever the answer space is small. Do not ask all seven at once, and do not skip ahead
if an early answer makes a later question obviously irrelevant.

1. **Role and what you build.** What do you make, and for whom? A plugin author writing for
   developers needs a different register from a consultant writing for buyers.
2. **Audience.** Who reads what you write? Ask whether there is more than one, because many
   people write for two and write differently for each.
3. **Language footing.** Is English your first language, a second language, or do you work
   bilingually? If bilingual: which languages, and do you compose each one separately or
   translate from one? Ask this plainly and without apology. It changes the guidance
   materially, and guessing it would mean quietly pushing a second-language writer toward a
   native-idiom register they never asked for.
4. **Positions you hold.** Which opinions recur in your writing? These are what make prose
   sound like a person rather than a description of a product.
5. **Things you never do.** Constructions, words, or habits you have already decided against.
6. **Things that look like tells but are yours.** Habits a style checker might flag that you
   want kept. Without this the persona can only restrict, and a persona that can only restrict
   gets deleted within a month.
7. **Samples.** Ask for two or three passages of their own writing that they are happy with.
   This is the only part of the file that is evidence rather than self-report, and it is worth
   more than the six answers above put together. If they have nothing to hand, say so in the
   file rather than leaving the section out.

## Then write the file

```markdown
---
language: en
overrides:
  tricolon: 6.0
allow:
  - orchestration
---

## Who I am
...

## Who I write for
...

## Language
...

## Positions I hold
...

## Never
...

## Mine, not tells
...

## Samples

<!-- human:off -->
> the sample text
<!-- human:on -->
```

Rules for writing it:

- Frontmatter is optional and mostly stays empty. Only add an `overrides:` entry when an answer
  to question 6 genuinely conflicts with a budget, and say in the body why. Only add `allow:`
  for real domain jargon the user named.
- An override past its published ceiling will be clamped and reported. Do not attempt to defeat
  a budget by writing a large number; write the honest one.
- Fence the samples with `human:off`. They are quoted evidence, not prose written in this file's
  own voice, and measuring them would be a category error.
- Write the body in the user's own words wherever they gave you a usable phrase. A persona
  paraphrased into neutral prose has thrown away the thing it was collecting.

## Finally

Show the file, say where it was written, and tell the user it loads on `/human:human-load` and
`/human:human-review --persona`, not automatically.

Say plainly what the persona does and does not do: it shapes what the model is told before it
writes; it does not change what the scanner can verify. The four budgets still measure the same
four things.
