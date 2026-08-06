---
description: Analyse one or more files against the published style budgets and report what is over.
argument-hint: "[path ...] [--persona] [--quiet] [--lang en|it] [--register <name>]"
allowed-tools: Bash(node:*), Read, Glob
---

Run the scanner over the paths in `$ARGUMENTS`, or over the repository's markdown when no path
is given:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/human.js" $ARGUMENTS
```

Then, for each file reported over budget:

1. Read the file.
2. Read the register document the report names, under
   `${CLAUDE_PLUGIN_ROOT}/skills/human/references/registers/`. If the
   report says no register matched, apply the rubric in the human skill, name the register you
   chose, and say why in one line.
3. Propose edits to the prose. Show them; do not apply them without being asked.

Rules to hold to while doing this:

- Fix the prose, never the budget. The numbers come from published corpus studies and each one
  carries its source in `rules/invariants.yml`.
- Findings marked advisory do not gate. Mention them once and move on. The em-dash rate tracks
  one model generation's training data and the antithesis construction has no controlled study
  behind it, which is why neither can fail a document.
- A quoted counter-example inside `<!-- human:off -->` fences is excluded on purpose. Leave it.
- `--fix` exists and deliberately refuses to run. A rule can tell you a sentence is over budget;
  it cannot tell you what the sentence was trying to say.
- Pass `--persona` to apply the user's declared identity and its budget adjustments. When a
  report says `budget adjusted`, the persona moved that number on purpose; when it says
  `clamped`, the persona asked for more than the ceiling allows and did not get it. Surface
  both rather than treating the adjusted number as the published one.

The scanner measures a budget. It does not judge who wrote the text, and neither should the
report you give back.
