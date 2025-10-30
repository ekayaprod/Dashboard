Dashboard Project Architecture
This document provides a technical overview of the Dashboard project, its modular architecture, and key design decisions.
1. Project Overview
This project is a local-first, single-page application suite designed for high-speed lookup and note-taking, intended to run as a browser sidebar or standalone local utility. It uses a modular, vanilla JavaScript architecture to share code across multiple pages (index.html, lookup.html, etc.) while persisting all user data to the browser's localStorage.
2. Architecture & File Structure
The project is broken into distinct modules, pages, and components:
* js/: Contains all modular JavaScript logic, separated by responsibility.
* index.html: The main "Dashboard" page.
* lookup.html: The "Lookup" page for routing and snippets.
* template.html: A template for creating new pages.
* navbar.html: A shared HTML component dynamically loaded by each page.
* style.css: The single, global stylesheet for all pages.
3. Core JavaScript Modules
The application logic is contained in four primary modules:
js/app-core.js
This module is responsible for the application's startup integrity.
* AppLifecycle: Manages the page initialization sequence. Its run() method ensures that the DOM is loaded before executing any page-specific logic, and its initPage() function handles DOM element caching, navbar loading, and state initialization for each page.
* DOMHelpers: Provides utility functions for common DOM tasks, such as cacheElements (for validating all required id attributes are present at startup) and setupTextareaAutoResize.
* SafeUI: A critical wrapper object that provides "safe" access to functions in ui.common.js. It performs an existence check (typeof UIUtils !== 'undefined') before delegating calls. This makes the application resilient, preventing a total crash if ui.common.js fails to load. In such a case, SafeUI provides silent fallbacks (e.g., console.log for toasts).
js/ui.common.js
This module provides common, reusable UI utilities (UIUtils) used by all pages.
* UIUtils.showModal, UIUtils.showToast, UIUtils.showValidationError: Functions for displaying standardized modals, non-blocking toasts, and validation error popups.
* UIUtils.loadNavbar: A function that asynchronously fetches and injects the navbar.html component into the page.
* UIUtils.createStateManager: The core function for state persistence. It wraps localStorage.getItem() and JSON.parse() in a try...catch block. If it encounters corrupted or invalid JSON in localStorage, it logs the error, archives the corrupted data, and returns a clean, default state object. This prevents the app from being permanently broken for a user due to bad data.
* Validators: A set of common validation functions (e.g., notEmpty, maxLength).
js/ui-components.js
This module provides higher-level, reusable UI patterns.
* UIPatterns: Standardized modal flows for common actions, such as confirmDelete and confirmUnsavedChanges.
* ListRenderer: A utility for rendering lists of items into a container, including handling empty/filtered states.
* SearchHelper: Provides utilities for search, including simpleSearch (for filtering arrays) and setupDebouncedSearch.
js/data-management.js
This module handles data structure validation and backup/restore logic.
* BackupRestore: Contains the logic for createBackup (exporting the state object to a JSON file) and handleRestoreUpload (reading and validating an imported JSON file).
* DataValidator: Provides data-specific validation, such as hasDuplicate for checking for duplicate values in an array of objects.
4. Key Design Decisions
Several key decisions were made to ensure stability and maintainability.
Script Loading Order
All application scripts (<script src="...">) are loaded at the end of the <body> tag, immediately followed by the page-specific inline <script> block. This top-to-bottom execution order is intentional and critical. It guarantees that all modules (AppLifecycle, SafeUI, etc.) are fully loaded and defined in the global scope before the inline script attempts to call them, preventing any "race conditions" or ReferenceError exceptions on startup.
Navbar Component
* File Naming: The shared navigation bar component is intentionally named navbar.html (and not _nav.html). This is to ensure compatibility with static site generators like Jekyll (used by GitHub Pages), which treat files prefixed with an underscore (_) as special includes that are not published to the server. This naming convention prevents 404 Not Found errors when fetching the component.
* Component-Owned State: The navbar.html file contains its own small, inline script. This script is responsible for managing the navbar's "active" state by reading window.location.href and applying the .active class to the correct link. This decouples the navbar's presentation logic from the core application, allowing it to function as a self-contained component.