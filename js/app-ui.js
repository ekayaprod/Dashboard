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
         * Show confirmation dialog before delete action.
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
         * Show unsaved changes warning.
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
         */
        highlightSearchTerm: (text, term) => {
            if (!term) return SafeUI.escapeHTML(text);

            let regex;
            if (regexCache.has(term)) {
                regex = regexCache.get(term);
            } else {
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
         * Render a list with empty state handling.
         */
        renderList: (config) => {
            const {
                container,
                items,
                emptyMessage,
                emptyElement,
                createItemElement
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
         * Simple search - filter array of objects by term matching any string property.
         */
        simpleSearch: (items, term, searchFields) => {
            if (!term || !term.trim()) return items;

            const lowerTerm = term.toLowerCase().trim();

            return items.filter(item => {
                return searchFields.some(field => {
                    const value = item[field];
                    return value != null &&
                        typeof value !== 'object' &&
                        String(value).toLowerCase().includes(lowerTerm);
                });
            });
        },

        /**
         * Setup debounced search on an input element.
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

// ============================================================================
// MODULE: NotepadManager (Extracted from DashboardUI)
// ============================================================================
const NotepadManager = (() => {
    let DOMElements;
    let state;
    let saveState;
    let activeNoteId = null;

    // --- Helpers ---
    const getCollection = (type) => state[type];
    const hasItems = (type) => getCollection(type).length > 0;
    const findById = (collectionType, id) => {
        if (!id) return null;
        return getCollection(collectionType).find(item => item.id === id);
    };
    const confirmDelete = (type, itemName, onConfirm) => {
        const labels = {apps: 'Application', notes: 'Note', shortcuts: 'Shortcut'};
        const itemTypeLabel = labels[type] || 'Item';
        UIPatterns.confirmDelete(itemTypeLabel, itemName, onConfirm);
    };

    // --- Core Logic ---
    const saveActiveNote = () => {
        if (!activeNoteId) return;
        const note = findById('notes', activeNoteId);
        if (note && DOMElements.notepadEditor) {
            note.content = DOMElements.notepadEditor.value;
            saveState();
        }
    };
    
    const renderNotesData = () => {
        const noteSelect = DOMElements.noteSelect;
        noteSelect.innerHTML = '';

        const fragment = document.createDocumentFragment();
        getCollection('notes').forEach(note => fragment.appendChild(new Option(note.title, note.id)));
        noteSelect.appendChild(fragment);

        activeNoteId = activeNoteId && getCollection('notes').some(n => n.id === activeNoteId) ? activeNoteId : (hasItems('notes') ? getCollection('notes')[0].id : null);

        if (activeNoteId) {
             noteSelect.value = activeNoteId;
        }

        const activeNote = findById('notes', activeNoteId);
        if (activeNote) {
            DOMElements.notepadEditor.value = activeNote.content;
            DOMElements.notepadEditor.disabled = false;
        } else {
            DOMElements.notepadEditor.value = '';
            DOMElements.notepadEditor.disabled = true;
        }
        DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        DOMElements.deleteNoteBtn.disabled = !hasItems('notes');
        DOMElements.renameNoteBtn.disabled = !hasItems('notes');
    };

    const attachListeners = () => {
        // Register immediate-save listeners
        const immediateSave = () => {
            // Only save if content has actually changed
            const currentNote = findById('notes', activeNoteId);
            if (currentNote && DOMElements.notepadEditor.value !== currentNote.content) {
                saveActiveNote();
            }
        };
        DOMElements.noteSelect.addEventListener('mousedown', immediateSave);
        DOMElements.deleteNoteBtn.addEventListener('mousedown', immediateSave);
        
        // Register for global exit-save
        if (window.AppLifecycle && typeof window.AppLifecycle.registerSaveOnExit === 'function') {
            window.AppLifecycle.registerSaveOnExit(immediateSave);
        }

        // Standard listeners
        DOMElements.noteSelect.addEventListener('change', () => {
            activeNoteId = DOMElements.noteSelect.value;
            const note = findById('notes', activeNoteId);
            DOMElements.notepadEditor.value = note ? note.content : '';
            DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        });

        DOMElements.notepadEditor.addEventListener('input', SafeUI.debounce(() => {
            if (!activeNoteId) return;
            const note = findById('notes', activeNoteId);
            if (note) {
                note.content = DOMElements.notepadEditor.value;
                saveState();
            }
        }, 300));
        
        DOMElements.newNoteBtn.addEventListener('click', () => {
            SafeUI.showModal('New Note', '<input id="new-note-title" class="sidebar-input" placeholder="Note title">', [
                {label: 'Cancel'},
                {label: 'Create', class: 'button-primary', callback: () => {
                    const titleInput = document.getElementById('new-note-title');
                    const title = titleInput.value.trim() || 'Untitled Note';
                    const newNote = { id: SafeUI.generateId(), title, content: '' };
                    getCollection('notes').push(newNote);
                    saveState();
                    activeNoteId = newNote.id;
                    renderNotesData();
                }}
            ]);
        });
        
        DOMElements.renameNoteBtn.addEventListener('click', () => {
            if (!activeNoteId) return;
            const note = findById('notes', activeNoteId);
            if (!note) return;
            
            SafeUI.showModal('Rename Note', `<input id="rename-note-title" class="sidebar-input" value="${SafeUI.escapeHTML(note.title)}">`, [
                {label: 'Cancel'},
                {label: 'Rename', class: 'button-primary', callback: () => {
                    const titleInput = document.getElementById('rename-note-title');
                    const newTitle = titleInput.value.trim();
                    if (newTitle) {
                        note.title = newTitle;
                        saveState();
                        renderNotesData();
                    } else {
                        return SafeUI.showValidationError('Invalid Title', 'Title cannot be empty.', 'rename-note-title');
                    }
                }}
            ]);
        });
        
        DOMElements.deleteNoteBtn.addEventListener('click', () => {
            if (!activeNoteId || !hasItems('notes')) return;
            const note = findById('notes', activeNoteId);
            if (!note) return;
            
            confirmDelete('notes', note.title, () => {
                state.notes = state.notes.filter(n => n.id !== activeNoteId);
                saveState();
                activeNoteId = null;
                renderNotesData();
            });
        });
    };

    return {
        /**
         * Initializes the Notepad manager.
         * @param {object} config
         * @param {object} config.elements - Cached DOM elements (noteSelect, notepadEditor, etc.)
         * @param {object} config.state - The global state object.
         * @param {function} config.saveState - The global saveState function.
         */
        init: (config) => {
            if (!config.elements || !config.state || !config.saveState) {
                console.error("NotepadManager.init: Missing required config.");
                return;
            }
            DOMElements = config.elements;
            state = config.state;
            saveState = config.saveState;

            // Setup textareas
            DOMHelpers.setupTextareaAutoResize(DOMElements.notepadEditor);

            // Setup icons
            DOMElements.newNoteBtn.innerHTML = SafeUI.SVGIcons.plus;
            DOMElements.renameNoteBtn.innerHTML = SafeUI.SVGIcons.pencil;
            DOMElements.deleteNoteBtn.innerHTML = SafeUI.SVGIcons.trash;

            attachListeners();

            // First-run check for notes
            if (!hasItems('notes')) {
                getCollection('notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' });
                saveState();
            }

            renderNotesData();
        }
    };
})();

// ============================================================================
// MODULE: QuickListManager (New Refactored Module)
// ============================================================================
const QuickListManager = (() => {
    let config;
    let container;

    const createItemElement = (item) => {
        const div = document.createElement('div');
        div.className = 'shortcut-item'; // Use the same class for consistent styling
        div.dataset.id = item.id;
        
        const name = SafeUI.escapeHTML(config.getItemName(item));
        let nameElement;

        const href = config.getItemHref ? config.getItemHref(item) : null;
        if (href) {
            // It's a link (for Dashboard Shortcuts)
            nameElement = document.createElement('a');
            nameElement.href = href;
            nameElement.target = '_blank';
            nameElement.rel = 'noopener noreferrer';
            nameElement.textContent = name;
        } else {
            // It's a button (for Password Quick Actions)
            nameElement = document.createElement('button');
            nameElement.className = 'quick-action-btn';
            nameElement.textContent = name;
            // Add styling to make it look like the old link
            nameElement.style.all = 'unset';
            nameElement.style.color = 'var(--primary-color)';
            nameElement.style.textDecoration = 'none';
            nameElement.style.whiteSpace = 'nowrap';
            nameElement.style.overflow = 'hidden';
            nameElement.style.textOverflow = 'ellipsis';
            nameElement.style.flexGrow = '1';
            nameElement.style.fontSize = '0.9rem';
            nameElement.style.cursor = 'pointer';
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'icon-btn delete-btn';
        deleteBtn.title = 'Delete';
        deleteBtn.innerHTML = SafeUI.SVGIcons.trash;
        deleteBtn.dataset.id = item.id;
        
        // Removed the drag handle and custom icons per our plan

        div.appendChild(nameElement);
        div.appendChild(deleteBtn);
        return div;
    };

    const render = () => {
        ListRenderer.renderList({
            container: container,
            items: config.items,
            emptyMessage: config.emptyMessage,
            createItemElement: createItemElement
        });
    };

    const handleContainerClick = (e) => {
        const itemElement = e.target.closest('.shortcut-item');
        if (!itemElement) return;

        const id = itemElement.dataset.id;
        const item = config.items.find(i => i.id === id);
        if (!item) return;

        // Handle Delete
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            config.onDeleteClick(item, render);
            return;
        }

        // Handle Item Click (if it's a button)
        const actionBtn = e.target.closest('.quick-action-btn');
        if (actionBtn) {
            e.preventDefault();
            config.onItemClick(item);
            return;
        }
        
        // If it's a link, the browser will handle it.
    };

    return {
        /**
         * Initializes the Quick List manager.
         * @param {object} config
         * @param {HTMLElement} config.container - The DOM element to render the list into.
         * @param {Array} config.items - The array of data objects.
         * @param {string} config.emptyMessage - Text to show when list is empty.
         * @param {function} config.getItemName - (item) => string. Returns the display name.
         * @param {function} config.onDeleteClick - (item, renderCallback) => void.
         * @param {string} [config.addNewButtonId] - (Optional) ID of a button to trigger onAddNewClick.
         * @param {function} [config.onAddNewClick] - (renderCallback) => void. (Optional)
         * @param {function} [config.getItemHref] - (item) => string. (Optional) If provided, renders a link.
         * @param {function} [config.onItemClick] - (item) => void. (Optional) If provided, item is a button.
         */
        init: (cfg) => {
            config = cfg;
            container = cfg.container;

            if (!container || !config.items || !config.getItemName || !config.onDeleteClick) {
                console.error("QuickListManager.init: Missing required config.");
                return;
            }

            // Attach delegated listener
            container.innerHTML = ''; // Clear it
            container.addEventListener('click', handleContainerClick);
            
            // Attach "Add New" listener if provided
            if (config.addNewButtonId && config.onAddNewClick) {
                const addBtn = document.getElementById(config.addNewButtonId);
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        config.onAddNewClick(render);
                    });
                }
            }
            
            // Initial render
            render();
        }
    };
})();


// Expose components to the global window scope
window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;
window.NotepadManager = NotepadManager;
window.QuickListManager = QuickListManager; // Expose the new module