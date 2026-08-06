# tinyq

A job queue for people who have one server.

No Redis, no broker, no workers to supervise. Jobs go in a SQLite table. A goroutine polls
it. That is the entire architecture and it fits in about 400 lines.

## When this is the wrong tool

If you need more than roughly 500 jobs a second, use something else. SQLite's write lock
becomes the ceiling and no amount of tuning moves it much. I measured 620/s on an NVMe
disk before contention started showing up in the p99.

If you need jobs to survive the machine dying, also use something else. Durability here
means "survives the process crashing", not "survives the disk".

What it is good at: the long tail of small applications where adding Redis means adding a
second thing to monitor, back up, and explain to whoever inherits the project.

## Usage

    q := tinyq.Open("jobs.db")
    q.Push("send-email", payload)
    q.Handle("send-email", func(p []byte) error { ... })

Retries are exponential with jitter, capped at six attempts. After that the job moves to a
dead table and stays there. Nothing cleans that table up automatically; that is deliberate,
because a queue that quietly deletes failures is worse than no queue.
