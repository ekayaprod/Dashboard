/**
 * ui.common.js
 *
 * Contains shared, simple UI helper functions for the dashboard application,
 * starting with the Modal and its dependencies.
 * This avoids code duplication across dashboard.html, lookup.html, etc.
 */

// Wrap all shared functions in a single global object
// to avoid polluting the global namespace.
const UIUtils = {

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

    // --- MODAL ---

    // Note: These functions assume your HTML has:
    // <div id="modal-overlay" class="modal-overlay">
    //   <div id="modal-content" class="modal-content"></div>
    // </div>

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

        // Use our own escapeHTML utility
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
    }
};

// --- GLOBAL EVENT LISTENERS ---
// Attach modal close listeners to the document
// (These are safe to run immediately as they just add listeners)
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