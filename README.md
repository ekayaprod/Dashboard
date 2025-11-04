Dashboard & Tools Suite
1. Project Overview
This is a multi-page browser application designed for use in a sidebar environment. It provides four primary tools: Dashboard, Lookup, MailTo Generator, and Password Generator. All data is stored locally in the browser's localStorage.
2. Core Architecture
The entire project is built on a shared, modular foundation consisting of three JavaScript libraries and a reusable navigation component. All source code comments that provided architectural context or implementation rationale have been intentionally removed and migrated to this document to maintain code sterility.
3-File JavaScript Library
All shared application logic is modularized into three files, which are loaded on every page:
| File | Responsibility |
|---|---|
| js/app-core.js | Application Foundation. Contains low-level utilities (DOM helpers, modal/toast UI, validators, debounce functions) and the AppLifecycle bootstrap module, which initializes page state and caches DOM elements. It also contains the Dashboard application's startup logic. |
| js/app-ui.js | High-Level UI Patterns. Contains reusable components like UIPatterns (confirmation dialogs, search highlighting), ListRenderer, and SearchHelper. It also contains the core rendering and event handling logic for the Dashboard application. |
| js/app-data.js | Data Persistence. Contains logic for persistence via localStorage, including the BackupRestore module (for JSON backups), DataValidator (duplicate checking), DataConverter (CSV parsing), and CsvManager (CSV import/export workflow). |
Smart Navbar Component (navbar.html)
The navbar.html file is loaded dynamically via fetch() and acts as a self-contained component. It includes a self-activating script that checks window.location.pathname and automatically applies the .active class to the correct navigation link.
3. Page-Specific Architecture
index.html (Dashboard)
Multi-purpose dashboard for managing application links, shortcuts, and notes. Its entire functionality is now housed within the core JavaScript modules (app-core.js and app-ui.js).
Storage Key: dashboard_state_v5
Features:
 * Applications: Managed via dropdown selector. Each app contains URLs and notes.
 * Shortcuts: Quick-access URL list with drag-and-drop reordering.
 * Notepad: Multi-document notepad with create, rename, and delete capabilities.
Data Management: Two-tier system with CSV (user-friendly bulk editing) and JSON (technical disaster recovery) import/export.
lookup.html (Lookup)
Dual-search tool that queries an external KnowledgeBase (KB) and an internal database simultaneously.
Storage Key: lookup_v2_data
State Model:
 * state.settings: Configuration object containing kbBaseUrl (the template URL for external search).
 * state.items: Array of database entries (schema: id, keyword, assignmentGroup, notes, phoneLogPath).
Core Logic:
 * KB Search: Inserts the search term into the kbBaseUrl template to generate a dynamic search link.
 * Local DB Search: Filters state.items array by the search term across all text fields.
UI Modes:
 * Search Mode (Default): Filters results by search term. Shows a "+ Create Entry" button when no results are found, pre-filling the keyword field with the search term.
 * Edit Mode: Displays all items as inline edit forms, ignoring the search filter.
Data Integrity Logic (Merge on Duplicate): When saving an entry, if the assignmentGroup is found to be a duplicate of an existing entry, the system prompts the user to either Merge Keywords (combining keywords into the existing entry and discarding the new one) or Continue (allowing the duplicate). This logic ensures data integrity while preserving the flexibility of the previous system.
mailto.html (MailTo Generator)
Email template library with folder hierarchy and .msg/.oft file upload capabilities.
Storage Key: mailto_library_v1
State Model (Hierarchical):
 * Stored in a single array, state.library, containing both folders and template items.
 * Each folder: {id, type: 'folder', name, children: [...]}
 * Each template: {id, type: 'item', name, mailto: '...'}
Core Workflow:
 * Upload/Input: Parses uploaded Outlook message (.msg/.oft) or accepts manual field input.
 * Field Editing: Allows review and editing of extracted fields (To, CC, BCC, Subject, Body).
 * Generation: Builds the mailto: command and provides a link to test it in the default email client.
Dependencies: Requires the external msgreader.js library for parsing Outlook message files.
passwords.html (Password Generator)
A secure, dual-mode password generator featuring a flexible passphrase system with customizable word banks and seasonal themes.
Storage Key: passwords_v1_data
State Model:
 * state.wordBank: Categorized word lists for passphrase generation (Adjective, Animal, Object, Verb, Color, and seasonal merges).
 * state.phraseStructures: Template rules for word combinations ([["Adjective", "Animal"]]).
 * state.symbolRules: Symbol placement rules (beforeNum, afterNum, junction, end).
Generator Modes:
 * Secure Passphrase: Generates memorable passphrases with configurable structure (word count, separator, capitalization, digits, symbols, seasonal themes).
 * Temporary Password: Generates simple compound words with optional symbols and numbers for quick, disposable use.
Seasonal Logic: The generator can incorporate seasonal words by dynamically merging specialized word banks (Winter, Spring, Summer, Autumn) based on the calculated current date or manual selection.
4. Key Design Patterns & Technical Notes
AppLifecycle.initPage
The core bootstrap function in app-core.js is responsible for:
 * Caching all required DOM elements (converts kebab-case IDs to camelCase properties).
 * Initializing the state from localStorage via createStateManager.
 * Displaying a non-destructive error banner if critical dependencies fail to load.
State Management
Each page manages its own isolated state under a unique localStorage key. Data loss prevention is handled by createStateManager which detects and flags data corruption upon load, resetting the state while preserving a backup of the corrupted data.
Textarea Auto-Resize
All textarea elements have responsive height. This is enforced via DOMHelpers.setupTextareaAutoResize() to prevent manual vertical scrolling of the control itself and ensure consistent UI behavior.
CSV Import/Export Pattern
Implemented via the CsvManager module:
 * Export: Converts the state array to a CSV file with RFC 4180 compliant escaping.
 * Import: Parses CSV data, validates headers and fields, and handles duplicates using page-specific merge/overwrite logic (e.g., the Merge on Duplicate workflow in lookup.html).
5. Browser Requirements
 * Modern browser with ES6 support
 * localStorage enabled
 * Clipboard API for copy operations
 * File API for import/export
 * Crypto API for secure random number generation (used for password generation)
