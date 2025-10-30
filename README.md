Dashboard & Tools Suite

1. Project Overview

This is a multi-page browser application designed for use in a sidebar environment. It provides two primary tools, "Dashboard" and "Lookup," which run as independent, stateful applications. All data is stored locally in the browser's localStorage.

The project also includes a developer template (template.html) for scaffolding new pages.

2. Core Architecture

The entire project is built on a shared, modular foundation.

3-File JavaScript Library

All shared logic is modularized into three files, which are loaded on every page:

js/app-core.js: The application foundation. It contains all low-level utilities (DOM helpers, modal/toast UI, validators, debounce functions) and the AppLifecycle bootstrap module.

js/app-ui.js: Contains high-level, reusable UI patterns, such as UIPatterns.confirmDelete and components like ListRenderer and SearchHelper.

js/app-data.js: Handles all data persistence logic, including the BackupRestore module (for JSON backups) and DataValidator (for checks like hasDuplicate).

"Smart" Navbar (navbar.html)

The navbar.html file is loaded via fetch() on every page and acts as a self-contained component.

Global UI Provider: It contains the master HTML for all global UI elements, specifically the modal overlay (#modal-overlay) and the toast notification (#toast). This prevents code duplication on every page.

Self-Activating Links: It includes an inline script that checks the window's current URL (window.location.pathname) and automatically applies the .active class to the correct navigation link.

3. Page-Specific Architecture

index.html (Dashboard)

This page is a multi-purpose dashboard for managing application links, shortcuts, and notes.

State: All data is saved to localStorage under the dashboard_state_v5 key.

Features:

Applications: A list of applications managed via a <select> dropdown. Each app can have "App Notes / Escalation" and a list of URLs. New apps can be created, which dynamically shows an "App Name" field.

Shortcuts: A separate list of quick-access URLs, which supports drag-and-drop reordering.

Notepad: A standalone, multi-document notepad with its own UI for creating, renaming, and deleting notes. This is a core feature and is functionally separate from the "App Notes".

lookup.html (Lookup)

This is a "dual-search" tool that searches both an external KnowledgeBase and an internal database simultaneously.

Storage & State

Storage: All data is stored in localStorage under the lookup_v2_data key.

State Model:

state.settings: An object holding the user-configured kbBaseUrl.

state.items: An array of objects representing the local database (schema: id, keyword, assignmentGroup, notes, phoneLogPath).

Core Functions

KB Search: Takes the search term and inserts it into the kbBaseUrl template (configured in the ⚙️ Settings modal) to generate a dynamic "Search KB" link.

Local DB Search: Searches the state.items array for the term.

UI Modes: "Search" vs. "Edit"

The UI has two distinct modes controlled by the isEditMode flag:

Search Mode (Default):

The local results list is filtered by the search term.

If a search yields zero results, a + Create Entry button appears, which pre-fills the new item's keyword with the search term (replicating the PowerShell script's "create on not found" logic).

Edit Mode ("Override"):

The search term is ignored.

The local results list displays every single item from state.items, sorted alphabetically, rendered as in-line edit forms (createEditForm).

Data Integrity (PowerShell Logic Adaptation)

The page replicates the core data-integrity logic from the AssignmentGroupTool.ps1 script:

"Merge on Duplicate" Workflow: When a user saves an entry, the handleSave() function checks if the assignmentGroup already exists in another entry.

If it does, the save is stopped, and a modal is shown with three choices:

[Abort]: Cancels the save.

[Continue (Create New)]: Saves the form as a new, separate entry (allowing duplicates).

[Merge Keywords]: The smart default. It merges the new keywords with the existing entry's keywords and then discards the new entry.

Data Management (Two-Tier System)

User-Friendly (CSV): The main "Import..." and "Export..." buttons. This is the primary method for bulk editing (the "open in Excel" workflow).

handleExportCSV: Converts the state.items array to a .csv file.

handleImportCSV: Parses a .csv file and overwrites the state.items array.

Technical (JSON): Hidden inside the "Settings" (⚙️) modal.

handleBackup: Creates a JSON snapshot of the entire state (items + settings) for disaster recovery.

handleRestore: Restores the application from a JSON backup.

4. Key Design Patterns & Workarounds

AppLifecycle.initPage: This is the core bootstrap function in app-core.js. It is called by every page and is responsible for:

Caching all required DOM elements.

Loading the navbar.html component.

Loading the page's state from localStorage (via createStateManager).

"Jekyll-Proof" Filename: The navigation bar file is named navbar.html (not _nav.html). This prevents GitHub Pages (which uses Jekyll) from ignoring the file during its build process.

localStorage Isolation: Each page (index.html, lookup.html) manages its own state under its own unique localStorage key. This prevents data corruption between the tools.

CSS resize: none: All textarea elements have manual resizing disabled in style.css and are controlled by the DOMHelpers.setupTextareaAutoResize function for a cleaner UI.
