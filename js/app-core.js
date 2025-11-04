/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities.
 */

// ============================================================================
// MODULE: SVGIcons
// ============================================================================
const SVGIcons = Object.freeze({
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
    pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zM8 10.93a2.929 2.929 0 1 1 0-5.858 2.929 2.929 0 0 1 0 5.858z"/></svg>',
    // FIX 1: Added missing copy icon
    copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z"/></svg>'
});

// ============================================================================
// MODULE: CoreValidators
// ============================================================================
const CoreValidators = Object.freeze({
    _validate: (value, type, options = {}) => {
        if (value == null) return false;
        const str = String(value).trim();

        switch (type) {
            case 'url':
                const urlRegex = /^(https?:\/\/)?(localhost|[\w-]+)(\.[\w-]+)*(:[0-9]{1,5})?(\/.*)?$/i;
                if (!urlRegex.test(str)) {
                    return false;
                }
                try {
                    let testUrl = str;
                    if (!/^https?:\/\//.test(testUrl)) {
                        testUrl = 'http://' + testUrl;
                    }
                    new URL(testUrl);
                    return true;
                } catch {
                    return false;
                }
            case 'notEmpty':
                return str.length > 0;
            case 'maxLength':
                return str.length <= (options.max || Infinity);
            default:
                return false;
        }
    },
    url: function(value) { return this._validate(value, 'url'); },
    notEmpty: function(value) { return this._validate(value, 'notEmpty'); },
    maxLength: function(value, max) { return this._validate(value, 'maxLength', { max }); }
});


// ============================================================================
// MODULE: UIUtils (Low-level DOM, UI, and helper functions)
// ============================================================================
const UIUtils = (() => {

    /**
     * Dynamically loads the navigation bar.
     */
    const loadNavbar = (function() {
        let loaded = false;
        return async function(containerId) {
            if (loaded) return;
            loaded = true;

            const navContainer = document.getElementById(containerId);
            if (!navContainer) {
                console.error(`Navbar container "${containerId}" not found.`);
                return;
            }

            try {
                const response = await fetch(`navbar.html?v=1.1`);
                if (!response.ok) throw new Error(`Failed to fetch navbar.html: ${response.statusText}`);
                navContainer.innerHTML = await response.text();
            } catch (error) {
                console.error('Failed to load navbar:', error);
                navContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
            }
        };
    })();

    /**
     * Escapes a string for safe insertion into HTML.
     */
    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    };

    /**
     * Generates a unique ID.
     */
    const generateId = () => {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    };

    /**
     * Debounces a function.
     */
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    /**
     * Copies text to the clipboard.
     * Edge Optimization: Removed legacy execCommand fallback.
     */
    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard (API failure):', err);
            return false;
        }
    };

    /**
     * Triggers a file download.
     */
    const downloadJSON = function(dataStr, filename, mimeType = 'application/json') {
        try {
            if (typeof dataStr !== 'string' || !filename) {
                throw new Error('Invalid download parameters.');
            }
            const dataBlob = new Blob([dataStr], { type: mimeType });
            const url = URL.createObjectURL(dataBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error("Failed to trigger file download:", error);
            _showModal("Download Error", "<p>Failed to create download.</p>", [{ label: "OK" }]);
            return false;
        }
    };

    /**
     * Programmatically opens a file picker.
     */
    const openFilePicker = (callback, accept = "application/json,.json") => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                callback(file);
            }
        };
        input.click();
    };

    /**
     * Reads a file as JSON.
     */
    const readJSONFile = (file, onSuccess, onError) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                onSuccess(data);
            } catch (err) {
                console.error("Failed to parse JSON:", err);
                onError("File is not valid JSON.");
            }
        };
        reader.onerror = () => {
            console.error("Failed to read file.");
            onError("Failed to read the file.");
        };
        reader.readAsText(file);
    };

    /**
     * Reads a file as plain text.
     */
    const readTextFile = (file, onSuccess, onError) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                onSuccess(text);
            } catch (err) {
                console.error("Failed to read text:", err);
                onError("Failed to read file as text.");
            }
        };
        reader.onerror = () => {
            console.error("Failed to read file.");
            onError("Failed to read the file.");
        };
        reader.readAsText(file);
    };

    /**
     * Creates a state manager for localStorage.
     */
    const createStateManager = (key, defaults, version, onCorruption) => {
        if (!key || typeof key !== 'string' || !defaults || typeof defaults !== 'object' || !version) {
            console.error("State Manager initialization error: Invalid parameters provided.");
            return null;
        }

        const load = () => {
            let data;
            const rawData = localStorage.getItem(key);

            if (rawData) {
                try {
                    data = JSON.parse(rawData);
                    if (data.version !== version) {
                        console.warn(`State version mismatch (found ${data.version}, expected ${version}). Resetting to default.`);
                        data = { ...defaults };
                    }
                } catch (err) {
                    console.error("Failed to parse state:", err);
                    if (onCorruption) {
                        try {
                            onCorruption();
                        } catch (callbackErr) {
                            console.error("Corruption handler failed:", callbackErr);
                        }
                    }
                    localStorage.setItem(`${key}_corrupted_${Date.now()}`, rawData);
                    // FIX 2: Added user notification on data corruption
                    // Note: Using _showModal as SafeUI is not yet defined at this point.
                    _showModal('Data Corruption Detected', '<p>Your saved data was corrupted and has been reset. A backup was saved with timestamp.</p>', [{label: 'OK'}]);
                    data = { ...defaults };
                }
            } else {
                data = { ...defaults };
            }
            return data;
        };

        const save = (state) => {
            try {
                state.version = version;
                localStorage.setItem(key, JSON.stringify(state));
            } catch (err) {
                console.error("Failed to save state:", err);
                _showModal("Save Error", "<p>Failed to save data. Storage may be full.</p>", [{ label: 'OK' }]);
            }
        };

        return { load, save };
    };

    /**
     * Hides the global modal. (Internal helper)
     */
    const _hideModal = () => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
        // FIX 3: Added missing class removal
        document.body.classList.remove('modal-open');
    };

    /**
     * Shows the global modal with custom content and buttons. (Internal helper)
     */
    const _showModal = function(title, contentHtml, actions) {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        if (!modalOverlay || !modalContent) {
            console.error('Modal DOM elements not found.');
            return;
        }
        
        // FIX 3: Added missing class addition
        document.body.classList.add('modal-open');

        modalContent.innerHTML = `<h3>${escapeHTML(title)}</h3><div>${contentHtml}</div><div class="modal-actions"></div>`;
        const actionsContainer = modalContent.querySelector('.modal-actions');

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `button-base ${action.class || ''}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                if (action.callback) {
                    if (action.callback() === false) {
                        return;
                    }
                }
                _hideModal();
            };
            actionsContainer.appendChild(btn);
        });

        modalOverlay.style.display = 'flex';
    };

    /**
     * Shows a standardized validation error modal and focuses the element.
     */
    const showValidationError = function(title, message, focusElementId) {
        _showModal(title, `<p>${escapeHTML(message)}</p>`, [{ label: 'OK' }]);
        if (focusElementId) {
            setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
        }
    };


    /**
     * Shows a simple feedback toast message.
     */
    const showToast = (function() {
        let activeTimer = null;

        return function(message) {
            const toast = document.getElementById('toast');
            if (!toast) return;

            if (activeTimer) clearTimeout(activeTimer);

            toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
            toast.classList.add('show');

            activeTimer = setTimeout(() => {
                toast.classList.remove('show');
                activeTimer = null;
            }, 3000);
        };
    })();

    // Expose public API for UIUtils
    return {
        SVGIcons: SVGIcons,
        validators: CoreValidators,
        loadNavbar: loadNavbar,
        escapeHTML: escapeHTML,
        generateId: generateId,
        debounce: debounce,
        copyToClipboard: copyToClipboard,
        downloadJSON: downloadJSON,
        openFilePicker: openFilePicker,
        readJSONFile: readJSONFile,
        readTextFile: readTextFile,
        createStateManager: createStateManager,
        hideModal: _hideModal,
        showModal: _showModal,
        showValidationError: showValidationError,
        showToast: showToast,
    };
})();

// ============================================================================
// MODULE: SafeUI (Proxy layer providing fallback implementations)
// ============================================================================
const SafeUI = (() => {
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;

    const getSVGIcons = () => {
        if (isReady && UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑', settings: '⚙', copy: '📋' };
    };

    return {
        isReady,
        SVGIcons: getSVGIcons(),

        // --- Core UI Methods ---
        loadNavbar: (containerId) => {
            if (isReady) UIUtils.loadNavbar(containerId);
        },
        showModal: (title, content, actions) => {
            if (isReady) return UIUtils.showModal(title, content, actions);
            console.error("UIUtils not loaded. Modal requested:", title);
        },
        showValidationError: (title, msg, elId) => {
            if (isReady) return UIUtils.showValidationError(title, msg, elId);
            console.error("UIUtils not loaded. Validation Error:", title, msg);
        },
        hideModal: () => {
            if (isReady) UIUtils.hideModal();
        },
        showToast: (msg) => {
            if (isReady) return UIUtils.showToast(msg);
            console.log("Toast (UIUtils not loaded):", msg);
        },

        // --- Utility Methods ---
        escapeHTML: (str) => {
            if (isReady) return UIUtils.escapeHTML(str);
            return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        },
        generateId: () => {
            return isReady ? UIUtils.generateId() : Date.now().toString();
        },
        debounce: (func, delay) => {
            return isReady ? UIUtils.debounce(func, delay) : func;
        },
        copyToClipboard: (text) => {
            return isReady ? UIUtils.copyToClipboard(text) : Promise.resolve(false);
        },
        downloadJSON: (data, filename, mimeType) => {
            if (isReady) return UIUtils.downloadJSON(data, filename, mimeType);
        },
        openFilePicker: (cb, accept) => {
            if (isReady) return UIUtils.openFilePicker(cb, accept);
        },
        readJSONFile: (file, onSuccess, onError) => {
            if (isReady) return UIUtils.readJSONFile(file, onSuccess, onError);
            onError("UI Framework not loaded.");
        },
        readTextFile: (file, onSuccess, onError) => {
            if (isReady) return UIUtils.readTextFile(file, onSuccess, onError);
            onError("UI Framework not loaded.");
        },
        createStateManager: (key, defaults, version, onCorruption) => {
            return isReady ? UIUtils.createStateManager(key, defaults, version, onCorruption) : null;
        },
        validators: isReady ? UIUtils.validators : {
            url: (v) => v,
            notEmpty: (v) => v,
            maxLength: (v, m) => v
        }
    };
})();

// ============================================================================
// MODULE: DOMHelpers (Utilities for DOM manipulation)
// ============================================================================
const DOMHelpers = (() => {
    return {
        /**
         * Cache DOM elements and validate they exist.
         */
        cacheElements: (requiredIds) => {
            const elements = {};
            let allFound = true;

            for (const id of requiredIds) {
                const el = document.getElementById(id);
                if (!el) {
                    console.error(`DOM element with id "${id}" not found.`);
                    allFound = false;
                }
                elements[id.replace(/-(\w)/g, (m, g) => g.toUpperCase())] = el;
            }

            return { elements, allFound };
        },

        /**
         * Setup auto-resize for textarea elements.
         */
        setupTextareaAutoResize: (textarea, maxHeight = 300) => {
            if (!textarea) return;

            const resize = () => {
                textarea.style.height = 'auto';
                textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
            };

            textarea.addEventListener('input', resize);
            textarea._autoResize = resize;
            resize();
        },

        /**
         * Manually trigger a resize on a textarea.
         */
        triggerTextareaResize: (textarea) => {
            if (textarea && typeof textarea._autoResize === 'function') {
                textarea._autoResize();
            }
        }
    };
})();

// ============================================================================
// MODULE: AppLifecycle (Core initialization and error handling)
// ============================================================================
const AppLifecycle = (() => {

    /**
     * Displays a non-destructive error banner at the top of the page.
     */
    const _showErrorBanner = (title, message) => {
        try {
            const bannerId = 'app-startup-error';
            let banner = document.getElementById(bannerId);

            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                Object.assign(banner.style, {
                    position: 'sticky', top: '0', left: '0', width: '100%',
                    padding: '1rem', backgroundColor: '#fef2f2', color: '#dc2626',
                    borderBottom: '2px solid #fecaca', fontFamily: 'sans-serif',
                    fontSize: '1rem', fontWeight: '600', zIndex: '10000',
                    boxSizing: 'border-box'
                });

                if (document.body) {
                    document.body.prepend(banner);
                } else {
                    document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
                }
            }

            banner.innerHTML = `<strong>${SafeUI.escapeHTML(title)}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${SafeUI.escapeHTML(message)}</p>`;
            banner.classList.remove('hidden');
        } catch (e) {
            console.error("Failed to show error banner:", e);
            document.body.innerHTML = `<p>${SafeUI.escapeHTML(title)}: ${SafeUI.escapeHTML(message)}</p>`;
        }
    };

    return {
        /**
         * Standard init wrapper with error handling.
         */
        run: (initFn) => {
            document.addEventListener('DOMContentLoaded', async () => {
                try {
                    // Dependency check for UIUtils itself
                    if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined') {
                        const errorTitle = "Application Failed to Load";
                        const errorMessage = "A critical file (app-core.js) may be missing, failed to load, or is corrupted. Check console for errors.";
                        _showErrorBanner(errorTitle, errorMessage);
                        console.error("FATAL: UIUtils, SafeUI, or DOMHelpers failed to initialize. Application halted.");
                        return;
                    }

                    await initFn();

                } catch (err) {
                    console.error("Unhandled exception during initialization:", err);
                    const errorTitle = "Application Error";
                    const errorMessage = `An unexpected error occurred during startup: ${err.message}. Check console for more details.`;
                    _showErrorBanner(errorTitle, errorMessage);
                }
            });
        },

        /**
         * Standard page initialization boilerplate.
         */
        initPage: async (config) => {
            const { storageKey, defaultState, version, requiredElements, onCorruption } = config;

            // Cache DOM elements
            const { elements, allFound } = DOMHelpers.cacheElements(requiredElements);
            if (!allFound) {
                const errorTitle = "Application Failed to Start";
                const errorMessage = "One or more critical HTML elements are missing from the page. Application cannot continue.";
                _showErrorBanner(errorTitle, errorMessage);
                console.error("FATAL: Missing critical DOM elements. Application halted.");
                return null;
            }

            // Initialize state
            const stateManager = SafeUI.createStateManager(storageKey, defaultState, version, onCorruption);
            if (!stateManager) {
                const errorTitle = "Application Failed to Start";
                const errorMessage = "The StateManager (for localStorage) failed to initialize. Application cannot continue.";
                _showErrorBanner(errorTitle, errorMessage);
                console.error("FATAL: StateManager failed to initialize.");
                return null;
            }

            const state = stateManager.load();
            const saveState = () => stateManager.save(state);

            return { elements, state, saveState };
        },
        _showErrorBanner // Expose for dependency checker fallback
    };
})();

// ============================================================================
// Global Exports
// ============================================================================
window.UIUtils = UIUtils;
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;

// Dashboard App Initializer
AppLifecycle.run(async () => {
    const APP_VERSION = '6.2.0';
    const LOCAL_STORAGE_KEY = 'dashboard_state_v5';
    const APP_CONFIG = {
        NAME: 'dashboard',
        APP_CSV_HEADERS: ['id', 'name', 'urls', 'escalation']
    };

    const defaultState = {
        apps: [],
        notes: [],
        shortcuts: [],
        version: APP_VERSION
    };

    const ctx = await AppLifecycle.initPage({
        storageKey: LOCAL_STORAGE_KEY,
        defaultState,
        version: APP_VERSION,
        requiredElements: [
            'shortcuts-container', 'app-select-group', 'app-select',
            'app-empty-state', 'modal-overlay', 'modal-content', 'app-details-container',
            'app-editor-fields', 'edit-app-name-wrapper', 'edit-app-name', 'edit-app-urls',
            'edit-app-escalation', 'save-changes-btn', 'delete-app-btn', 'add-shortcut-btn-menu',
            'add-new-app-btn-menu',
            'btn-export-csv', 'btn-import-csv', 'btn-settings',
            'notepad-header',
            'note-select', 'notepad-editor', 'toast', 'new-note-btn', 'rename-note-btn', 'delete-note-btn',
            'navbar-container'
        ]
    });

    if (!ctx) return;

    // Call the centralized dashboard initialization function
    if (typeof window.DashboardUI?.initDashboard === 'function') {
        window.DashboardUI.initDashboard(ctx, APP_CONFIG);
    } else {
        console.error("DashboardUI.initDashboard not found. app-ui.js may not have loaded correctly.");
    }
});