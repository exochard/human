## Summary

This PR refactors the authentication module to improve maintainability and extensibility.
The changes are comprehensive and touch several key areas of the codebase.

## Changes

- Updated `src/auth/login.js`
- Updated `src/auth/session.js`
- Updated `src/auth/tokens.js`
- Added `tests/auth/login.test.js`
- Modified `config/auth.yml`

## Implementation Details

The implementation leverages a modular approach that fosters flexibility. Each component is
meticulously designed to handle a specific concern. This separation enhances testability,
promotes reusability, and improves maintainability.

## Test Plan

- [x] All existing tests pass
- [x] New tests added for the refactored modules
- [x] Manual testing completed

This change is robust, well-tested, and ready for review.
