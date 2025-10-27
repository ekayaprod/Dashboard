Client-Side Workflow Suite
A collection of browser-based productivity tools for personal workflow management. Built with vanilla JavaScript, no frameworks, no backend.
Architecture Overview
Core Files
style.css - Unified stylesheet
Component library (buttons, modals, forms, layouts)
Light/dark theme system (respects prefers-color-scheme)
Page-specific overrides for dashboard and lookup tools
ui.common.js - Shared utilities
UIUtils.showModal() - Confirmation dialogs and alerts
UIUtils.showToast() - Non-blocking notifications
UIUtils.escapeHTML() - XSS prevention helper
UIUtils.generateId() - UUID generation
UIUtils.copyToClipboard() - Clipboard API wrapper
UIUtils.downloadJSON() - File download helper
UIUtils.openFilePicker() - File input trigger
UIUtils.readJSONFile() - (New) File reader abstraction
UIUtils.createStateManager() - (New) localStorage abstraction
UIUtils.debounce() - Input debouncing
UIUtils.validators - Common validation functions
UIUtils.SVGIcons - Icon library
Application Pages
Each HTML file is self-contained with embedded JavaScript and links to shared resources.
index.html (Formerly dashboard.html)
Purpose: Central hub for application management, quick-access shortcuts, and note-taking.
Storage Key: dashboard_state_v5
Features
Shortcuts
Quick-access link tiles
Drag-and-drop reordering
Add/delete operations
Applications
CRUD interface for managing application entries
Search-as-you-type filtering with dropdown selection
Multi-line URL storage per application
Notes field for additional context
Notepad
Multi-note manager with dropdown selector
Create, rename, delete notes
Auto-save on input (500ms debounce)
Blur-save fallback to prevent data loss
Backup/Restore
Export full state to JSON
Import previously exported backups
Validation on restore with detailed error messages
State Structure
{
  apps: [{id, name, urls, escalation}],
  notes: [{id, title, content}],
  shortcuts: [{id, name, url}],
  version: "6.1.0" // Updated
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
State Structure
{
  routingData: [{id, keyword, content}],
  snippetsData: [{id, keyword, content}],
  version: "6.1.0" // Updated
}


template.html
Boilerplate for creating new pages with proper integration of style.css and ui.common.js, including the shared state manager.
Design Constraints
Intentional Simplifications
No Undo System: All destructive actions now require UIUtils.showModal() confirmation.
State Isolation: Each page manages its own localStorage namespace. Backup/restore is the only data portability mechanism.
No Backend: Entire suite runs client-side. LocalStorage is the only persistence layer. Users must manually backup data for safety.
Recent Refactoring (v6.0.0+)
Centralized utilities in ui.common.js.
Unified theme system (uses prefers-color-scheme).
Removed undo feature entirely.
Enhanced validation and error messages across both apps.
Consolidated state management and file reading logic into ui.common.js.
Streamlined lookup.html rendering logic.
Removed unused CSS and non-functional JS code paths.
Development Notes
Adding a New Page
Copy template.html.
Update <title>, LOCAL_STORAGE_KEY, and APP_VERSION.
Define the defaultState structure for the page.
Implement page-specific logic (rendering, event listeners) within the DOMContentLoaded listener.
Add navigation links in index.html and lookup.html's .nav-links.
Browser Compatibility
Requires crypto.randomUUID() (fallback provided in ui.common.js).
Uses localStorage (all modern browsers).
Clipboard API requires HTTPS or localhost.
Performance Considerations
Lookup data sorted on save, not on render.
DocumentFragment used for bulk DOM updates.
Debounced auto-save (500ms) with immediate blur-save fallback.
Search filtering happens in-memory.
File Structure
├── index.html           # Main application hub
├── lookup.html          # Knowledge base tool
├── template.html        # New page boilerplate
├── style.css            # Shared styles and themes
├── ui.common.js         # Shared utilities
└── README.md            # This file


Usage
Open any HTML file directly in a browser (no server required).
Data persists in localStorage per-origin.
Use "Backup" buttons to export data as JSON.
Keep backups safe - clearing browser data will erase all content.
Known Limitations
Data is not synced across devices.
LocalStorage has ~5-10MB limit per origin.
No collaboration features.
No search history or analytics.
Import/Export is a manual process (no auto-sync).
Version History
v6.1.0 (Current - Post-Review)
Implemented Modes A, B, C, D, E fixes.
Hardened startup reliability (DOM checks, UIUtils checks).
Fixed functional bugs (drag-drop, dirty-select, last note delete).
Optimized structure (cached DOM, consolidated functions).
Consolidated logic (StateManager, FileReader).
Removed dead code/CSS and updated documentation.
v6.0.0 (Pre-Review)
Centralized utilities in ui.common.js.
Unified theme system (uses prefers-color-scheme).
Removed undo feature.
Enhanced validation and error messages.
Added search dropdown to index.html.
Refined lookup.html edit state preservation during search.
Added duplicate keyword validation to lookup.html.
Added merge/replace import options to lookup.html.
