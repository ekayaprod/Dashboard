/**
 * ============================================================================
 * app-core.js
 * * This is the foundational script for the application.
 * It merges the original ui.common.js and app-core.js.
 * * It MUST be loaded FIRST, as it defines:
 * 1. UIUtils: Low-level UI functions (modals, toasts, etc.)
 * 2. SafeUI: A wrapper for UIUtils.
 * 3. DOMHelpers: DOM utility functions.
 * 4. AppLifecycle: The main application bootstrap.
 * ============================================================================
 */

/**
 * ----------------------------------------------------------------------------
 * Section 1: UIUtils (from ui.common.js)
 * Defines low-level, dependency-free UI and utility functions.
 * ----------------------------------------------------------------------------
 */
const UIUtils = {

    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>'
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
        const loaded = new Set();
        return async (containerId) => {
            if (loaded.has(containerId)) return;
            loaded.add(containerId);
            
            const navContainer = document.getElementById(containerId);
            if (!navContainer) {
                console.error(`Navbar container "${containerId}" not found.`);
                loaded.delete(containerId);
                return;
            }

            try {
                const response = await fetch('navbar.html');
                if (!response.ok) throw new Error(`Failed to fetch navbar.html: ${response.statusText}`);
                navContainer.innerHTML = await response.text();
            } catch (error) {
                console.error('Failed to load navbar:', error);
                navContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
                loaded.delete(containerId);
            }
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

    downloadJSON: function(dataStr, filename) {
        try {
            if (typeof dataStr !== 'string' || !filename) {
                throw new Error('Invalid parameters');
            }
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
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
            console.error("Failed to download JSON:", error);
            this.showModal("Download Error", "<p>Failed to create download.</p>", [{label: "OK"}]);
            return false;
        }
    },

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
            return data;
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

        modalContent.innerHTML = `<h3>${this.escapeHTML(title)}</h3><div>${contentHtml}</div><div class="modal-actions"></div>`;
        const actionsContainer = modalContent.querySelector('.modal-actions');
        
        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `button-base ${action.class || ''}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                if (!action.callback || action.callback() !== false) {
                    this.hideModal();
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
            
            toast.innerHTML = `<span>${this.escapeHTML(message)}</span>`;
            toast.classList.add('show');
            
            activeTimer = setTimeout(() => {
                toast.classList.remove('show');
                activeTimer = null;
            }, 3000);
        };
    })(),
};

document.addEventListener('DOMContentLoaded', () => {
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target.id === 'modal-overlay') {
                UIUtils.hideModal();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            UIUtils.hideModal();
        }
    });
});


/**
 * ----------------------------------------------------------------------------
 * Section 2: SafeUI, DOMHelpers, AppLifecycle (from app-core.js)
 * Defines the core bootstrap and safe wrappers that depend on UIUtils.
 * ----------------------------------------------------------------------------
 */

const SafeUI = (() => {
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;
    
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

const DOMHelpers = {
    cacheElements: (requiredIds) => {
        const elements = {};
        let allFound = true;
        
        for (const id of requiredIds) {
            const el = document.getElementById(id);
            if (!el) {
                console.error(`FATAL: DOM element with id "${id}" not found.`);
                allFound = false;
            }
            elements[id.replace(/-(\w)/g, (m, g) => g.toUpperCase())] = el;
        }
        
        return { elements, allFound };
    },

    setupTextareaAutoResize: (textarea, maxHeight = 300) => {
        if (!textarea) return;
        
        const resize = () => {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
        };
        
        textarea.addEventListener('input', resize);
        resize();
    }
};

const AppLifecycle = {
    run: (initFn) => {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                if (!SafeUI || !SafeUI.isReady) {
                    console.error("FATAL: UIUtils or SafeUI failed to initialize.");
                    document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: red; font-family: sans-serif;">
                        <h2>Application Failed to Load</h2>
                        <p>A critical file (ui.common.js) may be missing or failed to load. Please check the console for errors.</p>
                    </div>`;
                    return;
                }
                
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

    initPage: async (config) => {
        const { pageName, storageKey, defaultState, version, requiredElements, onCorruption } = config;

        const { elements, allFound } = DOMHelpers.cacheElements(requiredElements);
        if (!allFound) {
            console.error("FATAL: Missing critical DOM elements. Application halted.");
            return null;
        }

        await SafeUI.loadNavbar("navbar-container");

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