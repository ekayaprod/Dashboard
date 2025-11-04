/**
 * app-ui.js
 * High-level, reusable UI patterns and components
 * Depends on: app-core.js
 */

const UIPatterns = (() => {
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
         * Highlight search term in text (for search results)
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
         * Render a list with empty state handling
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
         * Simple search - filter array of objects by term matching any string property
         */
        simpleSearch: (items, term, searchFields) => {
            if (!term || !term.trim()) return items;

            const lowerTerm = term.toLowerCase().trim();

            return items.filter(item => {
                return searchFields.some(field => {
                    const value = item[field];
                    if (value == null || typeof value === 'object') return false; 
                    return String(value).toLowerCase().includes(lowerTerm);
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


const DashboardUI = (() => {
    const APP_VERSION = '6.2.0';
    const LOCAL_STORAGE_KEY = 'dashboard_state_v5';
    const APP_CONFIG = {
        NAME: 'dashboard',
        APP_CSV_HEADERS: ['id', 'name', 'urls', 'escalation']
    };
    const DEBOUNCE_DELAY = 500;
    
    let ctx = null; 
    let DOMElements = {};
    let state = null;
    let saveState = () => {};

    let shortcutsManager;
    let selectedAppId = null;
    let activeNoteId = null;
    let initialAppData = null;
    
    // --- State Accessors ---
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
    
    // --- UI State Management ---
    const checkFormDirty = () => {
        if (!initialAppData) return false;
        // Check for new app form being dirty (id: null)
        if (initialAppData.id === null) {
            return DOMElements.editAppName.value.trim() !== '' ||
                   DOMElements.editAppUrls.value.trim() !== '' ||
                   DOMElements.editAppEscalation.value.trim() !== '';
        }
        // Check for existing app form being dirty
        return DOMElements.editAppName.value.trim() !== initialAppData.name ||
               DOMElements.editAppUrls.value.trim() !== initialAppData.urls ||
               DOMElements.editAppEscalation.value.trim() !== initialAppData.escalation;
    };
    
    const updateSaveButtonState = () => {
        if(DOMElements.saveChangesBtn) DOMElements.saveChangesBtn.disabled = !checkFormDirty();
    };
    
    // --- Shortcuts Manager ---
    const createShortcutsManager = () => {
        const container = DOMElements.shortcutsContainer;
        let draggedItemId = null;

        const addDragAndDropListeners = (element) => {
            element.addEventListener('dragstart', (e) => {
                draggedItemId = element.dataset.id;
                setTimeout(() => element.classList.add('dragging'), 0);
            });
            element.addEventListener('dragend', () => {
                element.classList.remove('dragging');
                draggedItemId = null;
            });
        };

        const createShortcutElement = (shortcut) => {
            const div = document.createElement('div');
            div.className = 'shortcut-item';
            div.dataset.id = shortcut.id;
            div.draggable = true;
            div.innerHTML = `
                <span class="drag-handle" title="Drag to reorder">☰</span>
                <a href="${shortcut.url}" target="_blank" rel="noopener noreferrer">${SafeUI.escapeHTML(shortcut.name)}</a>
                <button class="icon-btn delete-btn" data-id="${shortcut.id}" title="Delete">${SafeUI.SVGIcons.trash}</button>
            `;
            addDragAndDropListeners(div);
            return div;
        };

        const render = () => {
            container.innerHTML = '';
            if (!hasItems('shortcuts')) {
                container.innerHTML = `<span style="color: var(--subtle-text); font-size: 0.8rem; grid-column: 1 / -1;">No shortcuts. Add from 'Actions'.</span>`;
            } else {
                ListRenderer.renderList({
                    container: container,
                    items: getCollection('shortcuts'),
                    emptyMessage: "This should not be seen",
                    createItemElement: createShortcutElement
                });
            }
        };

        const remove = (shortcutId) => {
            const itemIndex = getCollection('shortcuts').findIndex(s => s.id === shortcutId);
            if (itemIndex === -1) return;
            const itemCopy = { ...getCollection('shortcuts')[itemIndex] };

            confirmDelete('shortcuts', itemCopy.name, () => {
                getCollection('shortcuts').splice(itemIndex, 1);
                saveState();
                render();
            });
        };

        const add = () => {
            SafeUI.showModal('Add Shortcut',
                `<input type="text" id="shortcut-name" placeholder="Name" class="sidebar-input">
                 <input type="text" id="shortcut-url" placeholder="URL" class="sidebar-input">`,
                [{ label: 'Cancel' }, {
                    label: 'Add', class: 'button-primary', callback: () => {
                        const nameInput = document.getElementById('shortcut-name');
                        const urlInput = document.getElementById('shortcut-url');
                        const name = nameInput.value;
                        const url = urlInput.value;
                        if (SafeUI.validators.notEmpty(name) && SafeUI.validators.maxLength(name, 50) && SafeUI.validators.url(url)) {
                            getCollection('shortcuts').push({ id: SafeUI.generateId(), name, url });
                            saveState();
                            render();
                        } else {
                            SafeUI.showToast('Invalid name or URL');
                            return false;
                        }
                    }
                }]
            );
        };

        const init = () => {
            container.addEventListener('click', (e) => {
                const deleteBtn = e.target.closest('.delete-btn');
                if (deleteBtn && deleteBtn.dataset.id) {
                    remove(deleteBtn.dataset.id);
                }
            });

            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                container.classList.add('drag-active');
            });
            container.addEventListener('dragleave', () => container.classList.remove('drag-active'));
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-active');
                if (!draggedItemId) return;

                const targetElement = e.target.closest('.shortcut-item');
                const shortcuts = getCollection('shortcuts');
                const draggedIndex = shortcuts.findIndex(s => s.id === draggedItemId);
                if (draggedIndex === -1) return;

                const [draggedItem] = shortcuts.splice(draggedIndex, 1);

                if (targetElement && targetElement.dataset.id !== draggedItemId) {
                    const targetIndex = shortcuts.findIndex(s => s.id === targetElement.dataset.id);
                    if (targetIndex !== -1) {
                        // Use insertBefore logic (checks mouse position relative to target)
                        const rect = targetElement.getBoundingClientRect();
                        const isBefore = e.clientY < rect.top + rect.height / 2;
                        shortcuts.splice(isBefore ? targetIndex : targetIndex + 1, 0, draggedItem);
                    } else {
                        shortcuts.push(draggedItem);
                    }
                } else if (!targetElement) {
                     // Dropped into empty space of container (append to end)
                     shortcuts.push(draggedItem);
                } else {
                    // Dropped on self, insert back at original position
                    shortcuts.splice(draggedIndex, 0, draggedItem);
                }
                
                saveState();
                render();
                draggedItemId = null;
            });
        };

        return { init, render, add };
    };
    
    // --- CSV Import/Export Logic ---
    const validateCsvRow = (row, index) => {
        const entry = {
            id: row.id || SafeUI.generateId(),
            name: (row.name || '').trim(),
            urls: (row.urls || '').trim(),
            escalation: (row.escalation || '').trim()
        };

        if (!SafeUI.validators.notEmpty(entry.name)) {
            return { error: `Row ${index + 2}: 'name' is required.` };
        }
        return { entry };
    };
    
    const confirmCsvImport = (validatedData, importErrors) => {
        const newEntries = [];
        const updatedEntries = [];
        const existingIds = new Set(state.apps.map(app => app.id));

        validatedData.forEach(entry => {
            if (existingIds.has(entry.id)) {
                updatedEntries.push(entry);
            } else {
                newEntries.push(entry);
            }
        });

        const errorList = importErrors.slice(0, 10).map(e => `<li>${SafeUI.escapeHTML(e)}</li>`).join('');
        const moreErrors = importErrors.length > 10 ? `<li>... and ${importErrors.length - 10} more errors.</li>` : '';

        let summaryHtml = `<p>Found <strong>${newEntries.length} new</strong> applications and <strong>${updatedEntries.length} applications to overwrite</strong>.</p>`;
        
        if (importErrors.length > 0) {
            summaryHtml += `<p>The following ${importErrors.length} rows had errors and were skipped:</p>
                            <ul style="font-size: 0.8rem; max-height: 150px; overflow-y: auto; text-align: left;">
                                ${errorList}${moreErrors}
                            </ul>`;
        }

        summaryHtml += `<p>Do you want to apply these changes? This cannot be undone.</p>`;

        SafeUI.showModal("Confirm CSV Import", summaryHtml, [
            { label: 'Cancel' },
            { 
                label: 'Import and Overwrite', 
                class: 'button-primary', 
                callback: () => {
                    let importedCount = 0;
                    
                    newEntries.forEach(entry => {
                        if (state.apps.some(app => app.id === entry.id)) {
                            console.warn(`ID collision detected for "${entry.name}". Assigning new ID.`);
                            entry.id = SafeUI.generateId();
                        }
                        state.apps.push(entry);
                        importedCount++;
                    });

                    updatedEntries.forEach(entry => {
                        const existingIndex = state.apps.findIndex(app => app.id === entry.id);
                        if (existingIndex > -1) {
                            state.apps[existingIndex] = entry;
                            importedCount++;
                        }
                    });

                    saveState();
                    renderAll();
                    SafeUI.showToast(`Imported ${importedCount} applications.`);
                }
            }
        ]);
    };
    
    // --- App & Notes Rendering ---
    const renderAppDropdown = () => {
        const appSelect = DOMElements.appSelect;
        const selectedValue = appSelect.value;
        appSelect.innerHTML = '<option value="">-- Select an App --</option>';

        const sortedApps = [...getCollection('apps')].sort((a,b) => a.name.localeCompare(b.name));
        
        const fragment = document.createDocumentFragment();
        sortedApps.forEach(app => fragment.appendChild(new Option(app.name, app.id)));
        appSelect.appendChild(fragment);
        
        if (selectedValue && sortedApps.some(app => app.id === selectedValue)) {
            appSelect.value = selectedValue;
        } else {
            appSelect.value = '';
            if (selectedAppId && !sortedApps.some(app => app.id === selectedAppId)) {
                selectedAppId = null;
            }
        }
    };

    const renderAppData = () => {
        if (!hasItems('apps')) {
            DOMElements.appSelectGroup.classList.add('hidden');
            DOMElements.appEmptyState.classList.remove('hidden');
        } else {
            DOMElements.appSelectGroup.classList.remove('hidden');
            DOMElements.appEmptyState.classList.add('hidden');
            renderAppDropdown();
        }
    };

    const renderNotesData = () => {
        const noteSelect = DOMElements.noteSelect;
        noteSelect.innerHTML = '';

        const fragment = document.createDocumentFragment();
        getCollection('notes').forEach(note => fragment.appendChild(new Option(note.title, note.id)));
        noteSelect.appendChild(fragment);

        // --- Mode C, Fix 4: Consolidate redundant notepad selection logic ---
        const notes = getCollection('notes');
        const hasNotes = hasItems('notes');

        if (activeNoteId && notes.some(n => n.id == activeNoteId)) {
             noteSelect.value = activeNoteId;
        } else {
            // Fix: If an active note doesn't exist (e.g., deleted), select the first one or null.
            activeNoteId = hasNotes ? notes[0].id : null;
            if (activeNoteId) noteSelect.value = activeNoteId;
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
        DOMElements.deleteNoteBtn.disabled = !hasNotes;
        DOMElements.renameNoteBtn.disabled = !hasNotes;
    };
    
    // --- Main Rendering ---
    const renderAll = () => {
        if (shortcutsManager) shortcutsManager.render();
        renderAppData();
        renderNotesData();
    };

    // --- Detail Panel Logic ---
    const displayAppDetails = (appId) => {
        selectedAppId = appId;
        const isVisible = !!appId;

        DOMElements.editAppName.value = '';
        DOMElements.editAppUrls.value = '';
        DOMElements.editAppEscalation.value = '';
        DOMElements.editAppNameWrapper.classList.add('hidden');

        DOMElements.appDetailsContainer.classList.toggle('hidden', !isVisible);

        if (isVisible) {
            const app = findById('apps', appId);
            if (!app) {
                console.error(`Failed to find app with ID: ${appId}`);
                DOMElements.appDetailsContainer.classList.add('hidden');
                selectedAppId = null;
                initialAppData = null;
                return;
            }
            
            initialAppData = {...app};
            DOMElements.editAppName.value = app.name;
            
            DOMElements.editAppUrls.value = (app.urls || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            DOMElements.editAppEscalation.value = (app.escalation || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        } else {
            initialAppData = null;
        }

        setTimeout(() => {
            DOMHelpers.triggerTextareaResize(DOMElements.editAppUrls);
            DOMHelpers.triggerTextareaResize(DOMElements.editAppEscalation);
        }, 0);
        
        updateSaveButtonState();
    };

    const createNewAppForm = () => {
        DOMElements.appSelect.value = '';
        displayAppDetails(null);
        DOMElements.appDetailsContainer.classList.remove('hidden');
        DOMElements.editAppNameWrapper.classList.remove('hidden');
        DOMElements.editAppName.focus();
        // Initialize temporary app data object for a new entry
        initialAppData = {id: null, name: '', urls: '', escalation: ''};
        updateSaveButtonState();
    };

    // --- Settings Modal ---
    const showSettingsModal = () => {
        const modalContent = `
            <div class="form-group">
                <label>Advanced Data Management</label>
                <p class="form-help">Use these tools for disaster recovery. "Import/Export" (on the main page) is for managing application data via CSV.</p>
                <div class="button-group">
                    <button id="modal-backup-btn" class="button-base">Backup ALL (JSON)</button>
                    <button id="modal-restore-btn" class="button-base">Restore ALL (JSON)</button>
                </div>
            </div>
        `;
        
        SafeUI.showModal("Settings", modalContent, [{ label: 'Close' }]);

        BackupRestore.setupBackupRestoreHandlers({
            state: state,
            appName: APP_CONFIG.NAME,
            backupBtn: document.getElementById('modal-backup-btn'),
            restoreBtn: document.getElementById('modal-restore-btn'),
            itemValidators: {
                apps: APP_CONFIG.APP_CSV_HEADERS,
                notes: ['id', 'title', 'content'],
                shortcuts: ['id', 'name', 'url']
            },
            restoreConfirmMessage: 'This will overwrite all dashboard data (Apps, Notes, and Shortcuts). This cannot be undone.',
            onRestoreCallback: (dataToRestore) => {
                state.apps = dataToRestore.apps || [];
                state.notes = dataToRestore.notes || [];
                state.shortcuts = dataToRestore.shortcuts || [];
                
                if (!hasItems('notes')) {
                    getCollection('notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' });
                }
                
                saveState();
                
                selectedAppId = null;
                activeNoteId = null;
                displayAppDetails(null);
                renderAll();
                SafeUI.showToast('Dashboard data restored.');
                SafeUI.hideModal();
            }
        });
    };
    
    // --- Event Handlers ---
    const attachEventListeners = () => {
        // App Selection
        DOMElements.appSelect.addEventListener('change', () => {
            // Mode B, Fix 2: Check value for empty string and assign null
            const appId = DOMElements.appSelect.value || null; 
            displayAppDetails(appId);
        });

        // App Detail Change Detection
        const debouncedSave = SafeUI.debounce(updateSaveButtonState, DEBOUNCE_DELAY);
        DOMElements.editAppName.addEventListener('input', debouncedSave);
        DOMElements.editAppUrls.addEventListener('input', debouncedSave);
        DOMElements.editAppEscalation.addEventListener('input', debouncedSave);
        
        // App Save
        DOMElements.saveChangesBtn.addEventListener('click', () => {
            const newName = DOMElements.editAppName.value.trim();
            if (!SafeUI.validators.notEmpty(newName) || !SafeUI.validators.maxLength(newName, 100)) {
                return SafeUI.showValidationError('Invalid Name', 'App Name must be between 1 and 100 characters.', 'edit-app-name');
            }

            const isNewApp = initialAppData && initialAppData.id === null;
            const nameChanged = !isNewApp && initialAppData && newName !== initialAppData.name;
            
            if ((isNewApp || nameChanged) && DataValidator.hasDuplicate(state.apps, 'name', newName)) {
                return SafeUI.showValidationError('Duplicate Name', 'An application with this name already exists.', 'edit-app-name');
            }

            const appData = {
                name: newName,
                urls: DOMElements.editAppUrls.value.trim(),
                escalation: DOMElements.editAppEscalation.value.trim()
            };

            let appToSelectId;
            if (isNewApp) {
                appData.id = SafeUI.generateId();
                getCollection('apps').push(appData);
                appToSelectId = appData.id;
                SafeUI.showToast('Application created');
            } else {
                const app = findById('apps', selectedAppId);
                if (app) {
                    app.name = appData.name;
                    app.urls = appData.urls;
                    app.escalation = appData.escalation;
                    appToSelectId = app.id;
                    SafeUI.showToast('Application updated');
                }
            }
            
            saveState();
            renderAppData();
            DOMElements.appSelect.value = appToSelectId;
            displayAppDetails(appToSelectId);
        });

        // App Delete
        DOMElements.deleteAppBtn.addEventListener('click', () => {
            if (!selectedAppId) return;
            const app = findById('apps', selectedAppId);
            if (!app) return;
            
            confirmDelete('apps', app.name, () => {
                state.apps = state.apps.filter(a => a.id !== selectedAppId);
                saveState();
                selectedAppId = null;
                displayAppDetails(null);
                renderAppData();
            });
        });

        // Dashboard Actions
        DOMElements.addShortcutBtnMenu.addEventListener('click', () => shortcutsManager.add());
        DOMElements.addNewAppBtnMenu.addEventListener('click', createNewAppForm);
        DOMElements.btnSettings.addEventListener('click', showSettingsModal);

        // Notepad Actions
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
        }, DEBOUNCE_DELAY));
        
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

        // Before Unload Protection (Mode A, Fix 1 from index.html)
        window.addEventListener('beforeunload', (e) => { 
            if (checkFormDirty()) { 
                e.preventDefault(); 
                e.returnValue = ''; 
            } 
        });
    };

    /**
     * Public entry point for dashboard initialization
     */
    async function initDashboard(context) {
        // Save context globally for accessors
        ctx = context;
        DOMElements = ctx.elements;
        state = ctx.state;
        saveState = ctx.saveState;
        
        // Setup textareas
        DOMHelpers.setupTextareaAutoResize(DOMElements.editAppUrls);
        DOMHelpers.setupTextareaAutoResize(DOMElements.editAppEscalation);
        DOMHelpers.setupTextareaAutoResize(DOMElements.notepadEditor);

        // Setup icons
        DOMElements.addShortcutBtnMenu.innerHTML = SafeUI.SVGIcons.plus;
        DOMElements.addNewAppBtnMenu.innerHTML = SafeUI.SVGIcons.plus + ' App';
        DOMElements.btnSettings.innerHTML = SafeUI.SVGIcons.settings;
        DOMElements.deleteAppBtn.innerHTML = SafeUI.SVGIcons.trash;
        DOMElements.newNoteBtn.innerHTML = SafeUI.SVGIcons.plus;
        DOMElements.renameNoteBtn.innerHTML = SafeUI.SVGIcons.pencil;
        DOMElements.deleteNoteBtn.innerHTML = SafeUI.SVGIcons.trash;

        // Initialize shortcuts
        shortcutsManager = createShortcutsManager();
        shortcutsManager.init();

        // Setup CSV listeners
        CsvManager.setupExport({
            exportBtn: DOMElements.btnExportCsv,
            dataGetter: () => state.apps,
            headers: APP_CONFIG.APP_CSV_HEADERS,
            filename: `${APP_CONFIG.NAME}-export.csv`
        });
        
        CsvManager.setupImport({
            importBtn: DOMElements.btnImportCsv,
            headers: APP_CONFIG.APP_CSV_HEADERS,
            onValidate: validateCsvRow,
            onConfirm: confirmCsvImport
        });

        attachEventListeners();

        // First-run check for notes
        if (!hasItems('notes')) {
            getCollection('notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' });
            saveState();
        }

        renderAll();
        SafeUI.loadNavbar("navbar-container");
    }

    return { initDashboard };

})();

// Expose components to the global window scope
window.UIPatterns = UIPatterns;
window.ListRenderer = ListRenderer;
window.SearchHelper = SearchHelper;
window.DashboardUI = DashboardUI; // Expose the new module