---
name: technical-doc
applies_to: docs/, ADRs, design notes, specifications, RFCs
budgets_note: All four invariants apply. bolded-bullets and emoji-heading both gate here; a design document has no reason to be decorated.
---

# technical-doc

A design document is read by someone who has to make a decision, or by someone months later
asking why a decision went the way it did. Both need the reasoning, including the parts that
turned out to be wrong.

## Shape

State the decision, then what it costs. A design document that lists only advantages has not
been thought through, and an experienced reader stops trusting it at the first unqualified
claim.

Name the alternatives you rejected and why. "We considered X and rejected it because Y" is the
single highest-value sentence in this register, and it is the one generated drafts leave out,
because rejection requires having actually weighed something.

Numbers you measured beat adjectives every time. "Fast" is an opinion. "1.7 seconds, down from
an indefinite hang" is a fact somebody can check and, if you are wrong, correct.

## What the checker looks for

`emoji-heading` gates. `bolded-bullets` gates above 0.6.

`tricolon` matters more here than anywhere else. Three-item parallel series make a document
sound decided when it is not, and they cluster in exactly the sections where the author was
least sure.

## Examples

Confident and empty:

<!-- human:off -->
> This architecture provides a robust, scalable, and maintainable foundation. By leveraging a
> modular approach, we ensure seamless integration across all components.
<!-- human:on -->

The same section with content:

<!-- human:off -->
> Rules split into two layers because a single rule set applied everywhere is the failure mode
> we are trying to avoid: a commit message and a landing page cannot obey the same budget.
>
> The cost is a routing table that will be wrong sometimes. We accept that because a wrong
> route degrades to "invariants only", which is still useful, whereas a flattened rule set
> degrades to noise the writer learns to ignore.
<!-- human:on -->

## Admitting limits

Write the specific limit, not a generic disclaimer. "This will misfire on documents under 150
words, so it does not run there" is useful. "While no solution is perfect, we strive for
excellence" is an apology for nothing.

## The test

Give it to someone who disagrees with the decision. If they cannot find the sentence that
would change their mind, or the sentence that concedes their strongest point, the document is
advocacy rather than design.
