/**
 * ui.common.js
 * Contains shared UI helper functions for the application suite.
 */

const UIUtils = {

    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/></svg>',
        menu: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>'
    },
    
    // START: Fix for Issue #1
    validators: {
        url: (value) => {
            if (!value || typeof value !== 'string') return false;
            try {
                new URL(value.trim());
                return true;
            } catch {
                return false;
            }
        },
        notEmpty: (value) => {
            return value != null && String(value).trim().length > 0;
        },
        maxLength: (value, max) => {
            return value != null && String(value).length <= max;
        }
    },
    // END: Fix for Issue #1

    /**
     * Dynamically loads the navigation bar from a file.
     * @param {string} containerId The ID of the element to inject the nav into.
     * @param {string} currentPage The filename of the current page (e.g., "index.html").
     */
    // START: Fix for Issue #2
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
                    if (link.getAttribute('href') === currentPage) {
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
    // END: Fix for Issue #2

    /**
     * Escapes a string for safe insertion into HTML.
     * @param {string} str The string to escape.
     * @returns {string} The escaped HTML string.
     */
    // START: Fix for Issue #5
    escapeHTML: (str) => {
        const p = document.createElement('p');
        p.textContent = str ?? '';
        return p.innerHTML;
    },
    // END: Fix for Issue #5

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
    // START: Fix for Issue #4
    downloadJSON: (dataStr, filename) => {
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
            UIUtils.showModal("Download Error", "<p>Failed to create download.</p>", [{label: "OK"}]);
            return false;
        }
    },
    // END: Fix for Issue #4

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
    // START: Fix for Issue #3
    createStateManager: (key, defaults, version, onCorruption) => {
        if (!key || typeof key !== 'string' || !defaults || typeof defaults !== 'object' || !version) {
            console.error("createStateManager requires valid key (string), defaults (object), and version.");
            return null;
        }
    // END: Fix for Issue #3

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
    showModal: (title, contentHtml, actions) => {
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

    /**
     * Shows a simple feedback toast message.
     * @param {string} message The message to display.
     */
    showToast: (message) => {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.warn('Toast element not found.');
            return;
        }
        
        toast.innerHTML = `<span>${UIUtils.escapeHTML(message)}</span>`;
        toast.classList.add('show');
        
        if (toast.timer) clearTimeout(toast.timer);
        
        toast.timer = setTimeout(() => {
            toast.classList.remove('show');
            toast.timer = null;
        }, 3000);
    },
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