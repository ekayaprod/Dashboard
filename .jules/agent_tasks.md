# 🤖 Autonomous Agent Tasks

> **Rules of Engagement for Downstream Agents:**
> 1. **DNA Matching:** Scan the board for your specific Archetype (e.g., `[Extractor]`, `[Sentinel]`) or Mechanical Verb (e.g., `SPLICE`, `REMOVE`). If a task matches your mechanical capabilities, claim it.
> 2. **The Out-of-Scope Fallback:** If you review this board and find ZERO tasks that match your specific domain, DO NOT mark out-of-scope tasks as "Blocked" or "False Positive". Instead, ignore this board entirely and initiate your own native discovery scan across the repository to find valid targets.
> 3. Do not delete this file. Sweep resolved `[x]` items on execution.

## 🧱 Structural Monoliths ([Architect] / EXCAVATE)
- [ ] 🏗️ `js/apps/lookup.js`: 1166 lines. Requires domain splitting and colocation.
- [ ] 🏗️ `js/app-core.js`: 1024 lines. Requires domain splitting and colocation.
- [ ] 🏗️ `style.css`: 947 lines. Massive monolithic CSS file requires modularization.
- [ ] 🏗️ `js/apps/passwords.js`: 873 lines. Requires domain splitting and colocation.
- [ ] 🏗️ `js/workers/msg-reader.js`: 782 lines. Requires domain splitting and colocation.
- [ ] 🏗️ `js/apps/mailto.js`: 766 lines. Requires domain splitting and colocation.

## 🧹 Semantic Dust & Console Artifacts ([Pedant] / REMOVE)
- [ ] 🗑️ `js/`: 54 instances of `console.*` found throughout the javascript source. Remove leftover console logs used for debugging.

## 🎨 Hardcoded Hex Colors ([Pedant] / STYLIZE)
- [ ] 🎨 `style.css`: 61 instances of raw hex color codes (`#...`) found. Replace with CSS variables.

## ⚠️ Dangerous DOM Injections ([Triage] / SANITIZE)
- [ ] 🗡️ `js/`: 49 instances of `.innerHTML =` found. Potential XSS vulnerabilities. Convert to `.textContent`, `.createElement()`, or DOMPurify.

## ⏱️ Test Execution Bottlenecks ([Overclock] / OPTIMIZE)
- [ ] ⏳ `js/`: 24 instances of `setTimeout` found. Replace I/O bounds and literal thread-sleeps with fake timers and localized stubs.

## 🕸️ Type Integrity ([Pedant] / TIGHTEN)
- [ ] 🧶 `js/`: 15 instances of `any` types detected in JSDoc comments. Replace with strictly typed definitions.
