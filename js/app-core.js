/**
 * app-core.js
 * (Was ui.common.js + app-core.js)
 * * Core application initialization, SafeUI wrapper, and DOM utilities
 */

// ============================================================================
// UIUtils (Low-level DOM, UI, and helper functions)
// ============================================================================
const UIUtils = {

    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        settings: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4.75A3.25 3.25 0 1 0 8 11.25 3.25 3.25 0 0 0 8 4.75zM5.75 8a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0z"/><path d="M9.78 1.47a.75.75 0 0 1 0 1.06L9.06 3.25a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0L5.27 7.02a.75.75 0 0 1-1.06 0L1.47 6.28a.75.75 0 0 1 0-1.06L2.2 4.47a.25.25 0 0 0 .35 0l.29.28c.3.3.79.3 1.09 0l1.6-1.6c.3-.3.3-.79 0-1.09l-.28-.29a.25.25 0 0 0 0-.35L6.02 1.47a.75.75 0 0 1 1.06 0L8 2.25l.92-.78a.75.75 0 0 1 1.06 0l.92.78 1.77-1.77a.25.25 0 0 0 0-.35l-.28-.29c-.3-.3-.3-.79 0-1.09l1.6-1.6c.3-.3.79.3-1.09 0l.29.28a.25.25 0 0 0 .35 0l.75-.75a.75.75 0 0 1 1.06 0l1.74 1.74a.75.75 0 0 1 0 1.06L12.98 5.27a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0L8.98 9.78a.75.75 0 0 1-1.06 0L7.14 8.99a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L3.02 1.47a.75.75 0 0 1 0-1.06L1.28.67a.75.75 0 0 1-1.06 0L.67 1.28a.75.75 0 0 1 0 1.06l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06L8 13.75l-.92.78a.75.75 0 0 1-1.06 0l-.92-.78-1.77 1.77a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0l-.75.75a.75.75 0 0 1-1.06 0L.67 14.72a.75.75 0 0 1 0-1.06l.78-.78a.25.25 0 0 0 .35 0l.29.28c.3.3.79.3 1.09 0l1.6-1.6c.3-.3.3-.79 0-1.09l-.28-.29a.25.25 0 0 0 0-.35L5.27 8.98a.75.75 0 0 1 1.06 0l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79-.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06L9.78 14.53a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L1.47 7.02a.75.75 0 0 1 0-1.06L3.2 5.21a.25.25 0 0 0 .35 0l.29.28c.3.3.79.3 1.09 0l1.6-1.6c.3-.3.3-.79 0-1.09l-.28-.29a.25.25 0 0 0 0-.35L5.27 1.47a.75.75 0 0 1-1.06 0L3.43.67a.75.75 0 0 1-1.06 0L.67 2.37a.75.75 0 0 1 0 1.06l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06L6.02 14.53a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L1.47 8.98a.75.75 0 0 1 0-1.06L3.2 6.17a.25.25 0 0 0 .35 0l.29.28c.3.3.79.3 1.09 0l1.6-1.6c.3-.3.3-.79 0-1.09l-.28-.29a.25.25 0 0 0 0-.35L5.27 2.53a.75.75 0 0 1-1.06 0L2.47.79a.75.75 0 0 1-1.06 0L.67 1.57A.75.75 0 0 1 0 2.1v11.8A.75.75 0 0 1 .67 14.72l.78-.78a.75.75 0 0 1 1.06 0l.75.75a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06l-1.74 1.74a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L1.47 9.78a.75.75 0 0 1 0-1.06l1.74-1.74a.25.25 0 0 0 .35 0l.29.28c.3.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35L8 13.75l.92.78a.75.75 0 0 1 1.06 0l.92-.78 1.77-1.77a.25.25 0 0 0 0-.35l-.28-.29c-.3-.3-.3-.79 0-1.09l1.6-1.6c.3-.3.79.3 1.09 0l.29.28a.25.25 0 0 0 .35 0l.75-.75a.75.75 0 0 1 1.06 0l1.74 1.74a.75.75 0 0 1 0 1.06l-.78.78a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35L12.98 14.53a.75.75 0 0 1 0 1.06l-1.74 1.74a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L8 9.78l-.92-.78a.75.75 0 0 1-1.06 0l-.92.78-1.77 1.77a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0l-.75.75a.75.75 0 0 1-1.06 0L.67 13.94A.75.75 0 0 1 0 13.39V1.61A.75.75 0 0 1 .67.83l1.74 1.74a.75.75 0 0 1 0 1.06L1.62 4.41a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0L.67 7.14a.75.75 0 0 1-1.06 0L.28 6.81a.75.75 0 0 1 0-1.06l1.74-1.74a.25.25 0 0 0 0-.35l-.28-.29c-.3-.3-.3-.79 0-1.09l1.6-1.6c.3-.3.79.3 1.09 0l.29.28a.25.25 0 0 0 .35 0L6.02.67A.75.75 0 0 1 7.08 0l.92.78a.75.75 0 0 1 1.06 0l.92-.78a.75.75 0 0 1 1.06 0l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3-.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06l-1.74 1.74a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0l-.75.75a.75.75 0 0 1-1.06 0l-1.74-1.74a.75.75 0 0 1 0-1.06l.78-.78a.25.25 0 0 0 0-.35l-.28-.29c-.3-.3-.3-.79 0-1.09l1.6-1.6c.3-.3.79.3 1.09 0l.29.28a.25.25 0 0 0 .35 0l1.77-1.77a.75.75 0 0 1 0-1.06L13.72.83a.75.75 0 0 1 1.06 0l.78.78a.75.75 0 0 1 0 1.06l-.78.78a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0l-1.77 1.77a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L8.98 1.47a.75.75 0 0 1 0-1.06L7.24.67a.75.75 0 0 1-1.06 0L5.4 1.45a.75.75 0 0 1 0 1.06l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35L8 8.25l-.92-.78a.75.75 0 0 1-1.06 0l-.92.78L3.33 6.47a.25.25 0 0 0 0-.35l.28-.29c.3-.3.3-.79 0-1.09l-1.6-1.6c-.3-.3-.79.3-1.09 0l-.29.28a.25.25 0 0 0-.35 0L.67 4.19a.75.75 0 0 1-1.06 0L.28 3.86a.75.75 0 0 1 0-1.06L2.02 1.06a.75.75 0 0 1 1.06 0l.78.78a.25.25 0 0 0 .35 0l.29-.28c.3.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06L7.08 9.02a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L3.02 2.53a.75.75 0 0 1 0-1.06l.78-.78a.75.75 0 0 1 1.06 0l.75.75a.25.25 0 0 0 .35 0l.29-.28c.3.3.79.3 1.09 0l1.6 1.6c.3.3.3.79 0 1.09l-.28.29a.25.25 0 0 0 0 .35l1.77 1.77a.75.75 0 0 1 0 1.06L9.78 8.25l.92-.78a.75.75 0 0 1 1.06 0l.92.78 1.77-1.77a.25.25 0 0 0 0-.35l-.28-.29c-.3-.3-.3-.79 0-1.09l1.6-1.6c.3-.3.79.3 1.09 0l.29.28a.25.25 0 0 0 .35 0l.75-.75a.75.75 0 0 1 1.06 0l1.74 1.74a.75.75 0 0 1 0 1.06L14.72 6.28a.25.25 0 0 0 0 .35l.28.29c.3.3.3.79 0 1.09l-1.6 1.6c-.3.3-.79.3-1.09 0l-.29-.28a.25.25 0 0 0-.35 0L9.78 7.14a.75.75 0 0 1-1.06 0l-.78-.78a.25.25 0 0 0-.35 0l-.29.28c-.3.3-.79.3-1.09 0l-1.6-1.6c-.3-.3-.3-.79 0-1.09l.28-.29a.25.25 0 0 0 0-.35L3.02 1.47z"/></svg>'
    },
    
    validators: {
        _validate: (value, type, options = {}) => {
            if (value == null) return false;
            const str = String(value).trim();
            
            switch(type) {
                case 'url':
                    // FIX: Mode B - Allow localhost and hostnames by making TLD optional
                    if (/^https?:\/\//.test(str) || /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*(\.[a-z]{2,})?(:[0-9]{1,5})?(\/.*)?$/i.test(str)) {
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

    /**
     * Dynamically loads the navigation bar.
     */
    loadNavbar: (() => {
        let loaded = false;
        return async (containerId) => {
            if (loaded) return;
            loaded = true;
            
            const navContainer = document.getElementById(containerId);
            if (!navContainer) {
                console.error(`Navbar container "${containerId}" not found.`);
                return;
            }

            try {
                // FIX: Add cache-busting query param
                const response = await fetch(`navbar.html?t=${Date.now()}`);
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
        p.textContent = str ?? '';
        return p.innerHTML;
    },

    /**
     * Generates a unique ID with a fallback.
     */
    generateId: () => {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
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
            console.error('Failed to copy: ', err);
            return false;
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

    /**
     * Hides the global modal.
     */
    hideModal: () => {
        const modalOverlay = document.getElementById('modal-overlay');
        if (modalOverlay) {
            modalOverlay.style.display = 'none';
            document.body.classList.remove('modal-open'); // FIX: Issue #19 - Remove class
        }
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
        document.body.classList.add('modal-open'); // FIX: Issue #19 - Add class
    },

    /**
     * Shows a standardized validation error modal and focuses the element.
     */
    showValidationError: function(title, message, focusElementId) {
        this.showModal(title, `<p>${message}</p>`, [{label: 'OK'}]);
        if (focusElementId) {
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
// SafeUI (Wrapper for graceful degradation)
// ============================================================================
const SafeUI = (() => {
    const isReady = typeof UIUtils !== 'undefined' && UIUtils;
    
    const getSVGIcons = () => {
        if (isReady && UIUtils.SVGIcons) return UIUtils.SVGIcons;
        return { plus: '+', pencil: '✎', trash: '🗑', settings: '⚙' };
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
        downloadJSON: (data, filename, mimeType) => isReady && UIUtils.downloadJSON(data, filename, mimeType),
        openFilePicker: (cb, accept) => isReady && UIUtils.openFilePicker(cb, accept),
        readJSONFile: (file, onSuccess, onError) => isReady ? UIUtils.readJSONFile(file, onSuccess, onError) : onError("UI Framework not loaded."),
        readTextFile: (file, onSuccess, onError) => isReady ? UIUtils.readTextFile(file, onSuccess, onError) : onError("UI Framework not loaded."),
        createStateManager: (key, defaults, version, onCorruption) => isReady ? UIUtils.createStateManager(key, defaults, version, onCorruption) : null,
        validators: isReady ? UIUtils.validators : { url: (v) => v, notEmpty: (v) => v, maxLength: (v, m) => v }
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
            textarea.style.height = 'auto';
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
     * Helper to show a non-destructive error banner
     */
    _showErrorBanner: (title, message) => {
        // Create and inject a non-destructive banner
        const banner = document.createElement('div');
        banner.id = 'app-startup-error';
        banner.style.cssText = `position:sticky;top:0;left:0;width:100%;padding:1rem;background-color:#fef2f2;color:#dc2626;border-bottom:2px solid #fecaca;font-family:sans-serif;font-size:1rem;font-weight:600;z-index:10000;box-sizing:border-box;`;
        banner.innerHTML = `<strong>${title}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${message}</p>`;
        
        // Wait for DOM to be ready just in case, then prepend
        if (document.body) {
            document.body.prepend(banner);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
        }
    },

    /**
     * Standard init wrapper with error handling
     */
    run: (initFn) => {
        document.addEventListener('DOMContentLoaded', async () => {
            try {
                if (!SafeUI || !SafeUI.isReady) {
                    console.error("FATAL: UIUtils or SafeUI failed to initialize.");
                    AppLifecycle._showErrorBanner(
                        "Application Failed to Load",
                        "A critical file (app-core.js) may be missing or failed to load. Please check the console for errors."
                    );
                    return;
                }
                
                await initFn();
                
            } catch (err) {
                console.error("Unhandled exception during initialization:", err);
                AppLifecycle._showErrorBanner(
                    "Application Error",
                    `An unexpected error occurred during startup: ${err.message}. Please check the console for more details.`
                );
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
            // Error is already logged by cacheElements. The inline dependency check will also fail.
            // We can show a banner here too for robustness.
             AppLifecycle._showErrorBanner(
                "Application Failed to Load",
                "One or more critical HTML elements are missing from the page. The application cannot start."
             );
            return null;
        }

        // Initialize state
        const stateManager = SafeUI.createStateManager(storageKey, defaultState, version, onCorruption);
        if (!stateManager) {
            console.error("FATAL: StateManager failed to initialize.");
            AppLifecycle._showErrorBanner(
                "Application Failed to Load",
                "The StateManager failed to initialize. LocalStorage may be corrupt or unavailable."
             );
            return null;
        }

        const state = stateManager.load();
        const saveState = () => stateManager.save(state);

        // Make DOMHelpers globally available for inline scripts
        window.DOMHelpers = DOMHelpers;
        
        return { elements, state, saveState };
    }
};

// --- FIX: Expose core components to the global window scope ---
window.SafeUI = SafeUI;
window.DOMHelpers = DOMHelpers;
window.AppLifecycle = AppLifecycle;

