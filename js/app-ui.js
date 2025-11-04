/**
 * app-ui.js
 * High-level, reusable UI patterns and components.
 * Depends on: app-core.js
 */

const UIPatterns = (() => {
    // Cache for highlightSearchTerm regex patterns
    const regexCache = new Map();

    return {
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
         * Highlight search term in text (for search results).
         * Caches compiled regex patterns for performance.
         */
        highlightSearchTerm: (text, term) => {
            if (!term) return SafeUI.escapeHTML(text);

            let regex;
            if (regexCache.has(term)) {
                regex = regexCache.get(term);
            } else {
                // Escape special regex characters in the term
                const escapedTerm = term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
                regex = new RegExp(`(${escapedTerm})`, 'gi');
                regexCache.set(term, regex);
            }

            return SafeUI.escapeHTML(text).replace(regex, '<mark>$1</mark>');
        }
    };
})();

const ListRenderer = (() => {
    return {
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
})();

const SearchHelper = (() => {
    return {
        /**
         * Simple search - filter array of objects by term matching any string property
         */
        simpleSearch: (items, term, searchFields) => {
            if (!term || !term.trim()) return items;

            const lowerTerm = term.toLowerCase().trim();

            return items.filter(item => {
                return searchFields.some(field => {
                    const value = item[field];
                    // Handle null/undefined/non-string values correctly
                    return value != null &&
                        typeof value !== 'object' && // Prevent searching [object Object]
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
})();

// Expose components to the global window scope
window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;