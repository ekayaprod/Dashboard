# Untangler's Journal

## 2026-02-19
- **God Function Found**: `js/apps/lookup.js`, `initializePage`, ~800 lines.
- **Strategy**: Extracted `LookupSettings` object to handle settings modal logic (import/export/custom search), moving ~150 lines out of `initializePage`. Created `LookupHelpers.modalActions` to standardize modal button configurations.
- **Result**: Reduced `initializePage` complexity significantly, decoupling settings logic.

## 2026-02-19 (Later)
- **God Function Found**: `js/apps/passwords.js`, `initializePage`, ~920 lines.
- **Strategy**: Extracted `PasswordLogic` (pure logic), `PasswordUI` (DOM manipulation), and `PasswordSettings` (modal logic) into file-level objects. Extracted constants (`APP_CONFIG`, `SEASON_CONFIG`, `PHRASE_STRUCTURE_CONFIG`) to top-level.
- **Result**: Flattened `initializePage` nesting, separated concerns, and enabled unit testing of logic components. Added comprehensive tests in `js/__tests__/passwords.test.js`.
