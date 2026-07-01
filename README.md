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

1. **Dashboard (`dashboard.html`)**: The command center. Features a dynamic app registry, quick shortcuts, and a multi-note persistent scratchpad.
2. **Calculator (`calculator.html`)**: A ruthless shift pacing engine. Computes real-time progress against defined grade boundaries to optimize end-of-day metrics.
3. **Lookup (`lookup.html`)**: A flat-file local reference database optimized for instant client-side keyword filtering.
4. **MailTo (`mailto.html`)**: Generates nested `mailto:` templates. Crucially, it offloads binary parsing of `.msg` files to a dedicated web worker (`js/workers/msg-reader.js`) to keep the main thread unblocked.
5. **Passwords (`passwords.html`)**: A cryptographically secure passphrase generator utilizing `window.crypto`. Supports seasonal word banks and configurable constraints via environment configurations (e.g., `NUM_PASSWORDS_TO_GENERATE`).

## 💾 State Management

Data persistence doesn't need to be complicated. We use `localStorage` aggressively.
Our `AppLifecycle` factory provides versioned configurations, automatic fallback mechanisms for corrupted JSON states, and atomic saves to ensure structural integrity across sessions.
