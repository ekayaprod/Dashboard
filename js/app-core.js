/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities
 */

// ============================================================================
// UIUtils (Low-level DOM, UI, and helper functions)
// ============================================================================
const UIUtils = {

    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311a1.464 1.464 0 0 1-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.858 2.929 2.929 0 0 1 0 5.858z"/></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 1.5A.5.5 0 0 1 1 1h1.5v1h-1a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5v-1h1v1a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 0 12.5v-10A1.5 1.5 0 0 1 1.5 1H2v.5z"/><path d="M12.5 1a.5.5 0 0 1 .5.5v1.5h1V1.5a1.5 1.5 0 0 0-1.5-1.5h-10A1.5 1.5 0 0 0 1 1.5V3h1V1.5a.5.5 0 0 1 .5-.5z M4 4a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 14 4v10a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 14zm.5 0a.5.5 0 0 0-.5.5v10a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4.5a.5.5 0 0 0-.5-.5z"/></svg>'
    },
    
    validators: {
        _validate: (value, type, options = {}) => {
            if (value == null) return false;
            const str = String(value).trim();
            
            switch(type) {
                case 'url':
                    // Regex to check for:
                    // 1. http(s):// protocol
                    // 2. localhost (optional :port)
                    // 3. Simple hostnames (optional :port) - for internal sites
                    // 4. Fully qualified domains (optional :port)
                    // We are intentionally NOT checking for a TLD (.com, .net)
                    // to allow for internal server names (e.g., "http://my-server/path")
                    const urlRegex = /^(https?:\/\/)?(localhost|[\w-]+)(\.[\w-]+)*(:[0-9]{1,5})?(\/.*)?$/i;
                    if (!urlRegex.test(str)) {
                        return false;
                    }
                    // Do a final check with the URL constructor to catch invalid formats
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
        maxLength: function(value, max) { return this._validate(value, 'maxLength', {max}); }
    },

    /**
     * Dynamically loads the navigation bar.
     */
    loadNavbar: (function() {
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
                // Fetch navbar HTML. A query param is added to break cache on updates.
                const response = await fetch(`navbar.html?v=1.1`);
                if (!response.ok) throw new Error(`Failed to fetch navbar.html: ${response.statusText}`);
                navContainer.innerHTML = await response.text();
            } catch (error) {
                console.error('Failed to load navbar:', error);
                navContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
            }
        };
    })(),

    /**
     * Escapes a string for safe insertion into HTML.
     */
    escapeHTML: (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? ''; // Ensure str is not null/undefined
        return p.innerHTML;
    },

    /**
     * Generates a unique ID with a fallback.
     */
    generateId: () => {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for insecure contexts or older browsers
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    },

    /**
     * Debounces a function.
     */
    debounce: (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    },

    /**
     * Copies text to the clipboard.
     */
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy (navigator.clipboard): ', err);
            // Fallback for insecure contexts (like http://)
            try {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "absolute";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                return true;
            } catch (errFallback) {
                console.error('Failed to copy (execCommand fallback): ', errFallback);
                return false;
            }
        }
    },

    /**
     * Triggers a file download.
     */
    downloadJSON: function(dataStr, filename, mimeType = 'application/json') {
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
            this.showModal("Download Error", "<p>Failed to create download.</p>", [{label: "OK"}]);
            return false;
        }
    },

    /**
     * Programmatically opens a file picker.
     */
    openFilePicker: (callback, accept = "application/json,.json") => {
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

    /**
     * Reads a file as JSON.
     */
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

    /**
     * Reads a file as plain text.
     */
    readTextFile: (file, onSuccess, onError) => {
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
    },

    /**
     * Creates a state manager for localStorage.
     */
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
                        // Wrap callback in try-catch
                        try {
                            onCorruption();
                        } catch (callbackErr) {
                            console.error("onCorruption callback failed:", callbackErr);
                        }
                    }
                    localStorage.setItem(`${key}_corrupted_${Date.now()}`, rawData);
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
                // Use a self-contained modal call in case SafeUI isn't ready
                UIUtils.showModal("Save Error", "<p>Failed to save data. Storage may be full.</p>", [{label: 'OK'}]);
            }
        };

        return { load, save };
    },

    /**
     * Hides the global modal.
     */
    hideModal: () => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
        }
        document.body.classList.remove('modal-open');
    },

    /**
     * Shows the global modal with custom content and buttons.
     */
    showModal: function(title, contentHtml, actions) {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        if (!modalOverlay || !modalContent) {
            console.error('Modal DOM elements (modal-overlay, modal-content) not found.');
            return;
        }
        
        document.body.classList.add('modal-open');

        modalContent.innerHTML = `<h3>${this.escapeHTML(title)}</h3><div>${contentHtml}</div><div class="modal-actions"></div>`;
        const actionsContainer = modalContent.querySelector('.modal-actions');
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `button-base ${action.class || ''}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                // If callback exists and returns false, do not hide modal
                if (action.callback) {
                    if (action.callback() === false) {
                        return; // Explicitly prevent close
                    }
                }
                // Otherwise, hide modal
                this.hideModal();
            };
            actionsContainer.appendChild(btn);
        });
        
        modalOverlay.style.display = 'flex';
    },

    /**
     * Shows a standardized validation error modal and focuses the element.
     */
    showValidationError: function(title, message, focusElementId) {
        this.showModal(title, `<p>${message}</p>`, [{label: 'OK'}]);
        if (focusElementId) {
            // Wait for modal to hide before focusing
            setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
        }
    },


    /**
     * Shows a simple feedback toast message.
     */
    showToast: (function() {
        let activeTimer = null;
        
        return function(message) {
            const toast = document.getElementById('toast');
            if (!toast) return;
            
            if (activeTimer) clearTimeout(activeTimer);
            
            toast.innerHTML = `<span>${this.escapeHTML(message)}</span>`;
            toast.classList.add('show');
            
            activeTimer = setTimeout(() => {
                toast.classList.remove('show');
                activeTimer = null;
            }, 3000);
        };
    })(),
};

// ============================================================================
// SafeUI (Proxy layer providing fallback implementations)
// ============================================================================
const SafeUI = (() => {
    // Check if UIUtils was loaded and initialized
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;
    
    // Provide fallback SVGs in case the main object fails
    const getSVGIcons = () => {
        if (isReady && UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑', settings: '⚙', copy: '📋' };
    };

    // Return a proxied version of UIUtils
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
            // Basic fallback
            return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
        },
        generateId: () => {
            return isReady ? UIUtils.generateId() : Date.now().toString();
        },
        debounce: (func, delay) => {
            return isReady ? UIUtils.debounce(func, delay) : func; // Fallback: no debounce
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
// DOMHelpers (Utilities for DOM manipulation)
// ============================================================================
const DOMHelpers = {
    /**
     * Cache DOM elements and validate they exist
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
            // Simple kebab-to-camel converter (e.g., "btn-add" -> "btnAdd")
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
            textarea.style.height = 'auto'; // Temporarily shrink to get correct scrollHeight
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        };
        
        textarea.addEventListener('input', resize);
        // Store the resize function on the element so we can trigger it manually
        textarea._autoResize = resize;
        resize(); // Initial sizing
    },

    /**
     * Manually trigger a resize on a textarea
     */
    triggerTextareaResize: (textarea) => {
        if (textarea && typeof textarea._autoResize === 'function') {
            textarea._autoResize();
        }
    }
};

// ============================================================================
// AppLifecycle (Core initialization and error handling)
// ============================================================================
const AppLifecycle = {
    
    /**
     * Displays a non-destructive error banner at the top of the page.
     */
    _showErrorBanner: (title, message) => {
        try {
            const bannerId = 'app-startup-error';
            let banner = document.getElementById(bannerId);
            
            // Create banner if it doesn't exist
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
                
                // Prepend to body to ensure it's at the top
                if (document.body) {
                    document.body.prepend(banner);
                } else {
                    // Fallback if body isn't ready
                    document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
                }
            }
            
            banner.innerHTML = `<strong>${SafeUI.escapeHTML(title)}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${SafeUI.escapeHTML(message)}</p>`;
            banner.classList.remove('hidden');
        } catch (e) {
            console.error("Failed to show error banner:", e);
            // Fallback if banner injection fails
            document.body.innerHTML = `<p>${SafeUI.escapeHTML(title)}: ${SafeUI.escapeHTML(message)}</p>`; 
        }
    },

    /**
     * Standard init wrapper with error handling
     */
    run: (initFn) => {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                // Dependency check (for UIUtils itself)
                if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined') {
                    const errorTitle = "Application Failed to Load";
                    const errorMessage = "A critical file (app-core.js) may be missing, failed to load, or is corrupted. Please check the console for errors.";
                    AppLifecycle._showErrorBanner(errorTitle, errorMessage);
                    console.error("FATAL: UIUtils, SafeUI, or DOMHelpers failed to initialize.");
                    return;
                }
                
                // Run the page-specific initialization
                await initFn();
                
            } catch (err) {
                console.error("Unhandled exception during initialization:", err);
                // Use a non-numeric character for the error variable
                const errorTitle = "Application Error";
                const errorMessage = `An unexpected error occurred during startup: ${err.message}. Please check the console for more details.`;
                AppLifecycle._showErrorBanner(errorTitle, errorMessage);
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
            // This error is critical and should stop execution
            const errorTitle = "Application Failed to Start";
            const errorMessage = "One or more critical HTML elements are missing from the page. Application cannot continue. Check console for details.";
            AppLifecycle._showErrorBanner(errorTitle, errorMessage);
            console.error("FATAL: Missing critical DOM elements. Application halted.");
            return null;
        }

        // Initialize state
        const stateManager = SafeUI.createStateManager(storageKey, defaultState, version, onCorruption);
        if (!stateManager) {
            // This error is also critical
            const errorTitle = "Application Failed to Start";
            const errorMessage = "The StateManager (for localStorage) failed to initialize. Application cannot continue.";
            AppLifecycle._showErrorBanner(errorTitle, errorMessage);
            console.error("FATAL: StateManager failed to initialize.");
            return null;
        }

        const state = stateManager.load();
        const saveState = () => stateManager.save(state);
        
        return { elements, state, saveState };
    }
};

// Expose components to the global window scope
// This makes them accessible to the inline scripts and dependency checkers
window.UIUtils = UIUtils;
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;