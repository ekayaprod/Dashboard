# Palette's UX Journal

This journal tracks critical UX and accessibility learnings for the Sidebar Productivity Suite.

## 2024-05-22 - Reusable Component Accessibility
**Learning:** The `QuickListManager` component dynamically generates list items with delete buttons but lacked `aria-label` support, making it inaccessible to screen readers across all instances (Dashboard Shortcuts, etc.).
**Action:** When creating reusable list components in `js/app-ui.js`, always ensure action buttons (especially icon-only ones) include dynamic `aria-label` attributes derived from the item's content.

## 2024-10-24 - Accessible Accordions
**Learning:** Accordions in this project were implemented as raw `div`s with click handlers, making them inaccessible to keyboard users.
**Action:** Standardized pattern: `role="button"`, `tabindex="0"`, `aria-expanded`, and `keydown` listener for Enter/Space. Added `.accordion-header:focus-visible` style for visual feedback.
