
## The [INSTRUMENTER] Queue
* 🔐 `js/apps/passwords.js`: Surface-level secret signature detected (`NUM_PASSWORDS_TO_GENERATE`). Hoist to environment variable immediately.

## The [OPERATOR] Queue
* 📦 `package.json` vs lockfile drift: Missing local dependencies detected in standard `npm ls` check (`@testing-library/dom`, `@vitest/coverage-v8`, `jsdom`, `vitest`).
