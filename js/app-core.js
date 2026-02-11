/**
 * app-core.js
 * Core application initialization, SafeUI wrapper, and DOM utilities.
 */

// ============================================================================
// MODULE: SVGIcons
// ============================================================================
const SVGIcons = Object.freeze({
    plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
    settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>',
    copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>',
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
    template: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>',
    move: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5.854 8.854a.5.5 0 1 0-.708-.708L4 11.293V1.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2z"/></svg>'
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
    // Shared buffer for random number generation to avoid allocation per call
    const randomBuffer = new Uint32Array(1);

    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    };

    const generateId = () => {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
            }
        } catch (e) {
            console.warn('crypto.randomUUID not available, falling back to Date.now()');
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

    const capitalize = (str) => {
        if (!str) return '';
        return String(str).charAt(0).toUpperCase() + String(str).slice(1).toLowerCase();
    };

    const getRandomInt = (max) => {
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            try {
                if (max <= 0) return 0;
                const limit = 0xFFFFFFFF - (0xFFFFFFFF % max);
                let r;
                do {
                    crypto.getRandomValues(randomBuffer);
                    r = randomBuffer[0];
                } while (r >= limit);
                return r % max;
            } catch (e) {}
        }
        return Math.floor(Math.random() * max);
    };

    const copyToClipboard = async (text) => {
        if (!navigator.clipboard) {
            console.error('Clipboard API not available');
            return false;
        }
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
            const rawData = localStorage.getItem(key);
            if (!rawData) {
                return { ...defaults, version };
            }

            let data;
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
            
            if (data && !data.version) data.version = version;
            return data || { ...defaults, version };
        };

        const save = (state) => {
            try {
                state.version = version;
                const serialized = JSON.stringify(state);
                localStorage.setItem(key, serialized);
                
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
            btn.className = `btn ${action.class || ''}`;
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
        escapeHTML,
        generateId,
        debounce,
        capitalize,
        getRandomInt,
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
    const getSVGIcons = () => {
        if (UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑', settings: '⚙', copy: '📋' };
    };

    return {
        isReady: true,
        SVGIcons: getSVGIcons(),
        showModal: (title, content, actions) => UIUtils.showModal(title, content, actions),
        showValidationError: (title, msg, elId) => UIUtils.showValidationError(title, msg, elId),
        hideModal: () => UIUtils.hideModal(),
        showToast: (msg) => UIUtils.showToast(msg),
        escapeHTML: (str) => UIUtils.escapeHTML(str),
        generateId: () => UIUtils.generateId(),
        debounce: (func, delay) => UIUtils.debounce(func, delay),
        capitalize: (str) => UIUtils.capitalize(str),
        getRandomInt: (max) => UIUtils.getRandomInt(max),
        copyToClipboard: (text) => UIUtils.copyToClipboard(text),
        downloadJSON: (data, filename, mimeType) => UIUtils.downloadJSON(data, filename, mimeType),
        openFilePicker: (cb, accept) => UIUtils.openFilePicker(cb, accept),
        readJSONFile: (file, onSuccess, onError) => UIUtils.readJSONFile(file, onSuccess, onError),
        readTextFile: (file, onSuccess, onError) => UIUtils.readTextFile(file, onSuccess, onError),
        parseJSON: (str, success, error) => UIUtils.parseJSON(str, success, error),
        createStateManager: (key, defaults, version, onCorruption) => UIUtils.createStateManager(key, defaults, version, onCorruption),
        validators: UIUtils.validators
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
            let rafId;
            const resize = () => {
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    textarea.style.height = 'auto';
                    textarea.style.height = Math.min(textarea.scrollHeight, maxHeight) + 'px';
                });
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
// MODULE: DateUtils
// ============================================================================
const DateUtils = {
    parseTimeToMinutes(input) {
        if (!input) return 0;
        const trimmed = String(input).trim();
        if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
        if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed) * 60;
        if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
            const parts = trimmed.split(':').map(Number);
            return (parts[0] * 60) + parts[1];
        }
        if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
            const parts = trimmed.split(':').map(Number);
            return (parts[0] * 60) + parts[1] + (parts[2] / 60);
        }
        return 0;
    },

    formatMinutesToHHMM(totalMinutes) {
        if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    },

    formatMinutesToHM(totalMinutes) {
        if (isNaN(totalMinutes) || totalMinutes < 0) return '0:00';
        const rounded = Math.round(totalMinutes);
        const hours = Math.floor(rounded / 60);
        const minutes = rounded % 60;
        return `${hours}:${String(minutes).padStart(2, '0')}`;
    },

    formatMinutesToHHMM_Signed(totalMinutes) {
        if (isNaN(totalMinutes)) return '00:00';
        const sign = totalMinutes < 0 ? '-' : '';
        const absMinutes = Math.abs(totalMinutes);
        const hours = Math.floor(absMinutes / 60);
        const minutes = Math.floor(absMinutes % 60);
        return `${sign}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    },

    formatMinutesToHHMMShort(totalMinutes) {
        if (isNaN(totalMinutes) || totalMinutes < 0) return '0m';
        if (totalMinutes === 0) return '0m';
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.floor(totalMinutes % 60);
        let parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0 || hours === 0) parts.push(`${minutes}m`);
        return parts.join(' ');
    },

    formatTimeAMPM(hour, minute) {
        return `${String(hour % 12 || 12)}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
    },

    getSeason(d) {
        const m = d.getMonth(); // 0-11
        if (m === 11 || m === 0 || m === 1) return 'winter';
        if (m >= 2 && m <= 4) return 'spring';
        if (m >= 5 && m <= 7) return 'summer';
        return 'autumn';
    }
};

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
        onBootstrap: (initFn) => {
            if (window.__BOOTSTRAP_READY) {
                initFn();
                return;
            }

            let bootstrapReady = false;
            document.addEventListener('bootstrap:ready', () => {
                bootstrapReady = true;
                initFn();
            });
            setTimeout(() => {
                if (!bootstrapReady && !window.__BOOTSTRAP_READY) {
                    console.error('Bootstrap did not complete within 5 seconds');
                    _showErrorBanner("Application Startup Timeout", "The application failed to load within 5 seconds. Check the browser console for errors.");
                }
            }, 5000);
        },

        isReady: () => window.__BOOTSTRAP_READY === true,

        /**
         * Initializes a page by loading state, caching DOM elements, and setting up auto-save.
         *
         * @param {Object} config - The configuration object for the page.
         * @param {string} config.storageKey - The localStorage key for persisting state.
         * @param {Object} config.defaultState - The default state object to use if no data exists.
         * @param {string[]} config.requiredElements - Array of DOM element IDs to cache (e.g., ['my-input']).
         * @param {string} config.version - The current version of the state schema (e.g., '1.0.0').
         * @param {Function} [config.onCorruption] - Optional callback to run if state corruption is detected.
         * @returns {Promise<{
         *   elements: Object<string, HTMLElement>,
         *   state: Object,
         *   saveState: Function
         * } | null>} A promise that resolves to the initialized page context or null on failure.
         */
        initPage: async (config) => {
            const { storageKey, defaultState, requiredElements, onCorruption, version } = config;
            
            if (!storageKey || !defaultState) {
                _showErrorBanner("Application Failed to Start", "Invalid configuration: Missing storageKey or defaultState.");
                return null;
            }

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
            
            let state = stateManager.load();
            
            let stateWasMigrated = false;
            if (Array.isArray(state)) {
                console.warn(`[AppLifecycle] Migrating legacy array state for ${storageKey}`);
                const oldData = state;
                state = JSON.parse(JSON.stringify(defaultState));
                
                const dataKey = Object.keys(state).find(k => Array.isArray(state[k]));
                if (dataKey) {
                    state[dataKey] = oldData;
                } else {
                    console.error(`[AppLifecycle] Migration failed: Couldn't find target array in defaultState.`);
                }
                stateWasMigrated = true;
            } else if (!state || typeof state !== 'object') {
                 console.error(`[AppLifecycle] State for ${storageKey} is corrupt. Resetting to default.`);
                 state = JSON.parse(JSON.stringify(defaultState));
                 stateWasMigrated = true;
            } else if (!state.ui && defaultState.ui) {
                console.log(`[AppLifecycle] Migrating state for ${storageKey}: Added UI state`);
                state.ui = { ...defaultState.ui };
                stateWasMigrated = true;
            }

            const saveState = () => stateManager.save(state);

            if (stateWasMigrated) {
                saveState();
            }

            return { elements, state, saveState };
        },
        
        registerSaveOnExit: (saveFunction) => {
            if (typeof saveFunction === 'function') onExitSaveFunctions.push(saveFunction);
        },

        registerPromptOnExit: (promptFunction) => {
            if (typeof promptFunction === 'function') beforeUnloadPrompt = promptFunction;
        },
        
        showStartupError: _showErrorBanner,
        _showErrorBanner
    };
})();

window.UIUtils = UIUtils;
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;
window.DataHelpers = DataHelpers;
window.DateUtils = DateUtils;