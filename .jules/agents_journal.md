## 2024-05-24 - 🦎 Chameleon - Initializations
**Learning:** Initializing the daily process to mutate UI elements to add tactile feedback.
**Action:** Starting with `button` and `a` tags across the application.

## 2026-03-06 - 🦎 Chameleon - Interactive States Mutated: Global UI Components
**Learning:** Found flat interactive elements across the application (e.g., buttons, inputs, links) that lacked comprehensive pseudo-class styling (`hover:`, `focus-visible:`, `active:`, `disabled:`). Many components used the less accessible `focus:` pseudo-class, and elements like `.btn-success` were missing hover colors entirely.
**Action:** Splice distinct accessible styling (`focus-visible:`, `active:`) into `.btn`, `.form-control`, and `.nav-link` classes within `style.css`.
