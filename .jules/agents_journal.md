## 2024-05-24 - 🦎 Chameleon - Initializations
**Learning:** Initializing the daily process to mutate UI elements to add tactile feedback.
**Action:** Starting with `button` and `a` tags across the application.

## 2026-03-06 - 🦎 Chameleon - Interactive States Mutated: Global UI Components
**Learning:** Found flat interactive elements across the application (e.g., buttons, inputs, links) that lacked comprehensive pseudo-class styling (`hover:`, `focus-visible:`, `active:`, `disabled:`). Many components used the less accessible `focus:` pseudo-class, and elements like `.btn-success` were missing hover colors entirely.
**Action:** Splice distinct accessible styling (`focus-visible:`, `active:`) into `.btn`, `.form-control`, and `.nav-link` classes within `style.css`.

2024-05-28
**Title**: Millisecond Optimization Audit
**Learning**: Codebase is a Vanilla JavaScript application using native DOM APIs without React. No React component trees, `useCallback`, `useMemo`, or inline React style props exist to optimize.
**Action**: [Skip] React render optimizations as they are incompatible with the native stack architecture.

2024-05-29
**Title**: Worker Context Documentation
**Learning**: The Web Worker (`msg-worker.js`) executing the `MsgReader` logic cannot be directly imported or instantiated on the main UI thread. Previous inline examples erroneously suggested synchronous execution, causing confusion.
**Action**: Synthesized a dedicated macro `README.md` for `js/workers/` mapping the execution architecture and cross-linked the worker files strictly via `@see` to enforce the async messaging contract.
## 2026-03-13 - 🎧 Vibe - [SharedSettingsModal Integration]
**Learning:** The application architecture uses `SharedSettingsModal` as a standard pattern across its internal apps (Dashboard, Lookup, Passwords, MailTo) for data export and persistence. If an app lacks this (like the Calculator did), its state persistence is effectively isolated and missing a core platform feature.
**Action:** When inspecting an app's UI elements and initialization flow (`AppLifecycle.initPage`), verify if `window.SharedSettingsModal.init` is missing, and if so, materialize the missing settings button in the DOM and wire the initialization block.
