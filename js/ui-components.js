/**
 * ui-components.js
 * Reusable UI patterns and components
 * Used by: index.html, lookup.html
 */

/**
 * UIPatterns - Common modal and confirmation patterns
 */
const UIPatterns = {
    /**
     * Show confirmation dialog before delete action
     * @param {string} itemType - Type of item (e.g., 'Application', 'Note', 'Shortcut')
     * @param {string} itemName - Name of item being deleted
     * @param {Function} onConfirm - Callback function if user confirms
     * * Example:
     * UIPatterns.confirmDelete('Note', 'My Shopping List', () => {
     * // Delete the item
     * state.notes.splice(index, 1);
     * saveState();
     * });
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
     * @param {Function} onDiscard - Callback if user chooses to discard changes
     * * Example:
     * if (formIsDirty) {
     * UIPatterns.confirmUnsavedChanges(() => {
     * // User chose to discard changes
     * loadDifferentForm();
     * });
     * }
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
     * @param {string} text - Text to highlight in
     * @param {string} term - Search term to highlight
     * @returns {string} HTML with <mark> tags around matches
     * * Example:
     * const highlighted = UIPatterns.highlightSearchTerm('Hello World', 'wor');
     * element.innerHTML = highlighted; // "Hello <mark>Wor</mark>ld"
     */
    highlightSearchTerm: (text, term) => {
        if (!term) return SafeUI.escapeHTML(text);
        const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return SafeUI.escapeHTML(text).replace(regex, '<mark>$1</mark>');
    }
};

/**
 * ListRenderer - List rendering utilities
 */
const ListRenderer = {
    /**
     * Render a list with empty state handling
     * @param {Object} config - Rendering configuration
     * * Example:
     * ListRenderer.renderList({
     * container: document.getElementById('results-list'),
     * items: state.todos,
     * emptyMessage: 'No todos yet. Add one to get started!',
     * createItemElement: (todo) => {
     * const li = document.createElement('li');
     * li.textContent = todo.title;
     * return li;
     * }
     * });
     */
    renderList: (config) => {
        const {
            container,          // HTMLElement - Container to render into
            items,             // Array - Items to render
            emptyMessage,      // String - Message when no items
            createItemElement  // Function(item) => HTMLElement
        } = config;

        if (!container) {
            console.error("ListRenderer: container element is null.");
            return;
        }
        
        container.innerHTML = '';

        if (!items || items.length === 0) {
            // Use div for empty state to avoid list styling issues
            container.innerHTML = `<div class="empty-state-message">${emptyMessage}</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const element = createItemElement(item);
            if (element) fragment.appendChild(element);
        });
        container.appendChild(fragment);
    },

    /**
     * Filter items by search term using a custom matching function
     * @param {Array} items - Items to filter
     * @param {string} term - Search term
     * @param {Function} matchFn - Function(item, lowerCaseTerm) => boolean
     * @returns {Array} Filtered items
     * * Example:
     * const filtered = ListRenderer.filterItems(
     * state.apps,
     * 'slack',
     * (app, term) => app.name.toLowerCase().includes(term)
     * );
     */
    filterItems: (items, term, matchFn) => {
        if (!term || !term.trim()) return items;
        const lowerTerm = term.toLowerCase().trim();
        return items.filter(item => matchFn(item, lowerTerm));
    }
};

/**
 * SearchHelper - Search and filtering utilities
 */
const SearchHelper = {
    /**
     * Simple search - filter array of objects by term matching any string property
     * @param {Array} items - Array of objects to search
     * @param {string} term - Search term
     * @param {Array<string>} searchFields - Fields to search in (e.g., ['name', 'description'])
     * @returns {Array} Filtered items
     * * Example:
     * const results = SearchHelper.simpleSearch(
     * state.contacts,
     * 'john',
     * ['name', 'email', 'phone']
     * );
     */
    simpleSearch: (items, term, searchFields) => {
        if (!term || !term.trim()) return items;
        
        const lowerTerm = term.toLowerCase().trim();
        
        return items.filter(item => {
            return searchFields.some(field => {
                const value = item[field];
                return value && String(value).toLowerCase().includes(lowerTerm);
            });
        });
    },

    /**
     * Setup debounced search on an input element
     * @param {HTMLInputElement} inputElement - The search input field
     * @param {Function} onSearch - Callback function(term)
     * @param {number} delay - Debounce delay (default: 300ms)
     * * Example:
     * SearchHelper.setupDebouncedSearch(
     * document.getElementById('search'),
     * (term) => renderMyList(term)
     * );
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
