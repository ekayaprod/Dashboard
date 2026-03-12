1. **Deduplicate Code in `js/__tests__/list-renderer.test.js`**
   - The exact clone found by jscpd (`js/__tests__/list-renderer.test.js` [63:47 - 71:5] vs [49:44 - 57:6]) involves calling `window.ListRenderer.renderList`.
   - Action: create a local helper function `renderWithAppend(append)` inside the test suite and replace the duplicated blocks. This handles the jscpd failure.

2. **Deduplicate `DOMHelpers.createOption` logic**
   - Across `mailto.js`, `calculator.js`, and `passwords.js`, there are multiple instances where `document.createElement('option')` is followed by setting `value` and `textContent`/`innerHTML`.
   - Action: Add `createOption(value, text, { disabled, selected, title } = {})` to `DOMHelpers` in `js/app-core.js`. (Actually, I need to check the prompt's rules carefully: `DOMHelpers` is in `app-core.js`). Or maybe keep it strictly to the test file if I don't need global helpers? The instructions say "ruthlessly hunt down duplicated logic and abstract it into perfectly pure, centralized global utilities or highly focused, parameterized local helpers... Prioritize deduplication within three critical domains: Validation Schemas, Rendering/UI Wrappers, and pure I/O logic." Creating UI wrappers for options is Rendering/UI Wrappers. Let's do it.

3. **Check for Semantic Near-Clones**
   - Any other UI wrappers? I will use `grep -rn "document.createElement" js/` to see. `document.createElement('div')` and `document.createElement('button')` are common.
   - We will implement `DOMHelpers.createElement(tag, attributes)` to wrap `document.createElement` + attribute assignment if appropriate, or just the option one. Actually, just `DOMHelpers.createOption` is cleaner.

4. **Verify and Pre-commit**
   - Run type checker and tests. Ensure type checker linter (`tsc` is not available, so I will skip this if not found, memory says `The development environment lacks tsc`).
   - Run `pre_commit_instructions` and follow them.
   - Submit.
