/**
 * app-ui.js
 * High-level, reusable UI patterns and components.
 * Depends on: app-core.js
 */

const UIPatterns = (() => {
    return {
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

        confirmAction: (title, message, actionLabel, onConfirm) => {
            SafeUI.showModal(
                title,
                message,
                [
                    { label: 'Cancel' },
                    { label: actionLabel, class: 'button-danger', callback: onConfirm }
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
        },

        copyToClipboard: async (text, successMessage = 'Copied to clipboard!') => {
            const success = await SafeUI.copyToClipboard(text);
            SafeUI.showToast(success ? successMessage : 'Failed to copy.');
            return success;
        }
    };
})();

const ListRenderer = (() => {
    return {
        renderList: (config) => {
            const { container, items, emptyMessage, createItemElement, append } = config;

            if (!container) {
                console.error("ListRenderer: container element is null.");
                return;
            }

            if (!append) {
                container.innerHTML = '';
            }

            if ((!items || items.length === 0) && !append) {
                container.innerHTML = `<div class="empty-state-message">${emptyMessage}</div>`;
                return;
            }

            if (!items || items.length === 0) return;

            const fragment = document.createDocumentFragment();
            items.forEach((item, index) => {
                const element = createItemElement(item, index);
                if (element) fragment.appendChild(element);
            });
            container.appendChild(fragment);
        },
    };
})();

const SearchHelper = (() => {
    return {
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

        createIndex: (items, fields) => {
            if (!items || !Array.isArray(items)) return;
            items.forEach(item => {
                if (!item) return;
                // Create a single string of all searchable values
                const content = fields.map(f => String(item[f] || '').toLowerCase()).join(' ');
                // Use defineProperty to make it non-enumerable (so it doesn't show up in JSON.stringify/loops)
                Object.defineProperty(item, '_searchContent', {
                    value: content,
                    writable: true,
                    enumerable: false,
                    configurable: true
                });
            });
        },

        searchIndex: (items, term) => {
            if (!term || !term.trim()) return items;
            const lowerTerm = term.toLowerCase().trim();

            // Fast path: use pre-computed index
            // Fallback: if item doesn't have index, we can't search it efficiently here
            // (caller should have ensured index exists or used simpleSearch)
            return items.filter(item => {
                return item._searchContent && item._searchContent.includes(lowerTerm);
            });
        },

        /**
         * Asynchronous search that yields to the main thread to prevent UI freezing.
         * @param {Array} items
         * @param {string} term
         * @param {number} [chunkSize=1000]
         * @returns {Promise<Array>}
         */
        searchIndexAsync: (items, term, chunkSize = 1000) => {
            return new Promise((resolve) => {
                if (!term || !term.trim()) {
                    resolve(items);
                    return;
                }
                const lowerTerm = term.toLowerCase().trim();
                const results = [];
                let index = 0;

                const processChunk = () => {
                    const end = Math.min(index + chunkSize, items.length);
                    for (let i = index; i < end; i++) {
                        const item = items[i];
                        if (item._searchContent && item._searchContent.includes(lowerTerm)) {
                            results.push(item);
                        }
                    }
                    index = end;
                    if (index < items.length) {
                        // Yield to main thread
                        setTimeout(processChunk, 0);
                    } else {
                        resolve(results);
                    }
                };
                processChunk();
            });
        },

        setupDebouncedSearch: (inputElement, onSearch, delay = 300) => {
            if (!inputElement) return;
            const debouncedSearch = SafeUI.debounce(onSearch, delay);
            inputElement.addEventListener('input', () => {
                debouncedSearch(inputElement.value);
            });
        }
    };
})();

// ============================================================================
// MODULE: NotepadManager
// ============================================================================
const NotepadManager = (() => {
    let DOMElements;
    let state;
    let saveState;
    let activeNoteId = null;

    const saveActiveNote = () => {
        if (!activeNoteId) return;
        const note = DataHelpers.findById(state, 'notes', activeNoteId);
        if (note && DOMElements.notepadEditor) {
            if (note.id.length < 20) {
                const newId = SafeUI.generateId();
                note.id = newId;
                activeNoteId = newId;
            }
            note.content = DOMElements.notepadEditor.value;
            saveState();
        }
    };
    
    const renderNotesData = () => {
        const noteSelect = DOMElements.noteSelect;
        noteSelect.innerHTML = '';

        const notesCollection = DataHelpers.getCollection(state, 'notes');
        const hasNotes = notesCollection.length > 0;

        const fragment = document.createDocumentFragment();
        notesCollection.forEach(note => fragment.appendChild(new Option(note.title, note.id)));
        noteSelect.appendChild(fragment);

        if (state.ui && state.ui.activeNoteId && notesCollection.some(n => n.id === state.ui.activeNoteId)) {
            activeNoteId = state.ui.activeNoteId;
        } else {
            activeNoteId = activeNoteId && notesCollection.some(n => n.id === activeNoteId) ? activeNoteId : (hasNotes ? notesCollection[0].id : null);
        }

        if (activeNoteId) noteSelect.value = activeNoteId;

        const activeNote = DataHelpers.findById(state, 'notes', activeNoteId);
        if (activeNote) {
            DOMElements.notepadEditor.value = activeNote.content;
            DOMElements.notepadEditor.disabled = false;
            
            if (state.ui && state.ui.notepadScrollTop) {
                setTimeout(() => {
                    if (DOMElements.notepadEditor) DOMElements.notepadEditor.scrollTop = state.ui.notepadScrollTop;
                }, 0);
            }
        } else {
            DOMElements.notepadEditor.value = '';
            DOMElements.notepadEditor.disabled = true;
        }
        DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        DOMElements.deleteNoteBtn.disabled = !hasNotes;
        DOMElements.renameNoteBtn.disabled = !hasNotes;
    };

    const attachListeners = () => {
        const immediateSave = () => {
            const currentNote = DataHelpers.findById(state, 'notes', activeNoteId);
            if (currentNote && DOMElements.notepadEditor.value !== currentNote.content) {
                saveActiveNote();
            }
        };
        DOMElements.noteSelect.addEventListener('mousedown', immediateSave);
        DOMElements.deleteNoteBtn.addEventListener('mousedown', immediateSave);
        
        if (window.AppLifecycle && typeof window.AppLifecycle.registerSaveOnExit === 'function') {
            window.AppLifecycle.registerSaveOnExit(immediateSave);
        }

        DOMElements.noteSelect.addEventListener('change', () => {
            activeNoteId = DOMElements.noteSelect.value;
            
            if (state.ui) {
                state.ui.activeNoteId = activeNoteId;
                saveState();
            }

            const note = DataHelpers.findById(state, 'notes', activeNoteId);
            DOMElements.notepadEditor.value = note ? note.content : '';
            DOMHelpers.triggerTextareaResize(DOMElements.notepadEditor);
        });

        const debouncedUpdate = SafeUI.debounce(() => {
            if (!activeNoteId) return;
            
            const note = DataHelpers.findById(state, 'notes', activeNoteId);
            if (note) {
                note.content = DOMElements.notepadEditor.value;
                if (state.ui) {
                    state.ui.notepadScrollTop = DOMElements.notepadEditor.scrollTop;
                }
                saveState();
            }
        }, 1000); 

        DOMElements.notepadEditor.addEventListener('input', debouncedUpdate);
        DOMElements.notepadEditor.addEventListener('scroll', SafeUI.debounce(() => {
            if (state.ui) {
                state.ui.notepadScrollTop = DOMElements.notepadEditor.scrollTop;
                saveState();
            }
        }, 500));
        
        DOMElements.newNoteBtn.addEventListener('click', () => {
            SafeUI.showModal('New Note', '<input id="new-note-title" class="form-control" placeholder="Note title">', [
                {label: 'Cancel'},
                {label: 'Create', class: 'button-primary', callback: () => {
                    const titleInput = document.getElementById('new-note-title');
                    const title = titleInput.value.trim() || 'Untitled Note';
                    const newNote = { id: SafeUI.generateId(), title, content: '' };
                    DataHelpers.getCollection(state, 'notes').push(newNote);
                    
                    if (state.ui) state.ui.activeNoteId = newNote.id;
                    
                    saveState();
                    activeNoteId = newNote.id;
                    renderNotesData();
                }}
            ]);
        });
        
        DOMElements.renameNoteBtn.addEventListener('click', () => {
            if (!activeNoteId) return;
            const note = DataHelpers.findById(state, 'notes', activeNoteId);
            if (!note) return;
            
            SafeUI.showModal('Rename Note', `<input id="rename-note-title" class="form-control" value="${SafeUI.escapeHTML(note.title)}">`, [
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
            if (!activeNoteId || !DataHelpers.hasItems(state, 'notes')) return;
            const note = DataHelpers.findById(state, 'notes', activeNoteId);
            if (!note) return;
            
            UIPatterns.confirmDelete('Note', note.title, () => {
                state.notes = state.notes.filter(n => n.id !== activeNoteId);
                
                activeNoteId = null;
                if (state.ui) state.ui.activeNoteId = null;
                
                saveState();
                renderNotesData();
            });
        });
    };

    return {
        init: (config) => {
            if (!config.elements || !config.state || !config.saveState) {
                console.error("NotepadManager.init: Missing required config.");
                return;
            }
            DOMElements = config.elements;
            state = config.state;
            saveState = config.saveState;

            DOMHelpers.setupTextareaAutoResize(DOMElements.notepadEditor);

            DOMElements.newNoteBtn.innerHTML = SafeUI.SVGIcons.plus;
            DOMElements.renameNoteBtn.innerHTML = SafeUI.SVGIcons.pencil;
            DOMElements.deleteNoteBtn.innerHTML = SafeUI.SVGIcons.trash;

            attachListeners();

            if (!DataHelpers.hasItems(state, 'notes')) {
                DataHelpers.getCollection(state, 'notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' });
                saveState();
            }

            renderNotesData();
        }
    };
})();

// ============================================================================
// MODULE: QuickListManager
// ============================================================================
const QuickListManager = (() => {
    let config;
    let container;

    const createItemElement = (item) => {
        const div = document.createElement('div');
        div.className = 'shortcut-item';
        div.dataset.id = item.id;
        
        const rawName = config.getItemName(item);
        const name = SafeUI.escapeHTML(rawName);
        let nameElement;

        const href = config.getItemHref ? config.getItemHref(item) : null;
        if (href) {
            nameElement = document.createElement('a');
            nameElement.href = href;
            nameElement.target = '_blank';
            nameElement.rel = 'noopener noreferrer';
            nameElement.textContent = name;
        } else {
            nameElement = document.createElement('button');
            nameElement.className = 'quick-action-btn';
            nameElement.textContent = name;
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
        deleteBtn.setAttribute('aria-label', `Delete ${rawName}`);
        deleteBtn.innerHTML = SafeUI.SVGIcons.trash;
        deleteBtn.dataset.id = item.id;

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

        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            e.preventDefault();
            config.onDeleteClick(item, render);
            return;
        }

        const actionBtn = e.target.closest('.quick-action-btn');
        if (actionBtn) {
            e.preventDefault();
            config.onItemClick(item);
            return;
        }
    };

    return {
        init: (cfg) => {
            config = cfg;
            container = cfg.container;

            if (!container || !config.items || !config.getItemName || !config.onDeleteClick) {
                console.error("QuickListManager.init: Missing required config.");
                return;
            }

            container.innerHTML = '';
            container.addEventListener('click', handleContainerClick);
            
            if (config.addNewButtonId && config.onAddNewClick) {
                const addBtn = document.getElementById(config.addNewButtonId);
                if (addBtn) {
                    addBtn.addEventListener('click', () => {
                        config.onAddNewClick(render);
                    });
                }
            }
            render();
        }
    };
})();

const SharedSettingsModal = (() => {
    const _createModalHtml = (customSettingsHtml = '', pageSpecificDataHtml = '') => {
        const customSettingsSection = customSettingsHtml ? `
            ${customSettingsHtml}
            <div class="divider"></div>
        ` : '';

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

        const standardBackupSection = `
            <div class="form-group">
                <label>Advanced Data Management (All Apps)</label>
                <p class="form-help">Use these tools for disaster recovery. This will backup/restore *all* data for *all* apps.</p>
                <div class="button-group">
                    <button id="modal-backup-btn" class="btn">Backup ALL (JSON)</button>
                    <button id="modal-restore-btn" class="btn">Restore ALL (JSON)</button>
                </div>
            </div>
        `;
        
        return customSettingsSection + pageDataSection + standardBackupSection;
    };

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
                        UIPatterns.confirmAction(
                            "Restore Data",
                            "<p>This will overwrite all data for this app. This cannot be undone.</p>",
                            "Restore",
                            () => {
                                config.onRestoreCallback(dataToRestore);
                                SafeUI.showToast('Data restored successfully.');
                                SafeUI.hideModal();
                            }
                        );
                    }
                });
            });
        }
    };

    return {
        init: (config) => {
            const settingsBtn = document.getElementById(config.buttonId);
            if (!settingsBtn) return;

            settingsBtn.innerHTML = SafeUI.SVGIcons.settings;

            settingsBtn.addEventListener('click', () => {
                const modalHtml = _createModalHtml(config.customSettingsHtml, config.pageSpecificDataHtml);

                let modalActions = [];
                if (config.onModalSave) {
                    modalActions = [
                        { label: 'Cancel' },
                        { 
                            label: 'Save', 
                            class: 'button-primary', 
                            callback: () => {
                                if (config.onModalSave() === true) {
                                    SafeUI.hideModal();
                                } else {
                                    return false; 
                                }
                            }
                        }
                    ];
                } else {
                    modalActions = [{ label: 'Close' }];
                }

                SafeUI.showModal("Settings", modalHtml, modalActions);
                _attachStandardListeners(config);

                if (config.onModalOpen) {
                    config.onModalOpen();
                }
            });
        }
    };
})();

window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;
window.NotepadManager = NotepadManager;
window.QuickListManager = QuickListManager;
window.SharedSettingsModal = SharedSettingsModal;