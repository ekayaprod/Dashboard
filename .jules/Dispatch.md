# Dispatch Journal

## Abstract Axioms
- Structural integrity of YAML files must always be verified via `yamllint`.
- Workflow indentation and line lengths must adhere to strict YAML standards.
- Document start `---` is required for all YAML manifests to prevent parse ambiguities.
- Quoted strings for boolean-like keys (e.g., `"on"`) prevent unexpected structural evaluation.

## Environment State Manifest
- Injected CodeQL SAST scanning matrix (.github/workflows/codeql.yml)

## Optimized Transit Bloat
- **Issue**: E2E pipeline redownloading Playwright browsers excessively without caching. CI pipeline redundantly running tests twice.
- **Action Taken**:
  - Injected `actions/cache` in `e2e.yml` keyed by `package-lock.json` hash to aggressively cache `~/.cache/ms-playwright`.
  - Split OS dependency installation from binary download.
  - Consolidated duplicate test execution in `ci.yml` into a single `npx vitest run --coverage` step.
- **Purpose**: Prevent future pipeline regressions or cyclic downgrades that reintroduce redundant steps and transit bloat.
