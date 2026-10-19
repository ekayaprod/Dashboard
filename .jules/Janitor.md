# Janitor Log

## Resolved Entropy
* Hoisted `APP_TIME_TRAVEL_DATE` variable found in `js/apps/calculator.js` into `.env.example` baseline.

## Persistent Entropy
* Unlinked artifact `playwright-report/` generated from testing needs deletion but is outside strict git scope.

## Hazard Log
* Lockfile mismatch or orphaned package `whatwg-encoding` found (deprecated dependency warnings from `npm`).
* Incomplete Node.js engine compatibility block (Node >=22.22.2 expected, current 22.22.1).
* 🗑️ Removed `.jules/agent_tasks.md` which was not found.
* 🗑️ Removed `navigator-report.json` which is a temporary artifact.
* 🚫 `jsdom` and `@vitest/coverage-v8` appear as unused in depcheck, but uninstalling them breaks vitest. Skipping manifest prune for these dependencies to preserve test integrity.
