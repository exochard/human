# Why we moved off the shared cache

## The decision

We replaced the shared Memcached tier with a per-process in-memory cache in March. This
document is here so nobody has to reconstruct the reasoning from git blame.

## What was wrong

The shared cache was fine at our old traffic. It stopped being fine when we went from four
app servers to thirty. Every cache read crossed the network, and at thirty servers the
cache tier was handling 180k reads a second to serve maybe 9k distinct keys.

The p50 was 0.8ms, which nobody minded. The p99 was 47ms, which showed up directly in our
own p99, and about a third of our latency budget was going to a system whose entire job was
making things faster.

## What we considered and rejected

Bigger cache boxes. This would have worked and it would have kept working for maybe eight
months. We rejected it because the failure mode at the end of those eight months is the same
conversation with less time to have it.

Client-side connection pooling with better batching. We prototyped this. It cut the p99 to
about 20ms. Not enough, and it added a batching layer that only one person understood.

## What it cost

The per-process cache means thirty copies of the same data, so memory per box went from
1.2GB to 4.7GB. We are paying for RAM instead of network round trips. At current prices
that is a good trade and at some scale it stops being one.

Invalidation is now a broadcast rather than a delete. We accept a window of up to two
seconds where different servers disagree. For our data that window is harmless. For
anything involving money it would not be, and if we ever cache that, this decision needs
revisiting.
