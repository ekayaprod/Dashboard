/**
 * ui.common.js (v2.0)
 *
 * Contains shared UI helper functions for the application suite.
 * Centralized all common logic (Modals, Toasts, Validators, DOM utils).
 */

const UIUtils = {

    // === SVG ICONS ===
    SVGIcons: {
        plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/></svg>',
        pencil: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V12h2.293l6.5-6.5zM3.586 10.5 2 12.086 1.914 14.086 3.914 13 5.5 11.414 3.586 10.5z"/></svg>',
        trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/></svg>',
        copy: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2Zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6ZM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2Z"/></svg>',
        menu: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/></svg>'
    },

    // === CORE UTILITIES ===

    /**
     * Escapes a string for safe insertion into HTML.
     * @param {string} str The string to escape.
     * @returns {string} The escaped HTML string.
     */
    escapeHTML: (str) => {
        if (!str) return '';
        const p = document.createElement('p');
        p.textContent = str;
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
        // Fallback for older browsers
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
    downloadJSON: (dataStr, filename) => {
        try {
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to download JSON:", error);
            UIUtils.showModal("Error", "<p>Error creating download.</p>", [{label: "OK"}]);
        }
    },

    /**
     * Programmatically opens a file picker.
     * @param {function} callback The function to call with the selected file.
     */
    openFilePicker: (callback) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.onchange = (event) => {
            const file = event.target.files[0];
            if (file) {
                callback(file);
            }
        };
        input.click();
    },

    // === INPUT VALIDATORS ===
    validators: {
        url: (value) => {
            if (!value?.trim()) return false;
            let urlToTest = value.trim();
            if (!urlToTest.match(/^(\w+?:\/\/)/)) urlToTest = 'https://' + urlToTest;
            try {
                const parsedUrl = new URL(urlToTest);
                return parsedUrl.hostname.includes('.') || parsedUrl.hostname === 'localhost';
            } catch { return false; }
        },
        notEmpty: (value) => value && value.trim().length > 0,
        maxLength: (value, max) => value.length <= max,
    },

    // === MODAL DIALOG ===

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

    // === TOAST NOTIFICATION ===

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
        
        // Use a property on the element to avoid overlapping timers
        if (toast.timer) clearTimeout(toast.timer);
        
        toast.timer = setTimeout(() => {
            toast.classList.remove('show');
            toast.timer = null;
        }, 3000);
    },

    // === THEME INITIALIZATION ===
    // Removed initTheme function to allow CSS media query to handle system theme
    // automatically, as requested.
};

// --- GLOBAL EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    // Attach modal close listeners
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

    // Removed theme initialization call
});