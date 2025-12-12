# Sidebar Productivity Suite - Technical Documentation

## 1. Overview
The Sidebar Productivity Suite is a modular, browser-based application collection designed for execution within restricted environments such as the Microsoft Edge Sidebar. The suite operates entirely client-side, utilizing `localStorage` for data persistence, and requires no external build process or backend infrastructure.

The project consists of a central dashboard and four specialized utilities:
*   **Dashboard**: Application launcher, scratchpad, and shortcut manager.
*   **Calculator**: Shift pacing and productivity metrics calculator.
*   **Lookup**: Knowledge base search aggregator and local reference database.
*   **MailTo**: Email template generator with support for `.msg` file parsing and folder organization.
*   **Passwords**: Configurable passphrase generator with seasonal word bank support.

## 2. System Architecture

### 2.1. Shell Architecture
The application employs a "Shell" architecture to manage navigation and provide a consistent user experience.

*   **Shell (`index.html`)**: The main entry point. It contains the persistent navigation bar and loads the active application into an `iframe`. It handles deep linking via query parameters (e.g., `index.html?page=calculator`) and synchronizes the browser history with the iframe state.
*   **Sub-Pages**: Individual tools (e.g., `calculator.html`, `dashboard.html`) are standalone pages. When loaded directly (not via the shell), they render without the global navbar, allowing for focused, isolated usage.
*   **Communication**: Sub-pages communicate with the Shell via `postMessage` to update the document title and synchronize the URL path.
*   **Security**: The application frame uses `sandbox` attributes (`allow-scripts`, `allow-same-origin`, `allow-forms`, etc.) to secure the execution environment while maintaining necessary functionality.

### 2.2. Bootstrapping & Dependency Management
The application employs a custom dependency loader (`js/bootstrap.js`) to manage execution order and resource loading.

*   **Sequential Execution**: Core libraries (`app-core.js`, `app-ui.js`, `app-data.js`) are executed in strict order to satisfy dependency chains.
*   **Page-Specific Loading**: The bootstrapper identifies the current page context and dynamically loads the corresponding application logic (e.g., `js/apps/dashboard.js`).
*   **Event-Driven Ready State**: The system dispatches a custom `bootstrap:ready` event when all dependencies are initialized.
*   **Shell Integration**: Upon initialization, `bootstrap.js` automatically detects if the app is running within an iframe and sends an `app_ready` message to the parent shell.

### 2.3. Core Library Layers
Shared functionality is distributed across three primary modules, implemented using the Module Pattern to expose public APIs while encapsulating internal logic.

#### Core Layer (`js/app-core.js`)
*   **`AppLifecycle`**: Manages application initialization, dependency verification, and the page lifecycle. It provides the `initPage` method, which standardizes state loading, DOM caching, and version checking.
*   **`SafeUI`**: A Facade pattern wrapper around `UIUtils`. It provides a stable API for UI interactions, checking for dependency readiness before execution.
*   **`DOMHelpers`**: Utilities for DOM manipulation, including element caching and auto-resizing text areas.
*   **`UIUtils`**: Low-level UI implementation (Modal dialogs, Toasts, Clipboard interactions).

#### Data Layer (`js/app-data.js`)
*   **`BackupRestore`**: Handles JSON serialization for full-state backups and restoration. Includes validation logic to ensure data integrity during import.
*   **`DataConverter`**: Implements an RFC 4180-compliant CSV parser and generator for data interoperability.
*   **`DataValidator`**: Provides schema validation for imported data and form inputs.

#### UI Layer (`js/app-ui.js`)
*   **`SharedSettingsModal`**: A configurable component that generates a standardized settings dialog, handling common tasks like data export/import and application-specific configurations.
*   **`ListRenderer`**: A virtualization-ready component for rendering data lists with support for custom item templates.
*   **`NotepadManager`**: A reusable module implementing persistent scratchpad functionality with auto-save.

## 3. State Management
Data persistence is handled via the `localStorage` API. The `AppLifecycle` module implements a `StateManager` factory that provides:
*   **Versioning**: Configuration states include a version string to facilitate future migrations.
*   **Corruption Handling**: Fallback mechanisms reset state to defaults if JSON parsing fails, archiving the corrupt data for recovery.
*   **Atomic Saves**: State is serialized and verified immediately after modification to ensure consistency.

## 4. Application Modules

### 4.1. Dashboard (`dashboard.html`)
*   **Function**: Acts as the launcher and primary workspace.
*   **Key Features**:
    *   Dynamic application registry.
    *   "Quick Actions" shortcut system.
    *   Integrated multi-note scratchpad.

### 4.2. Calculator (`calculator.html`)
*   **Function**: Calculates productivity metrics based on shift duration and output.
*   **Logic**: Implements a time-based algorithm that accounts for breaks, shift start/end times, and leeway factors to project required output ("pacing") in real-time.
*   **Visualization**: Renders color-coded status cards indicating progress against defined grade boundaries.

### 4.3. Lookup (`lookup.html`)
*   **Function**: Database for quick retrieval of assignment groups and procedural notes.
*   **Search**: Features a hybrid search engine that queries the local database and constructs URLs for external knowledge base searches.
*   **Data Structure**: Flat-file database optimized for client-side keyword filtering.

### 4.4. MailTo (`mailto.html`)
*   **Function**: Generates `mailto:` links and manages a library of email templates.
*   **Architecture**:
    *   **Recursive Data Structure**: Supports nested folders for template organization.
    *   **MSG Parsing**: Integrates `js/msgreader.js` to parse binary Outlook files (`.msg`) and extract recipients, subject, and body content.
*   **Navigation**: Implements a breadcrumb-based traversal system for the folder hierarchy.

### 4.5. Passwords (`passwords.html`)
*   **Function**: Generates secure passphrases and passwords.
*   **Logic**:
    *   **Entropy**: Utilizes `window.crypto.getRandomValues` for cryptographically secure random number generation.
    *   **Structure**: Supports configurable sentence structures (e.g., Adjective-Noun-Verb) and seasonal word banks that can be dynamically loaded.

## 5. Development Guidelines
*   **No Build Step**: The codebase uses standard ES6+ JavaScript and CSS variables, requiring no transpilation or bundling.
*   **Isolation**: Each application page runs in its own context but shares the `js/` library references.
*   **CSS Architecture**: Global styles are defined in `style.css`, utilizing a BEM-like naming convention (e.g., `.app-container`, `.btn-primary`).
