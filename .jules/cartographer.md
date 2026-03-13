# Cartographer Journal
## 2024-03-05 - 🗺️ Cartographer - Initial Ecosystem Mapping
**Learning:** The application utilizes a "Shell Architecture" centered around `index.html` communicating via `postMessage` with application `iframes`. The core functionality is highly modularised into `app-core.js`, `app-data.js` and `app-ui.js` using the Module Pattern, which are sequentially loaded by a bespoke dependency bootstrapper (`bootstrap.js`). Mailto app utilizes a Web Worker boundary for off-main-thread binary `.msg` processing.
**Action:** Created `C4Component` diagrams in `ARCHITECTURE.md` specifically visualizing the Dashboard and MailTo application boundaries, to clearly establish their dependency on the underlying `app-core.js` and `app-ui.js` modules, as well as their relationship with `localStorage` and system level interfaces. Next mappings should detail the Lookup app's internal hybrid search boundary.

## 2024-03-06
**Title**: Lookup and Passwords Sub-System Component Map
**Learning**: Mapped remaining suite applications. Lookup app relies heavily on client-side JS objects (`LookupHelpers`, `LookupRenderer`, `LookupCSV`) for structural domain management, and queries an indexed memory model via `SearchHelper`. Passwords app utilizes a standalone data structure decoupled from standard UI inputs, accessing local `wordbanks/*.json` dynamically to inject entropy alongside `window.crypto` for passphrase generation.
**Action**: Created `C4Component` diagrams in `ARCHITECTURE.md` to map out the component boundaries, explicitly detailing asynchronous data fetches for static JSON files (Passwords) and custom external Knowledge Base URL templating workflows (Lookup).
