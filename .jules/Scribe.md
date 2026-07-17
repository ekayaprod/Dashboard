# Scribe Log

## Execution Details
- Injected JSDoc explaining capture groups for email parsing regex in `js/workers/msg-reader.js`.
- Annotated `LEEWAY_RATIO` magic number in `js/apps/calculator.js` explaining it as a 14.2% downtime buffer based on legacy business rules.
- Aggregated commits `0a858c3` (accessibility aria-labels), `8d019b6` (security HTML filtering regex fix), and `0e77d5d` (UI strict flex layout fix for dashboard) into `CHANGELOG.md`.
- Documented `MAX_DISPLAY_ERRORS` in `js/app-data.js` with historical intent (PR #274) and AST execution reasoning.
- Documented `chunkSize = 1000` in `js/app-ui.js` with historical intent (PR #274) and AST execution reasoning.
- Aggregated commits `b5a5a61` (amnesiac state loops fix) and `631b190` (lookup active voice) into `CHANGELOG.md`.

## Discoveries
- Successfully mapped undocumented configurations using `git log -S` and `git show --patch` context.
