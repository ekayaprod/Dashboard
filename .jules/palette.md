# Palette's UX Journal

This journal tracks critical UX and accessibility learnings for the Sidebar Productivity Suite.

## 2024-05-22 - Reusable Component Accessibility
**Learning:** The `QuickListManager` component dynamically generates list items with delete buttons but lacked `aria-label` support, making it inaccessible to screen readers across all instances (Dashboard Shortcuts, etc.).
**Action:** When creating reusable list components in `js/app-ui.js`, always ensure action buttons (especially icon-only ones) include dynamic `aria-label` attributes derived from the item's content.
