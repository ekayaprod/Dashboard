# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### ✅ New
- **Dashboard:** Polished interface with premium interactions.
- **Mailto:** Polished interface with premium interactions and clearer copy.

### 🐛 Fixed
- **Passwords:** Fixed silent failures in local storage persistence.
- **Core:** Resolved swallowed error in state manager corruption handling.

### 🔧 Chores
- **Refactor:** Extracted settings logic in `lookup.js` and reduced cognitive complexity in `passwords.js`.
- **Performance:** Optimized system cache and asynchronous handling.
- **Cleanup:** Removed debug logging across the codebase.
- **Documentation:** Overhauled Calculator app documentation.

## [1.2.0] - 2026-02-19

### ✅ New
- **Passwords:** Enhanced UI with better accessibility, motion, and optimistic feedback.
- **Calculator:** Polished interface with premium interactions and clearer copy.

### 🐛 Fixed
- **Mailto:** Improved error logging in worker threads for better debugging.

### 🔧 Chores
- **Refactor:** Extracted magic numbers and flattened `lookup.js` logic.
- **Cleanup:** Removed dead code from `bootstrap.js` and performed structural cleanup.
- **Documentation:** Updated roadmap and internal reports.

## [1.1.0] - 2026-02-17

### ✅ New
- **Lookup:** Implemented asynchronous search for better performance and smoother loading states.
- **Calculator:** Introduced "Strategy Assistant" to help users min-max their targets.
- **Calculator:** Added loophole detection for "Target Optimization".
- **Mailto:** Offloaded .msg file parsing to a worker thread for improved responsiveness.
- **Architecture:** Added comprehensive `ARCHITECTURE.md` with Mermaid diagrams.
- **Navigator:** Initialized Navigator persona and aligned roadmap.
- **Accessibility:** Added `aria-hidden` to decorative SVGs and keyboard accessibility to accordions.
- **UX:** Enhanced accessibility with `aria-current` and `aria-label` attributes.

### 🐛 Fixed
- **Calculator:** Fixed logic issues including dynamic call time badges and buffer visibility.
- **Sidebar:** Fixed layout grid issues and password accordion scrolling.
- **Mode F:** Verified and fixed regression in Mode F.
- **Dark Mode:** Resolved UI issues for Notepad and Icons in dark mode.
- **Mailto:** Fixed double loading of scripts.

### 🔧 Chores
- **Clean up:** Removed unused `DateUtils` functions. (PR #93)
- **Testing:** Added unit tests for `LookupHelpers`, `DataConverter`, and `MsgReader`.
- **Security:** Implemented security updates and dependency audits.
- **Refactor:** Modernized file reading utilities to use Promises.
- **Performance:** Optimized `escapeHTML` and `getRandomInt`.
- **Documentation:** Updated JSDoc for state manager and `AppLifecycle`.
