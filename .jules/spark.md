## 2025-03-05 - 💡 Spark - [Architecture] Unify ID Generation
**Learning:** The application uses custom, brute-force ID generation in `js/app-core.js` (`UIUtils.generateId` fallback). This reinvented wheel is vulnerable to collisions in high-concurrency or rapid looping, and introduces unnecessary entropy management overhead. A stable industry standard could simplify and secure this architecture.
**Action:** Always scan for custom math/randomized utilities and evaluate if a dedicated, battle-tested library (like `nanoid`) could eliminate the technical debt and collision risk.
