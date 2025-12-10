/**
 * shell.js - Handles the logic for the Shell (index.html)
 * Manages the iframe, navigation, and persistent navbar.
 */
(function() {
    'use strict';

    // DOM Elements
    const elements = {
        navbar: document.querySelector('.navbar'),
        navLinks: document.querySelectorAll('.nav-link'),
        appFrame: document.getElementById('app-frame')
    };

    // Configuration
    const DEFAULT_APP = 'dashboard.html';
    const PAGE_MAP = {
        'dashboard': 'dashboard.html',
        'lookup': 'lookup.html',
        'passwords': 'passwords.html',
        'mailto': 'mailto.html',
        'calculator': 'calculator.html'
    };

    // Initialize Shell
    function init() {
        setupNavigation();
        loadInitialRoute();
        setupKeyboardShortcuts();
        setupFrameListeners();
    }

    // Determine which page to load based on URL query param or default
    function loadInitialRoute() {
        const urlParams = new URLSearchParams(window.location.search);
        const pageKey = urlParams.get('page');
        let targetPage = DEFAULT_APP;

        if (pageKey && PAGE_MAP[pageKey]) {
            targetPage = PAGE_MAP[pageKey];
        } else if (pageKey) {
            // Try to handle raw filenames if passed
             const foundKey = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === pageKey);
             if (foundKey) targetPage = PAGE_MAP[foundKey];
        }

        navigateTo(targetPage, false);
    }

    // Navigate the iframe and update UI/URL
    function navigateTo(pageUrl, updateHistory = true) {
        // Prevent redundant navigation
        try {
            if (elements.appFrame.contentWindow &&
                elements.appFrame.contentWindow.location.pathname.endsWith(pageUrl)) {
                // Focus iframe anyway for accessibility
                elements.appFrame.focus();
                return;
            }
        } catch (e) {
            // Ignore access errors
        }

        elements.appFrame.src = pageUrl;
        updateActiveLink(pageUrl);

        if (updateHistory) {
            const key = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === pageUrl);
            if (key) {
                const newUrl = `${window.location.pathname}?page=${key}`;
                history.pushState({ page: pageUrl }, '', newUrl);
            }
        }

        // Transfer focus to iframe for accessibility
        elements.appFrame.focus();
    }

    // Update the active state of navbar links
    function updateActiveLink(pageUrl) {
        elements.navLinks.forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('data-href');
            if (href === pageUrl) {
                link.classList.add('active');
            }
        });
    }

    // Setup click listeners for navbar
    function setupNavigation() {
        elements.navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const target = link.getAttribute('data-href');
                if (target) {
                    navigateTo(target);
                }
            });
        });

        // Handle browser Back/Forward
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.page) {
                navigateTo(event.state.page, false);
            } else {
                loadInitialRoute();
            }
        });
    }

    // Keyboard shortcuts (Ctrl + 1-5)
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
                const key = e.key;
                const shortcuts = {
                    '1': 'dashboard.html',
                    '2': 'lookup.html',
                    '3': 'passwords.html',
                    '4': 'mailto.html',
                    '5': 'calculator.html'
                };

                if (shortcuts[key]) {
                    e.preventDefault();
                    navigateTo(shortcuts[key]);
                }
            }
        });
    }

    // Listen for events from the iframe
    function setupFrameListeners() {
        // Handle postMessages from iframe (Title updates, etc.)
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'app_ready') {
                const { title, path } = event.data;

                // Update document title
                if (title) {
                    document.title = `${title} - Tool Suite`;
                }

                // Sync URL if needed (e.g., if app redirected itself)
                if (path) {
                    const pageName = path.split('/').pop();
                    const key = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === pageName);
                    if (key) {
                         const currentParams = new URLSearchParams(window.location.search);
                         if (currentParams.get('page') !== key) {
                             history.replaceState({ page: pageName }, '', `${window.location.pathname}?page=${key}`);
                             updateActiveLink(pageName);
                         }
                    }
                }
            }
        });

        // Fallback load listener (restricted access in some cases)
        elements.appFrame.addEventListener('load', () => {
             elements.appFrame.focus();
        });
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
