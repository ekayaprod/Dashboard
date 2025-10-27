Client-Side Workflow Suite
A collection of browser-based productivity tools for personal workflow management. This suite is built with vanilla JavaScript, contains no frameworks, and runs entirely in the client with no backend. Persistence is achieved via the browser's localStorage.
Core Architecture
The suite is designed as a multi-page application (MPA) with a shared component library. All pages share a common stylesheet (style.css) and a core JavaScript utility module (ui.common.js).
Dynamic Navigation
The navigation bar is not static. It is dynamically loaded into each page at runtime.
A central HTML fragment, _nav.html, defines the complete navigation structure. This is the single source of truth for all links.
The ui.common.js file provides a UIUtils.loadNavbar(containerId, currentPage) function.
On page load, each HTML file's script calls this function.
The function fetches the content of _nav.html, injects it into the page's <div id="navbar-container"></div>, and automatically applies the .active class to the link matching the currentPage argument.
To add a new page to the application, one only needs to add the new link to _nav.html and create the new page from template.html.
Shared Utilities (ui.common.js)
All shared logic is centralized in the UIUtils object. This module is the core of the application's functionality.
State Management: The module provides a UIUtils.createStateManager(key, defaults, version) factory function. This is the core persistence layer.
It abstracts all localStorage interactions (getItem, setItem).
It handles all JSON.stringify and JSON.parse operations, including error handling for corrupted data.
The returned load() and save() methods are used by each page to manage its own state.
UI Components: Programmatic helpers for building the interface, including UIUtils.showModal(), UIUtils.showToast(), and a library of UIUtils.SVGIcons.
File Handlers: Utilities for the Backup/Restore feature, including UIUtils.downloadJSON(), UIUtils.openFilePicker(), and UIUtils.readJSONFile().
DOM & Validators: A set of helper functions for common tasks, such as UIUtils.escapeHTML(), UIUtils.generateId(), UIUtils.debounce(), and input UIUtils.validators.
State Isolation
Each application page (index.html, lookup.html) is fully self-contained and manages its own state. There is no shared application state. index.html saves its data to the dashboard_state_v5 key in localStorage, while lookup.html saves its data to the lookup_data key.
File Structure & Responsibilities
The project is structured as follows:
_nav.html Purpose: A partial HTML fragment. This is the single source of truth for the global navigation bar. It is loaded by ui.common.js into all other pages.
index.html (Dashboard) Purpose: The main application hub. State Key: dashboard_state_v5 Features:
Shortcuts: Manages a list of quick-access links with drag-and-drop reordering.
Applications: A CRUD interface for managing application data (URLs, notes). Features a search-as-you-type dropdown for selection.
Notepad: A multi-note text editor with create, rename, and delete capabilities.
lookup.html (Lookup) Purpose: A two-column knowledge base for routing information and text snippets. State Key: lookup_data Features:
Routing: Manages keyword-to-content mappings (e.g., "VPN" -> "Tier 2 Support").
Snippets: Manages keyword-to-snippet mappings for quick copy-paste.
Shared Features: Real-time filtering, inline editing, and copy-to-clipboard functionality.
ui.common.js (Shared Utilities) Purpose: The core JavaScript library for the entire suite. Provides all state management, UI generation, and utility functions (see Core Architecture).
style.css (Shared Stylesheet) Purpose: A single, unified stylesheet providing all visual styling. Features:
Uses CSS variables for a compact layout.
Includes a light/dark theme managed by the prefers-color-scheme media query.
Contains shared styles for all components (modals, buttons, inputs, etc.) and page-specific layouts.
template.html (New Page Boilerplate) Purpose: A pre-configured template for creating new pages. It includes all necessary CSS/JS links and the UIUtils.loadNavbar() call.
old.html (Legacy) Purpose: The original, single-page version of the Dashboard. It is no longer part of the active application but is kept for reference. Its backup/restore format is compatible with index.html.
README.md Purpose: This documentation file.
Core Application Workflows
1. Page Load Workflow
DOMContentLoaded event fires.
The page's init() function is called.
UIUtils.loadNavbar() is called, which fetches _nav.html, injects it into the #navbar-container div, and sets the .active class on the current page's link.
UIUtils.createStateManager() is called with the page's unique localStorage key.
stateManager.load() is called, which retrieves and parses the JSON data from localStorage.
renderAll() is called to populate the UI with the loaded state data.
2. Data Persistence Workflow
A user action modifies data (e.g., adding a shortcut, saving a note, deleting an application).
The event handler updates the in-memory state object.
The saveState() helper function is called.
stateManager.save() stringifies the entire state object and writes it to its key in localStorage.
Note: The notepad in index.html also features a 500ms debounced auto-save on input and an immediate save on blur.
3. Backup & Restore Workflow
Backup: The user clicks a "Backup" button.
The page's current state object is retrieved, wrapped in metadata (app name, timestamp), and stringified.
UIUtils.downloadJSON() is called to trigger a browser download of the .json file.
Restore: The user clicks a "Restore" button.
UIUtils.openFilePicker() prompts the user to select a file.
UIUtils.readJSONFile() reads the file's text content.
A page-specific handleRestore() function parses the JSON, validates its structure (checking for required arrays like apps, notes, shortcuts), and asks for user confirmation via UIUtils.showModal().
Upon confirmation, the current state object is replaced, saveState() is called to persist it to localStorage, and renderAll() is called to refresh the UI.
