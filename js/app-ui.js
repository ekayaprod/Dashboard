/**
 * app-ui.js
 * (Was ui-components.js)
 * * Reusable high-level UI patterns and components
 * Depends on: app-core.js
 */

const UIPatterns = {
    /**
     * Show confirmation dialog before delete action
     */
    confirmDelete: (itemType, itemName, onConfirm) => {
        SafeUI.showModal(
            `Delete ${itemType}`,
            `<p>Are you sure you want to delete "${SafeUI.escapeHTML(itemName)}"?</p><p>This cannot be undone.</p>`,
            [
                { label: 'Cancel' },
                { label: 'Delete', class: 'button-danger', callback: onConfirm }
            ]
        );
    },

    /**
     * Show unsaved changes warning
     */
    confirmUnsavedChanges: (onDiscard) => {
        SafeUI.showModal(
            'Unsaved Changes',
            '<p>You have unsaved changes. Discard them?</p>',
            [
                { label: 'Cancel' },
                { label: 'Discard', class: 'button-danger', callback: onDiscard }
            ]
        );
    },

    /**
     * Highlight search term in text (for search results)
     */
    highlightSearchTerm: (text, term) => {
        if (!term) return SafeUI.escapeHTML(text);
        const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return SafeUI.escapeHTML(text).replace(regex, '<mark>$1</mark>');
    }
};

const ListRenderer = {
    /**
     * Render a list with empty state handling
     */
    renderList: (config) => {
        const {
            container,          // HTMLElement - Container to render into
            items,             // Array - Items to render
            emptyMessage,      // String - Message when no items
            emptyElement,      // HTMLElement - Optional element to show/hide
            createItemElement  // Function(item) => HTMLElement
        } = config;

        if (!container) {
            console.error("ListRenderer: container element is null.");
            return;
        }
        
        container.innerHTML = '';

        if (!items || items.length === 0) {
            if (emptyElement) {
                emptyElement.innerHTML = emptyMessage;
                emptyElement.classList.remove('hidden');
            } else {
                container.innerHTML = `<div class="empty-state-message">${emptyMessage}</div>`;
            }
            return;
        }

        if (emptyElement) {
            emptyElement.classList.add('hidden');
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const element = createItemElement(item);
            if (element) fragment.appendChild(element);
        });
        container.appendChild(fragment);
    },
};

const SearchHelper = {
    /**
     * Simple search - filter array of objects by term matching any string property
     */
    simpleSearch: (items, term, searchFields) => {
        if (!term || !term.trim()) return items;
        
        const lowerTerm = term.toLowerCase().trim();
        
        return items.filter(item => {
            return searchFields.some(field => {
                const value = item[field];
                // FIX: Issue #22 - Handle null/undefined values correctly
                return value !== null && value !== undefined && 
                       String(value).toLowerCase().includes(lowerTerm);
            });
        });
    },

    /**
     * Setup debounced search on an input element
     */
    setupDebouncedSearch: (inputElement, onSearch, delay = 300) => {
        if (!inputElement) {
            console.error("setupDebouncedSearch: inputElement is null.");
            return;
        }
        
        const debouncedSearch = SafeUI.debounce(onSearch, delay);
        
        inputElement.addEventListener('input', () => {
            debouncedSearch(inputElement.value);
        });
    }
};

// --- FIX: Expose components to the global window scope ---
window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;

