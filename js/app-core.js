/**
 * app-core.js
 * (Was ui.common.js + app-core.js)
 * Core application initialization, SafeUI wrapper, and DOM utilities
 */

// --- Low-level UI Utilities ---
const UIUtils = {

    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.75a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 4.75zM8 8a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 8zm0 3.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75zM4.75 8a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 4.75 8zm3.25 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 8zm3.25 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 11.25 8zm-6.5-3.25a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 4.75 4.75zm3.25 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 4.75zm3.25 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 11.25 4.75z"/></svg>'
    },
    
    validators: {
        _validate: (value, type, options = {}) => {
            if (value == null) return false;
            const str = String(value).trim();
            
            switch(type) {
                case 'url':
                    if (/^https?:\/\//.test(str) || /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(str)) {
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
                    }
                    return false;
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
        maxLength: function(value, max) { return this._validate(value, 'maxLength', {max}); }
    },

    loadNavbar: (() => {
        const loadedNavbars = new Set();
        return (containerId) => {
            if (!containerId || loadedNavbars.has(containerId)) {
                return;
            }
            loadedNavbars.add(containerId);

            const navContainer = document.getElementById(containerId);
            if (!navContainer) {
                console.error(`Navbar container "${containerId}" not found.`);
                return;
            }

            fetch('navbar.html')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to fetch navbar.html: ${response.statusText}`);
                    }
                    return response.text();
                })
                .then(html => {
                    navContainer.innerHTML = html;
                    // Remove the self-activating script after it runs
                    const scriptTag = navContainer.querySelector('#nav-active-script');
                    if (scriptTag) {
                        scriptTag.remove();
                    }
                })
                .catch(error => {
                    console.error('Failed to load navbar:', error);
                    navContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
                    loadedNavbars.delete(containerId); // Allow retry
                });
        };
    })(),

    escapeHTML: (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    },

    generateId: () => {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    },

    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    },

    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy: ', err);
            return false;
        }
    },

    downloadJSON: (dataStr, filename, mimeType = 'application/json') => {
        try {
            if (typeof dataStr !== 'string' || !filename) {
                throw new Error('Invalid parameters');
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
            console.error("Failed to download file:", error);
            UIUtils.showModal("Download Error", "<p>Failed to create download.</p>", [{label: "OK"}]);
            return false;
        }
    },

    openFilePicker: (callback, accept) => {
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
    },

    readJSONFile: (file, onSuccess, onError) => {
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
    },

    // --- FIX: Added readTextFile for CSV import ---
    readTextFile: (file, onSuccess, onError) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            onSuccess(event.target.result);
        };
        reader.onerror = () => {
            console.error("Failed to read file.");
            onError("Failed to read the file.");
        };
        reader.readAsText(file);
    },

    createStateManager: (key, defaults, version, onCorruption) => {
        if (!key || typeof key !== 'string' || !defaults || typeof defaults !== 'object' || !version) {
            console.error("createStateManager requires valid key (string), defaults (object), and version.");
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
                        onCorruption();
                    }
                    localStorage.setItem(`${key}_corrupted_${Date.now()}`, rawData);
                    data = { ...defaults };
                }
            } else {
                data = { ...defaults };
            }
            // Ensure all default keys are present even if loading valid data
            return { ...defaults, ...data };
        };

        const save = (state) => {
            try {
                state.version = version;
                localStorage.setItem(key, JSON.stringify(state));
            } catch (err) {
                console.error("Failed to save state:", err);
                UIUtils.showModal("Save Error", "<p>Failed to save data. Storage may be full.</p>", [{label: 'OK'}]);
            }
        };

        return { load, save };
    },

    hideModal: () => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    },

    showModal: function(title, contentHtml, actions) {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        if (!modalOverlay || !modalContent) {
            console.error('Modal DOM elements (modal-overlay, modal-content) not found.');
            return;
        }

        modalContent.innerHTML = `<h3>${UIUtils.escapeHTML(title)}</h3><div>${contentHtml}</div><div class="modal-actions"></div>`;
        const actionsContainer = modalContent.querySelector('.modal-actions');
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `button-base ${action.class || ''}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                if (!action.callback || action.callback() !== false) {
                    UIUtils.hideModal();
                }
            };
            actionsContainer.appendChild(btn);
        });
        
        modalOverlay.style.display = 'flex';
    },

    showValidationError: function(title, message, focusElementId) {
        this.showModal(title, `<p>${message}</p>`, [{label: 'OK'}]);
        if (focusElementId) {
            setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
        }
    },


    showToast: (function() {
        let activeTimer = null;
        
        return function(message) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            
            if (activeTimer) clearTimeout(activeTimer);
            
            toast.innerHTML = `<span>${UIUtils.escapeHTML(message)}</span>`;
            toast.classList.add('show');
            
            activeTimer = setTimeout(() => {
                toast.classList.remove('show');
                activeTimer = null;
            }, 3000);
        };
    })(),
};

// --- Modal Global Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // This listener is redundant if we ensure modal exists before use, but harmless
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') {
            UIUtils.hideModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UIUtils.hideModal();
        }
    });
});


/**
 * SafeUI - Wrapper around UIUtils for graceful degradation
 * Ensures app doesn't crash if ui.common.js fails to load.
 */
const SafeUI = (() => {
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;
    
    const getSVGIcons = () => {
        if (isReady && UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑', settings: '⚙️' };
    };

    return {
        isReady,
        SVGIcons: getSVGIcons(),
        loadNavbar: (containerId) => isReady && UIUtils.loadNavbar(containerId),
        showModal: (title, content, actions) => isReady ? UIUtils.showModal(title, content, actions) : console.error("UIUtils not loaded", title),
        showValidationError: (title, msg, elId) => isReady ? UIUtils.showValidationError(title, msg, elId) : console.error("UIUtils not loaded", title),
        hideModal: () => isReady && UIUtils.hideModal(),
        showToast: (msg) => isReady ? UIUtils.showToast(msg) : console.log("Toast:", msg),
        escapeHTML: (str) => isReady ? UIUtils.escapeHTML(str) : (str || ''),
        generateId: () => isReady ? UIUtils.generateId() : Date.now().toString(),
        debounce: (func, delay) => isReady ? UIUtils.debounce(func, delay) : func,
        copyToClipboard: (text) => isReady ? UIUtils.copyToClipboard(text) : Promise.resolve(false),
        downloadJSON: (data, filename, mime) => isReady && UIUtils.downloadJSON(data, filename, mime),
        openFilePicker: (cb, accept) => isReady && UIUtils.openFilePicker(cb, accept),
        readJSONFile: (file, onSuccess, onError) => isReady ? UIUtils.readJSONFile(file, onSuccess, onError) : onError("UI Framework not loaded."),
        readTextFile: (file, onSuccess, onError) => isReady ? UIUtils.readTextFile(file, onSuccess, onError) : onError("UI Framework not loaded."),
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
     */
    cacheElements: (requiredIds) => {
        const elements = {};
        let allFound = true;
        
        for (const id of requiredIds) {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`FATAL: DOM element with id "${id}" not found.`);
                allFound = false;
                // --- FIX: This was the bug. We must 'continue' here. ---
                // If we don't, the line below adds a key with a 'null' value,
                // but allFound is still false, initPage returns null,
                // and ctx is null, leading to a *different* error.
                // The user's log (undefined error) means the key was
                // never added, which is what this 'continue' enforces.
                continue;
            }
            // Convert kebab-case to camelCase: 'app-search-input' → 'appSearchInput'
            elements[id.replace(/-(\w)/g, (m, g) => g.toUpperCase())] = el;
        }
        
        return { elements, allFound };
    },

    /**
     * Setup auto-resize for textarea elements
     */
    setupTextareaAutoResize: (textarea, maxHeight = 300) => {
        if (!textarea) return;
        
        const resize = () => {
            textarea.style.height = 'auto'; // Reset height
            const newHeight = Math.min(textarea.scrollHeight, maxHeight);
            textarea.style.height = newHeight + 'px';
        };
        
        textarea.addEventListener('input', resize);
        // Also trigger resize on 'change' which fires after data is set
        textarea.addEventListener('change', resize); 
        resize(); // Initial sizing
    }
};

/**
 * AppLifecycle - Application initialization and error handling
 */
const AppLifecycle = {
    /**
     * Standard init wrapper with error handling
     */
    run: (initFn) => {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // Validate SafeUI loaded
                if (!SafeUI || !SafeUI.isReady) {
                    console.error("FATAL: UIUtils or SafeUI failed to initialize.");
                    document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                        <h2>Application Failed to Load</h2>
                        <p>A critical file (app-core.js) may be missing or failed to load. Please check the console for errors.</p>
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
     */
    initPage: async (config) => {
        const { storageKey, defaultState, version, requiredElements, onCorruption } = config;

        // Cache DOM elements
        const { elements, allFound } = DOMHelpers.cacheElements(requiredElements);
        if (!allFound) {
            console.error("FATAL: Missing critical DOM elements. Application halted.");
            return null; // This guard prevents the app from running in a broken state
        }

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

// --- FIX: Expose global modules ---
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;

