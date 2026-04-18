2024-05-28
**Title**: Minor Dependency Bump: vitest ecosystem
**Learning**: Routine maintenance is crucial to maintain alignment with the latest testing ecosystem improvements without requiring manual code refactoring.
**Action**: Maintained `vitest` and `@vitest/coverage-v8` by applying non-breaking minor/patch updates, followed immediately by running `npm test`.

**Title**: Foundation Constraint Enforcement & Trash Sweep
**Learning**: Implicit wildcards (like `^`) are leaky pipes that compromise the deterministic build environment over time. Leftover repository scratch files silently pollute the root index.
**Action**: Explicitly bind top-level dependencies with pinned minor constraints (`~`) and routinely execute physical filesystem sweeps of `.*tmp`, `server_pid`, and orphaned test files.
