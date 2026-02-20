# Scribe's Journal ✍️

## Discovery Log

### js/apps/calculator.js
- **Date:** [Current Date]
- **Status:** UNDOCUMENTED
- **Details:**
  - Found 17 potential undocumented functions using `scan_docs.py`.
  - Core logic functions like `calculateAdditionalCallTimeNeeded` lack formal JSDoc.
  - UI rendering functions are completely undocumented.
  - Key business logic (formulas) is present but not explained in JSDoc for `calculateDailyRatings`.

## Action Plan
- Document all exported and internal functions in `js/apps/calculator.js`.
- Add `@param`, `@returns`, and descriptions.
- Verify with `scan_docs.py`.
