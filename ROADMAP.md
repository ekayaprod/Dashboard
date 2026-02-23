# 🗺️ Product Roadmap

## Status Key
- ✅ **Completed**: Feature is shipped and stable.
- 🚧 **In Progress**: Currently under active development.
- 📅 **Planned**: Prioritized for future release.
- 🧊 **Backlog**: Ideas for consideration.

## ✅ Completed (v1.0)
### Core Architecture
- **Shell Architecture**: `index.html` as the main entry point with persistent navbar and iframe loading.
- **Bootstrapper**: `js/bootstrap.js` for centralized dependency management and execution order.
- **Core Libraries**: `js/app-core.js` (Lifecycle, SafeUI), `js/app-data.js` (Backup/Restore, CSV), `js/app-ui.js` (Components).

### Applications
- **Dashboard**: Application launcher, quick actions, scratchpad.
- **Calculator**: Shift pacing calculator with visual targets and optimization strategy engine.
- **Lookup**: Local knowledge base search.
- **MailTo**: Email template generator with `.msg` parsing.
- **Passwords**: Secure passphrase generator with seasonal word banks and presets.

### Documentation & Maintenance
- **Documentation & Alignment**: Syncing roadmap, clarifying core functions, and establishing the Chronicler's journal.
- **Navigator Setup**: Established Navigator persona and process.

## ✅ Completed (v1.2)
- **Passwords Polish**: Enhanced UI with accessibility, motion, and optimistic feedback.
- **Calculator Polish**: Elevated UI to Premium status.
- **Lookup Optimization**: Refactored `js/apps/lookup.js` to flatten logic and extract helpers.
- **Mailto Debugging**: Enriched worker error logs.
- **Code Hygiene**: Removed dead code in `bootstrap.js`.

## ✅ Completed (v1.1)
- **Accessibility**: Added `aria-label` to icon-only buttons in `dashboard.html`.

## 🚧 In Progress
- **Architectural Refactoring**: Modularize `js/apps/lookup.js` as it approaches 50KB size limit.

## 📅 Planned
- **Accessibility Improvements**:
    - Ensure high contrast compliance.

## 🧊 Backlog
- **Future Optimizations**: Further performance tuning and code consolidation.
- **Mobile Responsiveness Enhancements**: Improve layout stacking and touch targets for mobile devices.
