# Dashboard & Tools Suite

## 1. Project Overview

This is a multi-page browser application designed for use in a sidebar environment. It provides four primary tools: Dashboard, Lookup, MailTo Generator, and Password Generator. All data is stored locally in the browser's localStorage. The project includes a developer template (template.html) for scaffolding new pages.

## 2. Core Architecture

The entire project is built on a shared, modular foundation consisting of three JavaScript libraries and a reusable navigation component.

### 3-File JavaScript Library

All shared logic is modularized into three files, which are loaded on every page:

**js/app-core.js**: The application foundation containing low-level utilities (DOM helpers, modal/toast UI, validators, debounce functions) and the AppLifecycle bootstrap module.

**js/app-ui.js**: High-level, reusable UI patterns including UIPatterns.confirmDelete and components like ListRenderer and SearchHelper.

**js/app-data.js**: Data persistence logic including the BackupRestore module (for JSON backups), DataValidator (duplicate checking), DataConverter (CSV parsing), and CsvManager (CSV import/export workflow).

### Smart Navbar Component (navbar.html)

The navbar.html file is loaded via fetch() on every page and acts as a self-contained component with a self-activating script that checks window.location.pathname and automatically applies the .active class to the correct navigation link.

## 3. Page-Specific Architecture

### index.html (Dashboard)

Multi-purpose dashboard for managing application links, shortcuts, and notes.

**Storage Key**: dashboard_state_v5

**Features**:
- **Applications**: Managed via dropdown selector. Each app contains URLs and notes. The app name field only appears when creating new apps.
- **Shortcuts**: Quick-access URL list with drag-and-drop reordering.
- **Notepad**: Multi-document notepad with create, rename, and delete capabilities. Functionally separate from app notes.

**Data Management**: Two-tier system with CSV (user-friendly bulk editing) and JSON (technical disaster recovery) import/export.

### lookup.html (Lookup)

Dual-search tool that queries an external KnowledgeBase and an internal database simultaneously.

**Storage Key**: lookup_v2_data

**State Model**:
- `state.settings`: Configuration object containing kbBaseUrl
- `state.items`: Array of database entries (schema: id, keyword, assignmentGroup, notes, phoneLogPath)

**Core Functions**:
- **KB Search**: Inserts search term into kbBaseUrl template (configured in Settings modal) to generate dynamic search link
- **Local DB Search**: Filters state.items array by search term

**UI Modes**:
- **Search Mode** (Default): Filters results by search term. Shows "+ Create Entry" button when no results found, pre-filling keyword field with search term.
- **Edit Mode**: Displays all items as inline edit forms, ignoring search filter. Activated via "Edit Mode" button.

**Data Integrity Logic**:

Implements "Merge on Duplicate" workflow inherited from original PowerShell script:
- When saving an entry, handleSave() checks if assignmentGroup already exists
- If duplicate found, shows modal with three options:
  - Cancel: Abort save
  - Continue (Create New): Allow duplicate entry
  - Merge Keywords: Combine keywords with existing entry and discard new entry

**Data Management**: Two-tier system with CSV (primary method for bulk editing) and JSON (disaster recovery via Settings modal).

### mailto.html (MailTo Generator)

Email template library with drag-and-drop .msg/.oft file upload.

**Storage Key**: mailto_library_v1

**State Model**:
- `state.library`: Hierarchical tree structure containing folders and template items
- Each folder: `{id, type: 'folder', name, children: []}`
- Each template: `{id, type: 'item', name, mailto: '...'}`

**Core Workflow**:
1. **Phase 1**: Upload .msg/.oft file or manually enter email fields
2. **Phase 2**: Review and edit extracted fields (To, CC, BCC, Subject, Body)
3. **Phase 3**: Generate mailto: command, test in email client, save to library

**Library Features**:
- Folder organization with breadcrumb navigation
- Templates launch directly via mailto: links
- JSON import/export for library backup

**Dependencies**: Requires msgreader.js library for parsing Outlook message files.

### passwords.html (Password Generator)

Dual-mode password generator with customizable wordbanks.

**Storage Key**: passwords_v1_data

**State Model**:
- `state.wordBank`: Categorized word lists for passphrase generation (Adjective, Animal, Object, Verb, Color, Seasonal)
- `state.phraseStructures`: Template rules for word combinations
- `state.symbolRules`: Symbol placement rules
- `state.tempWordList`: Word list for temporary password generation

**Generator Modes**:
1. **Secure Passphrase**: Generates memorable passphrases with configurable structure (word count, separator, capitalization, digits, symbols, seasonal themes)
2. **Temporary Password**: Generates simple compound words with optional symbols and numbers

**Seasonal Logic**: Passphrase generator can incorporate seasonal words (Winter, Spring, Summer, Autumn) based on current date with custom Memorial Day and Labor Day calculations.

**Data Management**: JSON import/export for wordbank customization.

## 4. Key Design Patterns & Technical Notes

### AppLifecycle.initPage

Core bootstrap function in app-core.js responsible for:
- Caching all required DOM elements (converts kebab-case IDs to camelCase properties)
- Loading the navbar.html component via fetch()
- Loading page state from localStorage via createStateManager

### State Management

Each page manages its own isolated state under a unique localStorage key:
- `dashboard_state_v5`: Dashboard data
- `lookup_v2_data`: Lookup tool data
- `mailto_library_v1`: MailTo library data
- `passwords_v1_data`: Password generator data

### Textarea Auto-Resize

All textarea elements have `resize: none` in CSS and are controlled by `DOMHelpers.setupTextareaAutoResize()` for consistent, automatic height adjustment based on content.

### CSV Import/Export Pattern

Implemented via CsvManager module:
- **Export**: Converts state array to CSV with RFC 4180 compliant escaping
- **Import**: Parses CSV with quoted field support, validates headers, handles duplicates based on page-specific logic

### Error Handling

Dependency checks at page startup display non-destructive error banners without wiping DOM content. Critical failures are logged to console and prevent further execution.

### Jekyll Compatibility

Navigation file is named `navbar.html` (not `_nav.html`) to prevent GitHub Pages from ignoring it during Jekyll builds.

## 5. Development Guidelines

### Adding a New Page

1. Copy `template.html` as starting point
2. Define unique `LOCAL_STORAGE_KEY` and `defaultState`
3. List all required DOM elements in `requiredElements` array
4. Implement page-specific logic using shared utilities from app-core.js, app-ui.js, and app-data.js
5. Add navigation link to navbar.html

### Shared Utility Usage

All pages have access to:
- **SafeUI**: Safe wrappers for UI operations (modals, toasts, validation, clipboard, file I/O)
- **DOMHelpers**: DOM manipulation utilities (element caching, textarea auto-resize)
- **UIPatterns**: Confirmation dialogs, search highlighting
- **ListRenderer**: List rendering with empty state handling
- **SearchHelper**: Debounced search, array filtering
- **BackupRestore**: JSON backup/restore workflow
- **DataValidator**: Duplicate checking, field validation
- **CsvManager**: CSV import/export setup

### Code Standards

- Use `SafeUI` wrapper instead of direct `UIUtils` calls for graceful degradation
- Always validate user input before state mutations
- Use `SaveState()` after non-sorting operations; use `sortAndSaveState()` after imports/restores
- Handle null/undefined values in search filters and data accessors
- Implement proper error recovery for file operations and localStorage

## 6. Browser Requirements

- Modern browser with ES6 support
- localStorage enabled
- Clipboard API for copy operations
- File API for import/export
- Crypto API for secure random number generation (passwords page)

## 7. Known Limitations

- No backend synchronization (all data stored locally)
- CSV import limited to ~5MB per file (browser-dependent)
- mailto: URL length limited by email client (typically 2000 characters)
- No collaborative editing support