---
description: Load the prose conventions for this session — budgets, persona, and the register routing table.
argument-hint: "[--no-persona]"
allowed-tools: Bash(node:*), Read, Glob
---

Load the writing conventions before producing prose this session.

Run the diagnostic to see what is actually in force:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/human.js" --doctor
```

Then read, in this order:

1. `${CLAUDE_PLUGIN_ROOT}/skills/human/SKILL.md` — the routing table and the five-question
   rubric for choosing a register when the table has no entry.
2. The persona file, if the diagnostic listed one. It states who is writing, who they write
   for, and the positions they hold. Apply it to every piece of prose this session until told
   otherwise. Skip this step if `$ARGUMENTS` contains `--no-persona`.

Do **not** read every register document now. Read one when you know what you are writing.

Hold to this for the rest of the session:

- The budgets shown by the diagnostic are the floor, not the goal. Clearing them says the
  prose is not obviously machine-made; it says nothing about whether it is any good.
- Where a budget shows as adjusted, the persona moved it and that is legitimate. Where one
  shows as clamped, the persona asked for more than the ceiling allows and did not get it.
- A number you measured beats an adjective. Concrete beats abstract.
- Say the positive once. Do not defend a claim the reader never attacked.
- Vary sentence length hard, and vary list length; not everything is three items.

The scanner measures a budget. It does not judge who wrote the text, and neither should you.
