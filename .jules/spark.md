# Spark - The Visionary & Innovation Lead

## 2025-03-05 - 💡 Spark - [Architecture] Unify ID Generation

**Learning:** The application uses custom, brute-force ID generation in `js/app-core.js` (`UIUtils.generateId` fallback). This reinvented wheel is vulnerable to collisions in high-concurrency or rapid looping, and introduces unnecessary entropy management overhead. A stable industry standard could simplify and secure this architecture.
**Action:** Always scan for custom math/randomized utilities and evaluate if a dedicated, battle-tested library (like `nanoid`) could eliminate the technical debt and collision risk.

## 2026-03-12 - 💡 Spark - [Architecture] Migrate Storage from `localStorage` to IndexedDB

**Learning:** The application relies on a monolithic `localStorage` implementation for global state persistence via `createStateManager`. This creates a severe structural bottleneck, as `localStorage` operations are strictly synchronous, blocking the main thread during heavy JSON serialization/deserialization, while also imposing a rigid ~5MB storage cap that inherently limits data-rich utilities like Lookup.
**Action:** Identify and flag synchronous state management bottlenecks in the architecture, proposing migrations to asynchronous APIs like IndexedDB (via wrappers like `idb` or `localforage`) to unlock fluid UI responsiveness and robust storage limits.
