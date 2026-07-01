# ⚡ Sidebar Productivity Suite

[![node: >=20.0.0](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![build: zero-config](https://img.shields.io/badge/build-zero--config-blue)](https://github.com/)

The **Sidebar Productivity Suite** is a high-velocity, modular application collection engineered exclusively for restricted environments like the Microsoft Edge Sidebar.

No backend. No build steps. Pure client-side execution leveraging `localStorage` for aggressive data persistence.

## 🚀 Quick Start

Drop the friction. Get it running in seconds:

```bash
git clone <repo-url>
cd sidebar-productivity-suite
npm ci # Pull in dev dependencies (Vitest, JSDOM)
python3 -m http.server 8000 # Spin up a static server
```

Point your browser to `http://localhost:8000/index.html`.

## 🧪 Testing

We don't guess. We verify. The suite is tested natively via **Vitest**.

```bash
npm test               # Execute the Vitest suite
npm run test:coverage  # Generate a comprehensive V8 coverage report
```

## 🏗️ System Architecture

The suite operates on a strict **Shell Architecture**, eliminating the need for complex bundlers.

* **The Shell (`index.html`)**: The core host environment. It maintains the persistent navigation bar and sandboxes active applications into isolated `iframes`.
* **Zero-Build Execution**: Written in native ES6+ JavaScript and CSS variables. It demands no transpilation.
* **Bootstrapper (`js/bootstrap.js`)**: A custom dependency loader enforcing strict sequential execution across core libraries (`app-core.js`, `app-data.js`, `app-ui.js`) before emitting a `bootstrap:ready` event.

## 🧰 The Applications

1. **Dashboard (`dashboard.html`)**
   The command center. It features a dynamic app registry, a `QuickListManager` shortcut subsystem, and an integrated `NotepadManager` for persistent multi-note scratchpad capabilities.
2. **Calculator (`calculator.html`)**
   A ruthless shift pacing engine (v3.8.2). It computes real-time progress against defined grade boundaries using a Safe Zone Countdown. A proprietary Strategy Engine actively assesses total productive minutes versus breakpoints to optimize end-of-day metrics via actionable 'Quick Fix' suggestions.
3. **Lookup (`lookup.html`)**
   A flat-file local reference database. It leverages a custom `SearchHelper` for hybrid, async-optimized client-side keyword indexing. It also supports custom search URL templates (e.g., `https://my-kb.com/search?q={query}`) to bridge local records with external knowledge bases.
4. **MailTo (`mailto.html`)**
   Generates nested `mailto:` templates. The application utilizes a recursive `TreeUtils` architecture to manage a comprehensive template library structure. Crucially, it offloads binary parsing of `.msg` files to a dedicated web worker (`js/workers/msg-reader.js`) to keep the main thread entirely unblocked.
5. **Passwords (`passwords.html`)**
   A cryptographically secure passphrase generator utilizing `window.crypto` (with robust fallbacks to `Math.random`). It supports configurable structures (e.g., Adjective-Noun-Verb) and intelligently maps temporal offsets to dynamic seasonal word banks (e.g., Winter, Spring, Summer, Autumn) fetched asynchronously via `Promise.all`.

## 💾 State Management

Data persistence doesn't need to be complicated. We use `localStorage` aggressively.
Our `AppLifecycle` factory provides versioned configurations, automatic fallback mechanisms for corrupted JSON states, and atomic saves to ensure structural integrity across sessions.
