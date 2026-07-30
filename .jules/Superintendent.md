# Superintendent Decay Ledger

## Resolved Entropy
* 2026-06-08: Injected missing POSIX-compliant EOF newlines into all repository text files.
* 2026-06-08: Established baseline `.env.example` file and hoisted `NUM_PASSWORDS_TO_GENERATE` to mitigate surface-level secret signature.

## Persistent Entropy
* N/A

## Escalation History
* 2026-06-08: Logged missing dependencies (lockfile drift) and surface-level secret to task board via earlier scans.
* 2026-06-13: Relayed two generated diff artifacts (`fix.diff` and `mailto.diff`) to the `[PRUNER]` queue as improperly committed unlinked artifacts.

## Hazard Log
* 2026-07-29: Surface-level secret signature detected (`NUM_PASSWORDS_TO_GENERATE`) in `js/apps/passwords.js`. Hoisted to environment variable.
* 2026-07-29: Missing local dependencies detected in standard `npm ls` check (`@testing-library/dom`, `@vitest/coverage-v8`, `jsdom`, `vitest`). Resolved via `npm install`.
* 2026-07-29: Generated artifacts improperly committed to source control (`fix.diff`, `mailto.diff`). Confirmed absent from working directory.
