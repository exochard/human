# Benchmark

Run it with `npm run benchmark`. The numbers below are from 2026-08-06, on the corpus in
`fixtures/`.

## What it measures

Two things. What the scanner costs, and how far apart the two fixture classes sit on each
rule. The second number is the one that matters, and it is also the one with the weakest
methodology, which is worth saying before the results rather than after.

## Results

```
corpus: 6 machine, 6 human, 2559 words total
median runtime: 0.44 ms per document
slowest: 4.8 ms

gating verdict by class
  machine  4/6 flagged
  human    0/6 flagged

  true positives  4/6
  false positives 0/6

mean rate by rule (machine vs human)
  tricolon       21.08 vs    1.65   12.76x
  vocab           71.9 vs       0   inf
  burstiness      0.26 vs    0.49   0.52x
  unbacked        7.75 vs       0   inf

burstiness distribution
  machine  min 0.25  median 0.37  max 0.55
  human    min 0.45  median 0.49  max 0.55
```

Both missed machine documents are under 150 words, where no rate rule runs at all. That is
the floor working, not the rules failing: at 88 words a single flagged word scores 11 per
1000, and acting on that would produce noise rather than signal. The tool reports the length
and stays quiet.

## How the burstiness floor was set

The literature gives a direction, not a threshold, so the number had to come from somewhere.
It comes from here.

The human class bottoms out at 0.45 and the machine class at 0.25. A floor anywhere between
those two separates the corpus perfectly. It is set at **0.35**, not at 0.40 where it would
catch one more machine document, because with six human samples a 0.05 margin to the observed
human minimum is not a margin worth trusting. A larger human corpus would justify moving it
up. Until someone builds one, the conservative number stands.

## What this corpus is, and what it is not

Both classes were written for this benchmark. The machine class imitates the documented slop
patterns; the human class was written to read like hand-written technical documentation.
Neither was sampled from a real corpus.

That is a real weakness and it cuts in a specific direction: the author of the fixtures also
wrote the rules, so the separation reported above is closer to an upper bound than to an
estimate of field performance. A 12.76x separation on tricolon rate says the rule works on
text built to contain tricolons. It does not establish that it works on the next README you
happen to open.

What the corpus does establish is the thing it was mainly built to check: **zero false
positives across six documents written to sound like a person.** That direction is the one
that matters, because a style gate that fires on good prose gets switched off within a week
and then protects nothing.

## What would make this better

Sampling the human class from pre-2022 published technical documentation, where authorship
is not in question and the fixtures were not written by anyone with a stake in the result.
That is the obvious next step and it has not been done.

## History

The first run of this benchmark reported 1 true positive and **2 false positives** — it
flagged human prose more often than machine prose. Two causes, both real:

1. Every machine fixture was under 150 words, so no rate rule ever ran on them. The fixtures
   were rewritten to realistic length.
2. More seriously, the rules were wrong. The source studies count occurrences **per
   document**; the budgets are rates **per 1000 words**. In a 200-word README a single
   three-item series scores 5.0 and failed a budget of 4.0, and one series is ordinary
   writing. Both human false positives were exactly this. Rate rules now require a minimum
   absolute count as well as a rate over budget, set just above the published human
   per-document average.

The second fix would not have been found without the benchmark, and it had been shipped
green through sixteen passing test files.
