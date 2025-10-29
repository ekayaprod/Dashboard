/**
 * ui.common.js
 * Contains shared UI helper functions for the application suite.
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
                    // Check for a basic protocol or reasonable domain structure
                    if (/^https?:\/\//.test(str) || /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/i.test(str)) {
                        try {
                            // Add a protocol if missing to satisfy the URL constructor
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
     * Dynamically loads the navigation bar from a file.
     * @param {string} containerId The ID of the element to inject the nav into.
     *_nav.html
     * @param {string} currentPage The filename of the current page (e.g., "index.html").
     */
    loadNavbar: (() => {
        const loaded = new Set();
        return async (containerId, currentPage) => {
            if (loaded.has(containerId)) return;
            loaded.add(containerId);
            
            const navContainer = document.getElementById(containerId);
            if (!navContainer) {
                console.error(`Navbar container "${containerId}" not found.`);
                loaded.delete(containerId);
                return;
            }

            try {
                const response = await fetch('_nav.html');
                if (!response.ok) throw new Error(`Failed to fetch _nav.html: ${response.statusText}`);
                navContainer.innerHTML = await response.text();
                
                navContainer.querySelectorAll('.nav-link').forEach(link => {
                    // Use endsWith to robustly match the file name, even if the href is relative
                    if (link.getAttribute('href').endsWith(currentPage)) {
                        link.classList.add('active');
                    }
                });
            } catch (error) {
                console.error('Failed to load navbar:', error);
                navContainer.innerHTML = '<p style="color: red; text-align: center;">Error loading navigation.</p>';
                loaded.delete(containerId);
            }
        };
    })(),

    /**
     * Escapes a string for safe insertion into HTML.
     * @param {string} str The string to escape.
     * @returns {string} The escaped HTML string.
     */
    escapeHTML: (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    },

    /**
     * Generates a unique ID with a fallback.
     * @returns {string} A unique ID.
     */
    generateId: () => {
        if (crypto.randomUUID) {
            return crypto.randomUUID();
        }
        return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    },

    /**
     * Debounces a function.
     * @param {function} func The function to debounce.
     * @param {number} delay The delay in milliseconds.
     * @returns {function} The debounced function.
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
     * @param {string} text The text to copy.
     * @returns {Promise<boolean>} True if successful, false otherwise.
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
     * @param {string} dataStr The string content of the file.
     * @param {string} filename The name for the downloaded file.
     */
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

    /**
     * Programmatically opens a file picker.
     * @param {function} callback The function to call with the selected file.
     * @param {string} [accept="application/json,.json"] The file types to accept.
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
     * @param {File} file The file object to read.
     * @param {function} onSuccess Callback function on successful parse.
     * @param {function} onError Callback function on file read or parse error.
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
     * Creates a state manager for localStorage.
     * @param {string} key The localStorage key.
     * @param {object} defaults The default state object.
     * @param {string} version The current application version.
     * @param {function} onCorruption Optional callback for data corruption.
     * @returns {object|null} State manager with load() and save() methods.
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
        }
    },

    /**
     * Shows the global modal with custom content and buttons.
     * @param {string} title The title for the modal.
     * @param {string} contentHtml The HTML content to inject.
     * @param {Array<object>} actions Array of button objects.
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
    },

    /**
     * Shows a standardized validation error modal and focuses the element.
     * @param {string} title The title for the modal.
     * @param {string} message The error message.
     * @param {string} [focusElementId] Optional ID of the element to focus.
     */
    showValidationError: function(title, message, focusElementId) {
        this.showModal(title, `<p>${message}</p>`, [{label: 'OK'}]);
        if (focusElementId) {
            setTimeout(() => document.getElementById(focusElementId)?.focus(), 100);
        }
    },


    /**
     * Shows a simple feedback toast message.
     * @param {string} message The message to display.
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
