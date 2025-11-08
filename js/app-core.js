/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities.
 */

// --- FIX (Mode F) ---
const CORE_VERSION = '2.5.1';
// --- END FIX ---

// ============================================================================
// MODULE: SVGIcons
// ============================================================================
const SVGIcons = Object.freeze({
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
    pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 0 1-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 0 1-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 0 1 .52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 0 1 1.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 0 1 1.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 0 1 .52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 0 1-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 0 1-1.255-.52l-.094-.319zM8 10.93a2.929 2.929 0 1 1 0-5.858 2.929 2.929 0 0 1 0 5.858z"/></svg>',
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
// MODULE: DataHelpers (NEW MODULE from Mode C Refactor)
// ============================================================================
const DataHelpers = Object.freeze({
    /**
     * Safely gets a collection array from the state object.
     * @param {object} state - The global state object.
     * @param {string} type - The key of the collection (e.g., 'apps', 'notes').
     * @returns {Array} The collection array or an empty array.
     */
    getCollection: (state, type) => {
        return (state && Array.isArray(state[type])) ? state[type] : [];
    },

    /**
     * Checks if a collection has items.
     * @param {object} state - The global state object.
     * @param {string} type - The key of the collection.
     * @returns {boolean} True if the collection exists and has items.
     */
    hasItems: (state, type) => {
        return (state && Array.isArray(state[type])) ? state[type].length > 0 : false;
    },

    /**
     * Finds an item by its ID in a collection.
     * @param {object} state - The global state object.
     * @param {string} collectionType - The key of the collection.
     * @param {string} id - The ID of the item to find.
     * @returns {object|null} The found item or null.
     */
    findById: (state, collectionType, id) => {
        if (!id || !state || !Array.isArray(state[collectionType])) {
            return null;
        }
        return state[collectionType].find(item => item.id === id) || null;
    }
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
                // --- FIX (Mode F) ---
                // Removed ?v=1.1 query string per user request
                const response = await fetch(`navbar.html`);
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
     * Reads a file as plain text. (Internal helper)
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
     * Reads a file as JSON.
     * --- FIX (Mode D) ---
     * Refactored to call readTextFile, removing duplicate logic.
     */
    const readJSONFile = (file, onSuccess, onError) => {
        readTextFile(file, (text) => {
            try {
                const data = JSON.parse(text);
                onSuccess(data);
            } catch (err) {
                console.error("Failed to parse JSON:", err);
                onError("File is not valid JSON.");
            }
        }, onError); // Pass the original onError handler
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
                    
                    // --- FIX (Mode E) ---
                    // Removed the state-wiping version check.
                    // The version is now only used for the key.
                    // We will log if a mismatch is found but take no action.
                    if (data.version !== version) {
                        console.warn(`State version mismatch (found ${data.version}, expected ${version}). Loading state anyway.`);
                        // data = { ...defaults }; // <-- This line was removed
                    }
                    // --- END FIX ---
                    
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
                    _showModal('Data Corruption Detected', '<p>Your saved data was corrupted and has been reset. A backup was saved with timestamp.</p>', [{label: 'OK'}]);
                    data = { ...defaults };
                }
            } else {
                data = { ...defaults };
            }
            
            // --- FIX (Mode E) ---
            // Ensure version property is set on new/default state
            if (!data.version) {
                data.version = version;
            }
            // --- END FIX ---
            
            return data;
        };

        // --- START FIX: ISSUE 4 (Storage Error Logging) ---
        const save = (state) => {
            let serialized; // Hoist serialized to be accessible in catch block
            try {
                // --- FIX (Mode E) ---
                // Ensure version is always set on save
                state.version = version;
                // --- END FIX ---
                
                serialized = JSON.stringify(state);
                
                // console.log('Saving state to localStorage:', key, serialized.length, 'chars');
                
                // Check if we're near quota (5MB typical limit)
                if (serialized.length > 4.5 * 1024 * 1024) {
                    console.warn('WARNING: State approaching localStorage 5MB limit');
                }
                
                localStorage.setItem(key, serialized);
                // console.log('Save successful');
                
                // Verify save worked by reading back
                const verification = localStorage.getItem(key);
                if (!verification || verification.length !== serialized.length) {
                    throw new Error('Save verification failed - data mismatch');
                }
            } catch (err) {
                console.error("Failed to save state:", err);
                // Use hoisted variable, check if it was defined before error
                const stateSize = (typeof serialized !== 'undefined') ? serialized.length : 'unknown';
                console.error("State size:", stateSize, 'bytes');
                console.error("localStorage available:", typeof Storage !== 'undefined');
                
                _showModal("Save Error", 
                    `<p>Failed to save data: ${SafeUI.escapeHTML(err.message)}</p>
                     <p>State size: ${Math.round(((typeof serialized !== 'undefined') ? serialized.length : 0) / 1024)}KB</p>`, 
                    [{ label: 'OK' }]
                );
            }
        };
        // --- END FIX: ISSUE 4 ---

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
        readTextFile: readTextFile, // Expose readTextFile
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
                // Use the .app-startup-banner class from style.css
                banner.className = 'app-startup-banner';

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

    // --- Page Exit Handling System ---
    let onExitSaveFunctions = [];
    let beforeUnloadPrompt = null;

    // This listener handles silent saving for navigation, tab closing, etc.
    window.addEventListener('pagehide', () => {
        // DEBUG: Log pagehide saves
        // console.log('Page hiding, running save functions:', onExitSaveFunctions.length);
        onExitSaveFunctions.forEach(fn => {
            try {
                fn();
                // console.log('Save function executed successfully');
            } catch (e) {
                console.error("Error during pagehide save function:", e);
            }
        });
        // End DEBUG
    });

    // This listener handles the user prompt (e.g., "Discard changes?")
    window.addEventListener('beforeunload', (e) => {
        let promptMessage = null;
        if (typeof beforeUnloadPrompt === 'function') {
            promptMessage = beforeUnloadPrompt();
        }
        
        if (promptMessage) {
            e.preventDefault();
            e.returnValue = promptMessage;
            return promptMessage;
        }
    });
    // --- End Page Exit Handling System ---


    return {
        /**
         * Standard init wrapper with error handling.
         */
        run: (initFn) => {
            // --- FIX (Mode F) ---
            // Log core version as soon as this module runs.
            console.log(`AppLifecycle: Running app-core.js v${CORE_VERSION}`);
            // --- END FIX ---
            
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
            // --- FIX (Mode E) ---
            // Removed version from the destructured config as it's no longer
            // passed to createStateManager in this way.
            const { storageKey, defaultState, requiredElements, onCorruption } = config;
            
            // (FIX - Mode E) Get version from config (which has it from the inline script)
            const appVersion = config.version;
            if (!appVersion) {
                 console.error("AppLifecycle.initPage: No version found in config.");
            }
            // --- END FIX ---

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
            // --- FIX (Mode E) ---
            // Pass the appVersion to createStateManager
            const stateManager = SafeUI.createStateManager(storageKey, defaultState, appVersion, onCorruption);
            if (!stateManager) {
                const errorTitle = "Application Failed to Start";
                const errorMessage = "The StateManager (for localStorage) failed to initialize. Application cannot continue.";
                _showErrorBanner(errorTitle, errorMessage);
                console.error("FATAL: StateManager failed to initialize.");
                return null;
            }

            // --- START REFACTOR ---
            // FIX 3: Automatically load settings icon if the button exists
            if (elements.btnSettings) {
                elements.btnSettings.innerHTML = SafeUI.SVGIcons.settings;
            }
            // FIX 2: Automatically load navbar if the container exists
            if (elements.navbarContainer) {
                await SafeUI.loadNavbar("navbar-container");
            }
            // --- END REFACTOR ---

            const state = stateManager.load();
            const saveState = () => stateManager.save(state);

            return { elements, state, saveState };
        },
        
        /**
         * Registers a function to be called silently on page exit (pagehide).
         * Used for saving data without prompting the user.
         */
        registerSaveOnExit: (saveFunction) => {
            if (typeof saveFunction === 'function') {
                onExitSaveFunctions.push(saveFunction);
            } else {
                console.error("registerSaveOnExit: provided argument is not a function.");
            }
        },

        /**
         * Registers a function to be called on beforeunload.
         * If the function returns a string, the user will be prompted to leave.
         */
        registerPromptOnExit: (promptFunction) => {
            if (typeof promptFunction === 'function') {
                beforeUnloadPrompt = promptFunction;
            } else {
                console.error("registerPromptOnExit: provided argument is not a function.");
            }
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
window.DataHelpers = DataHelpers; // (FIX - Mode C)

// --- FIX (Mode F) ---
window.APP_CORE_VERSION = CORE_VERSION;
// --- END FIX ---
