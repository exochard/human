# Setting up a local mirror

You want this if your CI pulls the same 200 packages on every build and you are tired of
being rate-limited.

## The short version

Run the mirror, point your config at it, done:

    docker run -d -p 8081:8081 -v ./cache:/data example/mirror
    export PKG_REGISTRY=http://localhost:8081

## What it actually does

It is a caching proxy. First request for a package goes upstream and gets stored. Every
request after that is served from disk. There is no index, no sync job, and nothing to
schedule.

Cache size grows without bound. On our CI box it settled at about 6GB after two weeks and
has not moved much since, but that depends entirely on how many distinct versions your
builds touch. There is no eviction. If that becomes a problem, delete the directory; it
rebuilds itself.

## Things that will bite you

The mirror does not verify signatures. It passes through whatever upstream sent, including
the signature, so your client still verifies. But if you were relying on the mirror to be a
trust boundary, it is not one.

If upstream is down and the package is not cached, you get a 502. There is no stale-serving
fallback because serving an unknown-age package during an outage seemed worse than failing
loudly. Reasonable people disagree about this.

Restarting the container drops in-flight requests. Builds running at that moment will fail
and need a retry.
