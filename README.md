# Client-Side Workflow Suite

A collection of browser-based productivity tools for personal workflow management. Built with vanilla JavaScript, no frameworks, no backend.

## Architecture Overview

### Core Files

**`style.css`** - Unified stylesheet
- Component library (buttons, modals, forms, layouts)
- Light/dark theme system (respects `prefers-color-scheme` and manual `data-theme` toggle)
- Page-specific overrides for dashboard and lookup tools

**`ui.common.js`** - Shared utilities
- `UIUtils.showModal()` - Confirmation dialogs and alerts
- `UIUtils.showToast()` - Non-blocking notifications
- `UIUtils.escapeHTML()` - XSS prevention helper
- `UIUtils.generateId()` - UUID generation
- `UIUtils.copyToClipboard()` - Clipboard API wrapper
- `UIUtils.downloadJSON()` - File download helper
- `UIUtils.openFilePicker()` - File input trigger
- `UIUtils.debounce()` - Input debouncing
- `UIUtils.validators` - Common validation functions
- `UIUtils.SVGIcons` - Icon library
- `UIUtils.initTheme()` - Theme persistence and toggle

### Application Pages

Each HTML file is self-contained with embedded JavaScript and links to shared resources.

---

## dashboard.html

**Purpose:** Central hub for application management, quick-access shortcuts, and note-taking.

**Storage Key:** `dashboard_state_v5`

### Features

**Shortcuts**
- Quick-access link tiles
- Drag-and-drop reordering
- Add/delete operations

**Applications**
- CRUD interface for managing application entries
- Search-as-you-type filtering
- Multi-line URL storage per application
- Notes field for additional context

**Notepad**
- Multi-note manager with dropdown selector
- Create, rename, delete notes
- Auto-save on input (500ms debounce)
- Blur-save fallback to prevent data loss

**Backup/Restore**
- Export full state to JSON
- Import previously exported backups
- Validation on restore with detailed error messages

### State Structure
```javascript
{
  apps: [{id, name, urls, escalation}],
  notes: [{id, title, content}],
  shortcuts: [{id, name, url}],
  version: "5.3.0"
}
lookup.html
Purpose: Two-column knowledge base for routing information and text snippets.
Storage Key: lookup_data
Features
Two-Column Layout
Routing: Keyword → Assignment/Team mappings
Snippets: Keyword → Template text (for copy-paste workflows)
Search
Real-time filtering across both columns
Highlights matching terms
Empty state shows "Add this keyword" quick-action
Inline Editing
Click-to-edit interface
Forms remain visible during search to prevent accidental data loss
Duplicate keyword validation
Blank field validation
File Operations
Backup: Full state export with metadata (app name, timestamp, version)
Restore: Intelligent file parser supporting:
Current backup format
Legacy assignment_tool backups (migration path)
Data-only JSON exports with merge/replace modal
Entry Mode
Search for non-existent keyword → Shows "Add [keyword]" button
Pre-fills keyword field, focuses content field
Mimics workflow from original PowerShell script
State Structure
{
  routingData: [{id, keyword, content}],
  snippetsData: [{id, keyword, content}]
}
template.html
Boilerplate for creating new pages with proper integration of style.css and ui.common.js.
Design Constraints
Intentional Simplifications
No Undo System
Previous versions included toast-based undo for deletions
Removed to reduce code complexity
All destructive actions now require UIUtils.showModal() confirmation
State Isolation
Each page manages its own localStorage namespace
No cross-page data access
Backup/restore is the only data portability mechanism
No Backend
Entire suite runs client-side
LocalStorage is the only persistence layer
Users must manually backup data for safety
Recent Refactoring
The codebase was consolidated to eliminate duplication:
Inline <style> blocks moved to style.css
Duplicated utility functions centralized in ui.common.js
Removed features: Options modal, recommended file path display, backdrop blur effects
Development Notes
Adding a New Page
Copy template.html
Update <title> and LOCAL_STORAGE_KEY
Define defaultState structure
Implement page-specific logic in the <script> block
Add navigation links in other pages' .tabs-container
Browser Compatibility
Requires crypto.randomUUID() (Chrome 92+, Firefox 95+, Safari 15.4+)
Fallback provided in ui.common.js for older browsers
Uses localStorage (all modern browsers)
Clipboard API requires HTTPS or localhost
Performance Considerations
Lookup data sorted on save, not on render
DocumentFragment used for bulk DOM updates
Debounced auto-save (500ms) with immediate blur-save fallback
Search filtering happens in-memory (no DOM queries in loop)
File Structure
├── dashboard.html        # Main application hub
├── lookup.html          # Knowledge base tool
├── template.html        # New page boilerplate
├── style.css            # Shared styles and themes
├── ui.common.js         # Shared utilities
└── README.md            # This file
Usage
Open any HTML file directly in a browser (no server required)
Data persists in localStorage per-origin
Use Backup buttons to export data as JSON
Keep backups safe - clearing browser data will erase all content
Known Limitations
Data is not synced across devices
LocalStorage has ~5-10MB limit per origin
No collaboration features
No search history or analytics
Import/Export is manual process (no auto-sync)
Version History
v5.3.0 - Current
Centralized utilities in ui.common.js
Unified theme system
Removed undo feature
Enhanced validation and error messages
v5.4.0 (lookup.html only)
Edit state preserved during search
Undo stack for multiple deletions
Duplicate keyword validation
Merge/Replace import options
Input validation (blank fields)
Copy feedback ("Copied!" message)
