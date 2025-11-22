Dashboard & Tools Suite
1. Project Overview
This is a multi-page browser application designed exclusively for the Microsoft Edge Sidebar environment. It provides four primary tools: Dashboard, Lookup, MailTo Generator, and Password Generator. All data is stored locally in the browser's localStorage.
2. Core Architecture
The entire project is built on a shared, modular foundation, optimized for minimal runtime overhead and reduced file size within a resource-constrained sidebar environment. The application initialization pattern strictly separates page-specific configuration from reusable application logic.
3-File JavaScript Library (Source of Truth)
All shared logic is modularized into three core files. All in-code explanatory comments have been removed and migrated to this document.
| File | Primary Responsibilities | Architectural Notes |
|---|---|---|
| js/app-core.js | Foundation, SafeUI wrapper, DOM utilities, State Management. | Initialization: AppLifecycle.run handles dependency checks, state loading, and calls page-specific init functions. Edge Optimization: The legacy document.execCommand('copy') clipboard fallback has been removed, assuming navigator.clipboard.writeText is available in the secure Edge context. |
| js/app-ui.js | High-level UI logic, shared components, and dashboard functionality. | Contains UIPatterns, ListRenderer, SearchHelper, and the integrated DashboardUI module. |
| js/app-data.js | Data persistence, validation, and file I/O. | Includes BackupRestore (JSON backup), DataValidator, DataConverter (RFC 4180 CSV parser with quote handling fix), and CsvManager. Legacy Removal: All support for legacy app name checking has been removed. |
Smart Navbar Component (navbar.html)
The navbar.html file is loaded via fetch() on every page and acts as a self-contained component with a self-activating script that checks window.location.pathname and automatically applies the .active class to the correct navigation link.
CSS Consolidation (Global Style)
All page-specific styles have been centralized into style.css to prevent inline CSS, improve maintainability, and reduce HTML file size.
| New Global Class | Former Location/Use | Rationale |
|---|---|---|
| .panel | Replaces redundant classes like .app-section-box and .generator-section as a universal container for content panels. | Reduces duplicated styling definitions. |
| .view, .list-item, .upload-wrapper | Styles migrated from the <style> blocks in mailto.html and passwords.html. | Decouples presentation from structure. |
3. Page-Specific Architecture
index.html (Dashboard)
The application logic, including all rendering, event handlers, and data management, has been fully migrated into the DashboardUI module within js/app-ui.js.
| Data Field | Purpose | Design Note |
|---|---|---|
| state.apps | Main application registry. | The name field only appears when creating new apps or editing via the modal. |
| state.shortcuts | Quick-access URL list. | Drag-and-drop reordering is implemented via custom event handlers. |
| state.notes | Multi-document notepad. | Default note ("My Scratchpad") is created if the collection is empty. |
| Sidebar UX Fix |  | The App Notes/Escalation field is now collapsed by default to conserve vertical space in the narrow sidebar viewport. |
lookup.html (Lookup)
Dual-search tool for KnowledgeBase and internal database.
| Data Field | Purpose | Design Note |
|---|---|---|
| state.settings.kbBaseUrl | Configurable search URL template ({query}). | Validation ensures the {query} placeholder exists. |
| state.items | Database entries. | Schema: id, keyword, assignmentGroup, notes, phoneLogPath. |
| Data Integrity |  | Implements "Merge on Duplicate" workflow: if a user attempts to save an entry with a duplicate assignmentGroup, keywords can be merged into the existing entry. |
mailto.html (MailTo Generator)
Email template library with folder hierarchy and Outlook file (.msg, .oft) parsing.
| Data Field | Purpose | Design Note |
|---|---|---|
| state.library | Hierarchical folder/item structure. | Breadcrumbs are generated dynamically using an iterative tree traversal algorithm. |
| Dependencies |  | Requires msgreader.js for robust Outlook message file parsing. Error handling is explicit for malformed file structures. |
| Sidebar UX Fix |  | CSV Import/Export buttons were consolidated into a single "Data" dropdown button to minimize horizontal space usage in the narrow sidebar header. |
passwords.html (Password Generator)
Dual-mode password generator with customizable wordbanks and structure.
| Logic | Implementation | Design Note |
|---|---|---|
| Entropy Source | getRand(m) helper. | Prioritizes window.crypto.getRandomValues for security. Fallback to Math.random() logs a console warning only once on failure. |
| Seasonal Logic | Merges seasonal wordbanks (winter.json, etc.) into base categories. | Generator logic uses SeasonNoun rules but draws from the combined Noun pool, allowing base and seasonal words to be mixed. |
| Security Constraints |  | Validation Fix: Ensures padding logic (passPadToMin) cannot override maxLength settings, preventing generation failures. |
| Data Management |  | JSON import/export is provided for base wordbank and generator presets. |
4. Browser Requirements & Technical Notes
| Requirement | Implementation/Context |
|---|---|
| Target Environment | Microsoft Edge Sidebar only. |
| Clipboard | navigator.clipboard.writeText (Legacy fallback removed). |
| Storage | localStorage (Isolated keys per page). |
| Textareas | All use DOMHelpers.setupTextareaAutoResize() with CSS resize: none. |
| CSS | Font stack simplified to Segoe UI for Edge performance. |
