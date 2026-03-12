# 👁️ AUDIT

## ⚡ Performance Bottlenecks

- [ ] `js/apps/lookup.js` exceeds 1100 lines and is approaching 50KB size limit.
- [ ] `js/app-core.js` and `js/apps/passwords.js` exceed 800 lines.

## 🛡️ Security Radar

- [ ] `package.json` contains 1 high severity vulnerability in `rollup`.

## 🧹 Debris Field

- [ ] `console.log` instances remain in `js/apps/mailto.js`, `dashboard.js`.

## 🕵️ Coverage Gaps

- [ ] `js/apps/calculator.js` (697 lines) lacks corresponding test files.
- [ ] `js/apps/mailto.js` (771 lines) lacks corresponding test files.

## 🧼 Dependency Decay

- [ ] `jsdom` dependency is outdated (Current: 24.1.3, Latest: 28.1.0).

## 📣 Release Drift

- [ ] False test coverage reporting (3.81%) masks actual coverage drift.

## 🧭 UX Friction

- [ ] Icon-only buttons lack `aria-label` for screen reader support.
