---
description: Show what the plugin currently has in force — budgets, adjustments, persona sources, and register routing.
argument-hint: "[path/to/file.md]"
allowed-tools: Bash(node:*), Read
---

Run the diagnostic:

```
node "${CLAUDE_PLUGIN_ROOT}/bin/human.js" --doctor ${ARGUMENTS:+--path "$ARGUMENTS"}
```

Report what it printed, and read the result rather than restating it:

- **Persona `none`** means no identity is loaded and prose this session will be measured against
  the published budgets only. Mention `/human:human-persona` once; do not push it.
- **`adjusted from`** on a budget means a persona moved it. That is legitimate and by design.
  Name which rule moved and in which direction.
- **`clamped`** means the persona asked for more than the published ceiling allows. Say what it
  asked for and what it got. This is the one line in the output most worth surfacing, because it
  is the only place the tool refused something the user wrote.
- **`ignored`** means an override names something that is not a rule. Almost always a typo; say
  which rules exist.
- **`GUIDANCE MISSING`** against a register is a broken install. The config knows about a
  register with no document behind it, so routing there would produce no guidance at all.
- **`BROKEN`** against config or persona means a file will not parse. The message names the file
  and the line. Nothing is being checked until it is fixed, which is worth stating outright
  rather than burying.

If a path was given, the output ends with the register it resolves to and the glob that matched.
When it says `no match`, that is not an error: the rubric in the skill decides, and whoever
writes that file should name the register they picked.
