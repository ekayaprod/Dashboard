/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities.
 * Version: 2.7.1 (Fix localStorage migration)
 */

const CORE_VERSION = '2.7.1';

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
                if (!urlRegex.test(str)) return false;
                try {
                    let testUrl = str;
                    if (!/^https?:\/\//.test(testUrl)) testUrl = 'http://' + testUrl;
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
// MODULE: DataHelpers
// ============================================================================
const DataHelpers = Object.freeze({
    getCollection: (state, type) => {
        return (state && Array.isArray(state[type])) ? state[type] : [];
    },
    hasItems: (state, type) => {
        return (state && Array.isArray(state[type])) ? state[type].length > 0 : false;
    },
    findById: (state, collectionType, id) => {
        if (!id || !state || !Array.isArray(state[collectionType])) {
            return null;
        }
        return state[collectionType].find(item => item.id === id) || null;
    }
});

// ============================================================================
// MODULE: UIUtils
// ============================================================================
const UIUtils = (() => {
    // loadNavbar is now handled by bootstrap.js but kept as fallback utility
    const loadNavbar = (function() {
        let loaded = false;
        return async function(containerId) {
            if (loaded) return;
            const navContainer = document.getElementById(containerId);
            if (!navContainer || navContainer.children.length > 0) {
                // Already populated by bootstrap or invalid
                return; 
            }

            try {
                console.log('[loadNavbar] Fetching navbar.html...');
                const response = await fetch(`navbar.html`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                navContainer.innerHTML = await response.text();
                loaded = true;
            } catch (error) {
                console.error('Failed to load navbar:', error);
                navContainer.innerHTML = `<div style="background: #fef2f2; color: #dc2626; padding: 0.5rem;">⚠️ Navigation failed to load: ${error.message}</div>`;
            }
        };
    })();

    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    };

    const generateId = () => {
        if (crypto && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    };

    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), delay);
        };
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            return false;
        }
    };

    const downloadJSON = function(dataStr, filename, mimeType = 'application/json') {
        try {
            if (typeof dataStr !== 'string' || !filename) throw new Error('Invalid download parameters.');
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

    const openFilePicker = (callback, accept = "application/json,.json") => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) callback(file);
        };
        input.click();
    };
    
    const readTextFile = (file, onSuccess, onError) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try { onSuccess(event.target.result); } 
            catch (err) { onError("Failed to read file as text."); }
        };
        reader.onerror = () => onError("Failed to read the file.");
        reader.readAsText(file);
    };

    const parseJSON = (jsonString, onSuccess, onError) => {
        try {
            const parsed = JSON.parse(jsonString);
            onSuccess(parsed);
        } catch (err) {
            const errorMsg = `Invalid JSON: ${err.message}`;
            if (onError) onError(errorMsg);
            else _showModal('Parse Error', `<p>${escapeHTML(errorMsg)}</p>`, [{label: 'OK'}]);
        }
    };

    const readJSONFile = (file, onSuccess, onError) => {
        readTextFile(file, (text) => {
            parseJSON(text, onSuccess, onError);
        }, onError);
    };

    const createStateManager = (key, defaults, version, onCorruption) => {
        if (!key || typeof key !== 'string' || !defaults || typeof defaults !== 'object' || !version) {
            console.error("State Manager initialization error: Invalid parameters provided.");
            return null;
        }

        const load = () => {
            let data;
            const rawData = localStorage.getItem(key);

            if (rawData) {
                parseJSON(rawData, 
                    (parsed) => {
                        data = parsed;
                        if (data.version !== version) {
                            console.warn(`State version mismatch. Loading state anyway.`);
                        }
                    },
                    (err) => {
                        if (onCorruption) {
                            try { onCorruption(); } catch (e) {}
                        }
                        localStorage.setItem(`${key}_corrupted_${Date.now()}`, rawData);
                        _showModal('Data Corruption Detected', '<p>Your saved data was corrupted and has been reset. A backup was saved.</p>', [{label: 'OK'}]);
                        data = { ...defaults };
                    }
                );
            } else {
                data = { ...defaults };
            }
            
            if (data && !data.version) data.version = version;
            return data || { ...defaults, version };
        };

        const save = (state) => {
            let serialized;
            try {
                state.version = version;
                serialized = JSON.stringify(state);
                localStorage.setItem(key, serialized);
                
                // Verify save
                const verification = localStorage.getItem(key);
                if (!verification || verification.length !== serialized.length) {
                    throw new Error('Save verification failed - data mismatch');
                }
            } catch (err) {
                console.error("Failed to save state:", err);
                _showModal("Save Error", `<p>Failed to save data: ${escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
            }
        };

        return { load, save };
    };

    const _hideModal = () => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) modalOverlay.style.display = 'none';
        document.body.classList.remove('modal-open');
    };

    const _showModal = function(title, contentHtml, actions) {
        const modalOverlay = document.getElementById('modal-overlay');
        const modalContent = document.getElementById('modal-content');
        if (!modalOverlay || !modalContent) return;
        
        document.body.classList.add('modal-open');
        modalContent.innerHTML = `<h3>${escapeHTML(title)}</h3><div>${contentHtml}</div><div class="modal-actions"></div>`;
        const actionsContainer = modalContent.querySelector('.modal-actions');

        actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = `button-base ${action.class || ''}`;
            btn.textContent = action.label;
            btn.onclick = () => {
                if (action.callback) {
                    if (action.callback() === false) return;
                }
                _hideModal();
            };
            actionsContainer.appendChild(btn);
        });
        modalOverlay.style.display = 'flex';
    };

    const showValidationError = function(title, message, focusElementId) {
        _showModal(title, `<p>${escapeHTML(message)}</p>`, [{ label: 'OK' }]);
        if (focusElementId) {
            setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
        }
    };

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

    return {
        SVGIcons,
        validators: CoreValidators,
        loadNavbar,
        escapeHTML,
        generateId,
        debounce,
        copyToClipboard,
        downloadJSON,
        openFilePicker,
        readJSONFile,
        readTextFile,
        parseJSON,
        createStateManager,
        hideModal: _hideModal,
        showModal: _showModal,
        showValidationError,
        showToast,
    };
})();

// ============================================================================
// MODULE: SafeUI (Proxy layer)
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
        loadNavbar: (containerId) => { if (isReady) UIUtils.loadNavbar(containerId); },
        showModal: (title, content, actions) => { if (isReady) return UIUtils.showModal(title, content, actions); },
        showValidationError: (title, msg, elId) => { if (isReady) return UIUtils.showValidationError(title, msg, elId); },
        hideModal: () => { if (isReady) UIUtils.hideModal(); },
        showToast: (msg) => { if (isReady) return UIUtils.showToast(msg); },
        escapeHTML: (str) => isReady ? UIUtils.escapeHTML(str) : str,
        generateId: () => isReady ? UIUtils.generateId() : Date.now().toString(),
        debounce: (func, delay) => isReady ? UIUtils.debounce(func, delay) : func,
        copyToClipboard: (text) => isReady ? UIUtils.copyToClipboard(text) : Promise.resolve(false),
        downloadJSON: (data, filename, mimeType) => { if (isReady) return UIUtils.downloadJSON(data, filename, mimeType); },
        openFilePicker: (cb, accept) => { if (isReady) return UIUtils.openFilePicker(cb, accept); },
        readJSONFile: (file, onSuccess, onError) => { if (isReady) return UIUtils.readJSONFile(file, onSuccess, onError); },
        readTextFile: (file, onSuccess, onError) => { if (isReady) return UIUtils.readTextFile(file, onSuccess, onError); },
        parseJSON: (str, success, error) => { if (isReady) return UIUtils.parseJSON(str, success, error); },
        createStateManager: (key, defaults, version, onCorruption) => { return isReady ? UIUtils.createStateManager(key, defaults, version, onCorruption) : null; },
        validators: isReady ? UIUtils.validators : { url: (v) => v, notEmpty: (v) => v, maxLength: (v, m) => v }
    };
})();

// ============================================================================
// MODULE: DOMHelpers
// ============================================================================
const DOMHelpers = (() => {
    return {
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
        triggerTextareaResize: (textarea) => {
            if (textarea && typeof textarea._autoResize === 'function') textarea._autoResize();
        }
    };
})();

// ============================================================================
// MODULE: AppLifecycle
// ============================================================================
const AppLifecycle = (() => {
    const _showErrorBanner = (title, message) => {
        try {
            const bannerId = 'app-startup-error';
            let banner = document.getElementById(bannerId);
            if (!banner) {
                banner = document.createElement('div');
                banner.id = bannerId;
                banner.className = 'app-startup-banner';
                if (document.body) document.body.prepend(banner);
                else document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
            }
            banner.innerHTML = `<strong>${SafeUI.escapeHTML(title)}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${SafeUI.escapeHTML(message)}</p>`;
            banner.classList.remove('hidden');
        } catch (e) {
            console.error("Failed to show error banner:", e);
        }
    };

    let onExitSaveFunctions = [];
    let beforeUnloadPrompt = null;

    window.addEventListener('pagehide', () => {
        onExitSaveFunctions.forEach(fn => {
            try { fn(); } catch (e) { console.error("Error during pagehide save function:", e); }
        });
    });

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

    return {
        run: (initFn) => {
            document.addEventListener('DOMContentLoaded', async () => {
                try {
                    if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined') {
                        _showErrorBanner("Application Failed to Load", "Critical dependencies missing.");
                        return;
                    }
                    await initFn();
                } catch (err) {
                    console.error("Unhandled exception during initialization:", err);
                    _showErrorBanner("Application Error", `Unexpected error: ${err.message}`);
                }
            });
        },

        initPage: async (config) => {
            const { storageKey, defaultState, requiredElements, onCorruption, version } = config;
            
            const { elements, allFound } = DOMHelpers.cacheElements(requiredElements);
            if (!allFound) {
                _showErrorBanner("Application Failed to Start", "Missing critical DOM elements.");
                return null;
            }

            const stateManager = SafeUI.createStateManager(storageKey, defaultState, version, onCorruption);
            if (!stateManager) {
                _showErrorBanner("Application Failed to Start", "StateManager failed to initialize.");
                return null;
            }

            if (elements.btnSettings) elements.btnSettings.innerHTML = SafeUI.SVGIcons.settings;
            
            // REMOVED: await SafeUI.loadNavbar("navbar-container");
            // Navbar is now loaded by bootstrap.js before this function runs.

            let state = stateManager.load();
            
            // --- FIX: Robust State Migration Helper ---
            let stateWasMigrated = false;
            if (Array.isArray(state)) {
                // This is an old array-based state. Convert it.
                console.warn(`[AppLifecycle] Migrating legacy array state for ${storageKey}`);
                const oldData = state;
                state = JSON.parse(JSON.stringify(defaultState)); // Deep copy default
                
                // Find the key in defaultState that is an array (e.g., 'library', 'apps')
                const dataKey = Object.keys(state).find(k => Array.isArray(state[k]));
                if (dataKey) {
                    state[dataKey] = oldData;
                } else {
                    console.error(`[AppLifecycle] Migration failed: Couldn't find target array in defaultState.`);
                }
                stateWasMigrated = true;
            } else if (!state || typeof state !== 'object') {
                // State is corrupt (e.g., null, string)
                 console.error(`[AppLifecycle] State for ${storageKey} is corrupt. Resetting to default.`);
                 state = JSON.parse(JSON.stringify(defaultState));
                 stateWasMigrated = true;
            } else if (!state.ui && defaultState.ui) {
                // State is an object, but missing the 'ui' property
                console.log(`[AppLifecycle] Migrating state for ${storageKey}: Added UI state`);
                state.ui = { ...defaultState.ui };
                stateWasMigrated = true;
            }
            // --- END FIX ---

            const saveState = () => stateManager.save(state);

            if (stateWasMigrated) {
                saveState(); // Save the migrated state immediately
            }

            return { elements, state, saveState };
        },
        
        registerSaveOnExit: (saveFunction) => {
            if (typeof saveFunction === 'function') onExitSaveFunctions.push(saveFunction);
        },

        registerPromptOnExit: (promptFunction) => {
            if (typeof promptFunction === 'function') beforeUnloadPrompt = promptFunction;
        },
        
        _showErrorBanner
    };
})();

window.UIUtils = UIUtils;
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;
window.DataHelpers = DataHelpers;