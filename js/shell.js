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
        if (elements.appFrame.contentWindow &&
            elements.appFrame.contentWindow.location.pathname.endsWith(pageUrl)) {
            return;
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

        // Update document title based on active app (optional)
        // const activeLink = document.querySelector(`.nav-link[data-href="${pageUrl}"]`);
        // if (activeLink) document.title = `${activeLink.textContent} - Tool Suite`;
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
                loadInitialRoute(); // Fallback
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

    // Listen for events from the iframe (optional, for title updates or deep linking)
    function setupFrameListeners() {
        elements.appFrame.addEventListener('load', () => {
            try {
                const frameLocation = elements.appFrame.contentWindow.location.pathname;
                const pageName = frameLocation.split('/').pop();
                updateActiveLink(pageName);

                // Sync URL if the iframe navigated itself (e.g. internal link)
                const key = Object.keys(PAGE_MAP).find(k => PAGE_MAP[k] === pageName);
                if (key) {
                     const currentParams = new URLSearchParams(window.location.search);
                     if (currentParams.get('page') !== key) {
                         history.replaceState({ page: pageName }, '', `${window.location.pathname}?page=${key}`);
                     }
                }
            } catch (e) {
                // Cross-origin restrictions might apply if not strictly local
                console.warn('Cannot access iframe location:', e);
            }
        });
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
