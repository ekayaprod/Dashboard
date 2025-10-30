/**
 * ============================================================================
 * app-ui.js
 * * Contains high-level, composite UI components and patterns.
 * (Formerly ui-components.js)
 * * Depends on: app-core.js (for SafeUI)
 * ============================================================================
 */

const UIPatterns = {
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

    highlightSearchTerm: (text, term) => {
        if (!term) return SafeUI.escapeHTML(text);
        const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        return SafeUI.escapeHTML(text).replace(regex, '<mark>$1</mark>');
    }
};

const ListRenderer = {
    renderList: (config) => {
        const {
            container,
            items,
            emptyMessage,
            createItemElement
        } = config;

        if (!container) {
            console.error("ListRenderer: container element is null.");
            return;
        }
        
        container.innerHTML = '';

        if (!items || items.length === 0) {
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

    filterItems: (items, term, matchFn) => {
        if (!term || !term.trim()) return items;
        const lowerTerm = term.toLowerCase().trim();
        return items.filter(item => matchFn(item, lowerTerm));
    }
};

const SearchHelper = {
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