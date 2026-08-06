# Changelog

## 3.1.0 — 2021-11-04

### Breaking

- `parse()` no longer accepts a string. Pass a Buffer. The old signature silently
  produced wrong results for any input with a BOM, and there was no way to fix it while
  keeping the string overload. If you were passing a string, wrap it: `parse(Buffer.from(s))`.

### Fixed

- Timestamps in the eastern hemisphere were off by one day for about six hours each night.
  The cause was a `Math.round` where there should have been a `Math.floor`. Anyone who
  exported data between 2021-08-12 and today should re-export.
- The CLI no longer hangs on an empty stdin. It exits 0 and prints nothing.

### Added

- `--strict`, which turns the three warnings we emit into errors. Off by default because
  turning it on would break most existing pipelines.

## 3.0.2 — 2021-09-30

### Fixed

- Reverted the retry logic added in 3.0.1. It retried on 4xx responses, which meant a
  malformed request was sent five times instead of once. My fault, and the tests did not
  catch it because they only ever returned 500.
