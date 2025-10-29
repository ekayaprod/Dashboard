/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities
 * Used by: index.html, lookup.html, template.html
 */

/**
 * SafeUI - Wrapper around UIUtils for graceful degradation
 * Ensures app doesn't crash if ui.common.js fails to load.
 */
const SafeUI = (() => {
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;
    
    // Fallback icons if SVGIcons object is not ready
    const getSVGIcons = () => {
        if (isReady && UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑' };
    };

    return {
        isReady,
        SVGIcons: getSVGIcons(),
        loadNavbar: (containerId, currentPage) => isReady && UIUtils.loadNavbar(containerId, currentPage),
        showModal: (title, content, actions) => isReady ? UIUtils.showModal(title, content, actions) : console.error("UIUtils not loaded", title),
        showValidationError: (title, msg, elId) => isReady ? UIUtils.showValidationError(title, msg, elId) : console.error("UIUtils not loaded", title),
        hideModal: () => isReady && UIUtils.hideModal(),
        showToast: (msg) => isReady ? UIUtils.showToast(msg) : console.log("Toast:", msg),
        escapeHTML: (str) => isReady ? UIUtils.escapeHTML(str) : (str || ''),
        generateId: () => isReady ? UIUtils.generateId() : Date.now().toString(),
        debounce: (func, delay) => isReady ? UIUtils.debounce(func, delay) : func,
        copyToClipboard: (text) => isReady ? UIUtils.copyToClipboard(text) : Promise.resolve(false),
        downloadJSON: (data, filename) => isReady && UIUtils.downloadJSON(data, filename),
        openFilePicker: (cb, accept) => isReady && UIUtils.openFilePicker(cb, accept),
        readJSONFile: (file, onSuccess, onError) => isReady ? UIUtils.readJSONFile(file, onSuccess, onError) : onError("UI Framework not loaded."),
        createStateManager: (key, defaults, version, onCorruption) => isReady ? UIUtils.createStateManager(key, defaults, version, onCorruption) : null,
        validators: isReady ? UIUtils.validators : { url: (v) => v, notEmpty: (v) => v, maxLength: (v, m) => v }
    };
})();

/**
 * DOMHelpers - DOM element utilities
 */
const DOMHelpers = {
    /**
     * Cache DOM elements and validate they exist
     * @param {Array<string>} requiredIds - Array of element IDs to cache
     * @returns {Object} { elements, allFound }
     * * Example:
     * const { elements, allFound } = DOMHelpers.cacheElements(['search-input', 'results-list']);
     * if (!allFound) return;
     * elements.searchInput.value = 'test'; // Note: kebab-case converted to camelCase
     */
    cacheElements: (requiredIds) => {
        const elements = {};
        let allFound = true;
        
        for (const id of requiredIds) {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`FATAL: DOM element with id "${id}" not found.`);
                allFound = false;
            }
            // Convert kebab-case to camelCase: 'app-search-input' → 'appSearchInput'
            elements[id.replace(/-(\w)/g, (m, g) => g.toUpperCase())] = el;
        }
        
        return { elements, allFound };
    },

    /**
     * Setup auto-resize for textarea elements
     * @param {HTMLTextAreaElement} textarea - Textarea element
     * @param {number} maxHeight - Maximum height in pixels (default: 300)
     * * Example:
     * DOMHelpers.setupTextareaAutoResize(document.getElementById('notes'), 200);
     */
    setupTextareaAutoResize: (textarea, maxHeight = 300) => {
        if (!textarea) return;
        
        const resize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        };
        
        textarea.addEventListener('input', resize);
        resize(); // Initial sizing
    }
};

/**
 * AppLifecycle - Application initialization and error handling
 */
const AppLifecycle = {
    /**
     * Standard init wrapper with error handling
     * Wraps DOMContentLoaded and provides error boundaries
     * @param {Function} initFn - Page-specific async init function
     * * Example:
     * AppLifecycle.run(async () => {
     * // Your page initialization code here
     * const ctx = await AppLifecycle.initPage({ ... });
     * });
     */
    run: (initFn) => {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // Validate SafeUI loaded
                if (!SafeUI || !SafeUI.isReady) {
                    console.error("FATAL: UIUtils or SafeUI failed to initialize.");
                    document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                        <h2>Application Failed to Load</h2>
                        <p>A critical file (ui.common.js) may be missing or failed to load. Please check the console for errors.</p>
                    </div>`;
                    return;
                }
                
                // Run page-specific init
                await initFn();
                
            } catch (err) {
                console.error("Unhandled exception during initialization:", err);
                document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                    <h2>Application Error</h2>
                    <p>An unexpected error occurred during startup: ${err.message}</p>
                    <p>Please check the console for more details.</p>
                </div>`;
            }
        });
    },

    /**
     * Standard page initialization boilerplate
     * Handles DOM caching, navbar loading, and state initialization
     * @param {Object} config - Page configuration
     * @returns {Promise<Object|null>} Initialized context { elements, state, saveState } or null on failure
     * * Example:
     * const ctx = await AppLifecycle.initPage({
     * pageName: 'index.html',
     * storageKey: 'myapp_state_v1',
     * defaultState: { items: [] },
     * version: '1.0.0',
     * requiredElements: ['search-input', 'results-list'],
     * onCorruption: () => { ... } // Optional callback
     * });
     * * if (!ctx) return; // Init failed
     * const { elements, state, saveState } = ctx;
     */
    initPage: async (config) => {
        const { pageName, storageKey, defaultState, version, requiredElements, onCorruption } = config;

        // Cache DOM elements
        const { elements, allFound } = DOMHelpers.cacheElements(requiredElements);
        if (!allFound) {
            console.error("FATAL: Missing critical DOM elements. Application halted.");
            return null;
        }

        // Load navbar and wait for it to complete
        await SafeUI.loadNavbar("navbar-container", pageName);

        // Initialize state
        const stateManager = SafeUI.createStateManager(storageKey, defaultState, version, onCorruption);
        if (!stateManager) {
            console.error("FATAL: StateManager failed to initialize.");
            return null;
        }

        const state = stateManager.load();
        const saveState = () => stateManager.save(state);

        return { elements, state, saveState };
    }
};
