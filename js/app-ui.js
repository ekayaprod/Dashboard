/**
 * app-ui.js
 * High-level, reusable UI patterns and components.
 * Depends on: app-core.js
 */

// --- FIX (Mode F) ---
const UI_VERSION = '2.5.1';
console.log(`AppLifecycle: Loading app-ui.js v${UI_VERSION}`);
// --- END FIX ---

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

    // --- Core Logic ---
    const saveActiveNote = () => {
        if (!activeNoteId) return;
        const note = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
        if (note && DOMElements.notepadEditor) {
            // --- START FIX: ISSUE 4 (Legacy ID Regeneration) ---
            if (note.id.length < 20) {
                console.warn(`Regenerating legacy ID for note "${note.title}": ${note.id}`);
                const newId = SafeUI.generateId();
                note.id = newId;
                activeNoteId = newId;
            }
            // --- END FIX: ISSUE 4 ---
            
            note.content = DOMElements.notepadEditor.value;
            saveState();
            // console.log(`Saved note "${note.title}" (ID: ${note.id})`);
        }
    };
    
    const renderNotesData = () => {
        const noteSelect = DOMElements.noteSelect;
        noteSelect.innerHTML = '';

        const notesCollection = DataHelpers.getCollection(state, 'notes'); // (FIX - Mode C)
        const hasNotes = notesCollection.length > 0; // (FIX - Mode C)

        const fragment = document.createDocumentFragment();
        notesCollection.forEach(note => fragment.appendChild(new Option(note.title, note.id))); // (FIX - Mode C)
        noteSelect.appendChild(fragment);

        activeNoteId = activeNoteId && notesCollection.some(n => n.id === activeNoteId) ? activeNoteId : (hasNotes ? notesCollection[0].id : null); // (FIX - Mode C)

        if (activeNoteId) {
             noteSelect.value = activeNoteId;
        }

        const activeNote = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
        if (activeNote) {
            DOMElements.notepadEditor.value = activeNote.content;
            DOMElements.notepadEditor.disabled = false;
        } else {
            DOMElements.notepadEditor.value = '';
            DOMElements.notepadEditor.disabled = true;
        }
        DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        DOMElements.deleteNoteBtn.disabled = !hasNotes; // (FIX - Mode C)
        DOMElements.renameNoteBtn.disabled = !hasNotes; // (FIX - Mode C)
    };

    const attachListeners = () => {
        // Register immediate-save listeners
        const immediateSave = () => {
            // Only save if content has actually changed
            const currentNote = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
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
            const note = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
            DOMElements.notepadEditor.value = note ? note.content : '';
            DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        });

        // DEBUG: Step 3 - Force Immediate Notepad Save
        DOMElements.notepadEditor.addEventListener('input', () => {
            if (!activeNoteId) return; // (Keep any existing guards)
            const note = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
            if (note) {
                note.content = DOMElements.notepadEditor.value;
                saveState(); // Remove debounce for testing
                // console.log('Notepad saved immediately');
            }
        });
        // End DEBUG Step 3
        
        DOMElements.newNoteBtn.addEventListener('click', () => {
            SafeUI.showModal('New Note', '<input id="new-note-title" class="sidebar-input" placeholder="Note title">', [
                {label: 'Cancel'},
                {label: 'Create', class: 'button-primary', callback: () => {
                    const titleInput = document.getElementById('new-note-title');
                    const title = titleInput.value.trim() || 'Untitled Note';
                    const newNote = { id: SafeUI.generateId(), title, content: '' };
                    DataHelpers.getCollection(state, 'notes').push(newNote); // (FIX - Mode C)
                    saveState();
                    activeNoteId = newNote.id;
                    renderNotesData();
                }}
            ]);
        });
        
        DOMElements.renameNoteBtn.addEventListener('click', () => {
            if (!activeNoteId) return;
            const note = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
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
            if (!activeNoteId || !DataHelpers.hasItems(state, 'notes')) return; // (FIX - Mode C)
            const note = DataHelpers.findById(state, 'notes', activeNoteId); // (FIX - Mode C)
            if (!note) return;
            
            UIPatterns.confirmDelete('Note', note.title, () => { // (FIX - Mode C)
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
            if (!DataHelpers.hasItems(state, 'notes')) { // (FIX - Mode C)
                DataHelpers.getCollection(state, 'notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' }); // (FIX - Mode C)
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

const SharedSettingsModal = (() => {
    /**
     * Creates the full HTML for the modal content.
     * @param {string} [customSettingsHtml=''] - Page-specific *settings* (like KB URL).
     * @param {string} [pageSpecificDataHtml=''] - Page-specific *data I/O* (like CSV or Wordbank).
     */
    // --- FIX (Mode E Revert) ---
    // Re-added the standard backup/restore section
    const _createModalHtml = (customSettingsHtml = '', pageSpecificDataHtml = '') => {
        
        // Section 1: Custom Settings (e.g., KB URL)
        const customSettingsSection = customSettingsHtml ? `
            ${customSettingsHtml}
            <div class="divider"></div>
        ` : '';

        // Section 2: Page-Specific Data I/O (e.g., CSV, Wordbank)
        const pageDataSection = pageSpecificDataHtml ? `
            <div class="form-group">
                <label>Page-Specific Data</label>
                <p class="form-help">Import or export data specific to this page.</p>
                <div class="button-group">
                    ${pageSpecificDataHtml}
                </div>
            </div>
            <div class="divider"></div>
        ` : '';

        // Section 3: Standard JSON Backup/Restore
        const standardBackupSection = `
            <div class="form-group">
                <label>Advanced Data Management (All Apps)</label>
                <p class="form-help">Use these tools for disaster recovery. This will backup/restore *all* data for *all* apps.</p>
                <div class="button-group">
                    <button id="modal-backup-btn" class="button-base">Backup ALL (JSON)</button>
                    <button id="modal-restore-btn" class="button-base">Restore ALL (JSON)</button>
                </div>
            </div>
        `;
        
        // Inject custom HTML above the standard backup/restore section
        return customSettingsSection + pageDataSection + standardBackupSection;
    };
    // --- END FIX ---

    // --- FIX (Mode E Revert) ---
    // Re-added this function
    /**
     * Attaches listeners for the standard Backup/Restore buttons.
     */
    const _attachStandardListeners = (config) => {
        const backupBtn = document.getElementById('modal-backup-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => {
                BackupRestore.createBackup(config.state, config.appName);
            });
        }

        const restoreBtn = document.getElementById('modal-restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => {
                BackupRestore.handleRestoreUpload({
                    appName: config.appName,
                    itemValidators: config.itemValidators,
                    onRestore: (dataToRestore) => {
                        UIPatterns.confirmDelete("Restore", "This will overwrite all data for this app. This cannot be undone.", () => {
                            config.onRestoreCallback(dataToRestore);
                            SafeUI.showToast('Data restored successfully.');
                            SafeUI.hideModal();
                        });
                    }
                });
            });
        }
    };
    // --- END FIX ---

    return {
        /**
         * Initializes the shared settings modal.
         * @param {object} config
         * @param {string} config.buttonId - ID of the settings button to attach to.
         * @param {string} config.appName - The app's name (for backups).
         * @param {object} config.state - The app's state object.
         * @param {function} config.onRestoreCallback - Function to run after data is validated.
         * @param {object} config.itemValidators - Validation rules for restore.
         * @param {string} [config.customSettingsHtml] - (Optional) Page-specific *settings* (like KB URL).
         * @param {string} [config.pageSpecificDataHtml] - (Optional) Page-specific *data I/O buttons* (like CSV).
         * @param {function} [config.onModalOpen] - (Optional) Callback to run after modal opens (for attaching listeners to custom HTML).
         * @param {function} [config.onModalSave] - (Optional) If provided, shows Save/Cancel buttons. Save callback must return true on success to close.
         */
        init: (config) => {
            const settingsBtn = document.getElementById(config.buttonId);
            if (!settingsBtn) {
                console.error(`SharedSettingsModal: Button with id "${config.buttonId}" not found.`);
                return;
            }

            // 1. Set the icon consistently
            settingsBtn.innerHTML = SafeUI.SVGIcons.settings;

            // 2. Attach the click listener to the settings button
            settingsBtn.addEventListener('click', () => {
                const modalHtml = _createModalHtml(config.customSettingsHtml, config.pageSpecificDataHtml); // <-- UPDATED

                // 3. Determine which buttons to show (Save/Cancel or just Close)
                let modalActions = [];
                if (config.onModalSave) {
                    // Use case for lookup.html (needs a Save button)
                    modalActions = [
                        { label: 'Cancel' },
                        { 
                            label: 'Save', 
                            class: 'button-primary', 
                            callback: () => {
                                // Only close modal if the save callback returns true
                                if (config.onModalSave() === true) {
                                    SafeUI.hideModal();
                                } else {
                                    // Stay open, validation error was likely shown
                                    return false; 
                                }
                            }
                        }
                    ];
                } else {
                    // Use case for index.html, passwords.html, and mailto.html
                    modalActions = [{ label: 'Close' }];
                }

                // 4. Show the modal
                SafeUI.showModal("Settings", modalHtml, modalActions);

                // --- FIX (Mode E Revert) ---
                // 5. Attach listeners for standard Backup/Restore (RE-ADDED)
                _attachStandardListeners(config);
                // --- END FIX ---

                // 6. Run page-specific "open" callback (for custom HTML buttons)
                if (config.onModalOpen) {
                    config.onModalOpen();
                }
            });
        }
    };
})();


// Expose components to the global window scope
window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;
window.NotepadManager = NotepadManager;
window.QuickListManager = QuickListManager; // Expose the new module
window.SharedSettingsModal = SharedSettingsModal;

// --- FIX (Mode F) ---
window.APP_UI_VERSION = UI_VERSION;
// --- END FIX ---
