Dashboard & Lookup Tool

This is a simple, local-first web application suite designed for personal organization. It consists of two main tools:

Dashboard (index.html): A main page for managing a list of applications, their URLs, and associated notes. It also includes a quick-access shortcut bar and a multi-tab scratchpad.

Lookup (lookup.html): A fast search tool for managing and finding "Routing" keywords (like assignment groups) and "Snippets" (like canned text responses).

All data is stored exclusively in your browser's localStorage. No data ever leaves your computer.

How to Use

Simply open either index.html or lookup.html in a modern web browser. All functionality is self-contained.

Features

Dashboard (index.html)

Application Management: Add, edit, and delete applications. Each entry can store a name, a list of URLs (one per line), and detailed notes.

Application Search: Instantly search your application list by name.

Shortcut Bar: A drag-and-drop shortcut bar for your most-used links.

Notepad: A multi-page scratchpad for quick notes. You can create, rename, and delete notes.

Backup/Restore: From the "Actions" menu, you can download a .json file backing up all your applications, shortcuts, and notes. You can restore this data at any time.

Lookup (lookup.html)

Dual-Column View: Manage "Routing" and "Snippets" in separate, searchable lists.

Instant Search: The lists filter as you type.

Click-to-Copy: Clicking on a snippet's content box instantly copies it to your clipboard.

In-line Editing: Add or edit entries directly within the list.

Data Management

Local Storage: All data is saved in your browser's localStorage.

Separate Data Stores: The Dashboard and the Lookup tool use different storage keys. This means their data is saved and managed completely independently.

Dashboard Backup: The "Backup/Restore" feature on the Dashboard page only manages Dashboard data (apps, notes, and shortcuts). It does not back up or restore data from the Lookup page.

File Structure

The project has been refactored into a modular, multi-file structure for better maintainability.

Dashboard/
├── _nav.html               # HTML fragment for the shared navigation bar
├── index.html              # The main Dashboard application page
├── lookup.html             # The Lookup/Snippet tool page
├── template.html           # A blank template for creating new pages
├── style.css               # All shared styles for both applications
│
└── js/                     <-- Folder for all JavaScript modules
    ├── ui.common.js        # Core UI utilities (modals, toasts, clipboard) & SVG icons
    ├── app-core.js         # Application startup logic (AppLifecycle) & SafeUI wrapper
    ├── ui-components.js    # Reusable UI components (UIPatterns, ListRenderer)
    └── data-management.js  # Data validation & Backup/Restore logic
