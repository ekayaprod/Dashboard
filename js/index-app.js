// Non-destructive error banner
(() => {
    const dependencies = ['SafeUI', 'UIPatterns', 'ListRenderer', 'SearchHelper', 'BackupRestore', 'DataValidator', 'DataConverter', 'CsvManager'];
    const missing = dependencies.filter(dep => typeof window[dep] === 'undefined');
    if (missing.length > 0) {
        const errorTitle = "Application Failed to Load";
        const errorMessage = `One or more required JavaScript files (e.g., app-core.js, app-ui.js) failed to load, or core modules are missing. Missing: ${missing.join(', ')}`;
        
        console.error(errorMessage);
        
        // Try to use the AppLifecycle banner if it loaded, otherwise fallback
        if (typeof window.AppLifecycle !== 'undefined' && typeof window.AppLifecycle._showErrorBanner === 'function') {
            window.AppLifecycle._showErrorBanner(errorTitle, errorMessage);
        } else {
            // Fallback banner
            const banner = document.createElement('div');
            banner.id = 'app-startup-error-inline';
            banner.style.cssText = `position:sticky;top:0;left:0;width:100%;padding:1rem;background-color:#fef2f2;color:#dc2626;border-bottom:2px solid #fecaca;font-family:sans-serif;font-size:1rem;font-weight:600;z-index:10000;box-sizing:border-box;`;
            banner.innerHTML = `<strong>${errorTitle}</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">${errorMessage}</p>`;
            
            if (document.body) {
                document.body.prepend(banner);
            } else {
                document.addEventListener('DOMContentLoaded', () => document.body.prepend(banner));
            }
        }
        // Throw an error to stop execution
        throw new Error(`Critical dependencies missing: ${missing.join(', ')}`);
    }
})();

AppLifecycle.run(async () => {
    const APP_VERSION = '6.2.0'; // CSV Import/Export
    const LOCAL_STORAGE_KEY = 'dashboard_state_v5';
    const APP_CONFIG = {
        NAME: 'dashboard',
        APP_CSV_HEADERS: ['id', 'name', 'urls', 'escalation']
    };
    const DEBOUNCE_DELAY = 500;

    const defaultState = {
        apps: [],
        notes: [],
        shortcuts: [],
        version: APP_VERSION
    };

    const ctx = await AppLifecycle.initPage({
        storageKey: LOCAL_STORAGE_KEY,
        defaultState,
        version: APP_VERSION,
        requiredElements: [
            'shortcuts-container', 'app-select-group', 'app-select',
            'app-empty-state', 'modal-overlay', 'modal-content', 'app-details-container',
            'app-editor-fields', 'edit-app-name-wrapper', 'edit-app-name', 'edit-app-urls',
            'edit-app-escalation', 'save-changes-btn', 'delete-app-btn', 'add-shortcut-btn-menu',
            'add-new-app-btn-menu', 
            // Add new button IDs
            'btn-export-csv', 'btn-import-csv', 'btn-settings',
            'notepad-header',
            'note-select', 'notepad-editor', 'toast', 'new-note-btn', 'rename-note-btn', 'delete-note-btn',
            'navbar-container'
        ]
    });

    if (!ctx) return;

    const { elements: DOMElements, state, saveState } = ctx;

    let shortcutsManager;
    let selectedAppId = null;
    let activeNoteId = null;
    let initialAppData = null;

    const getCollection = (type) => state[type];
    const hasItems = (type) => getCollection(type).length > 0;
    
    // Helper to find an item by ID
    const findById = (collectionType, id) => {
        if (!id) return null;
        return getCollection(collectionType).find(item => item.id === id);
    };

    const confirmDelete = (type, itemName, onConfirm) => {
        const labels = {apps: 'Application', notes: 'Note', shortcuts: 'Shortcut'};
        const itemTypeLabel = labels[type] || 'Item';
        UIPatterns.confirmDelete(itemTypeLabel, itemName, onConfirm);
    };

    const createShortcutsManager = (state, dom, services) => {
        const container = dom.shortcutsContainer;
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
                <a href="${shortcut.url}" target="_blank" rel="noopener noreferrer">${services.escapeHTML(shortcut.name)}</a>
                <button class="icon-btn delete-btn" data-id="${shortcut.id}" title="Delete">${services.SVGIcons.trash}</button>
            `;
            addDragAndDropListeners(div);
            return div;
        };

        const render = () => {
            container.innerHTML = '';
            if (!hasItems('shortcuts')) {
                container.innerHTML = `<span style="color: var(--subtle-text); font-size: 0.8rem; grid-column: 1 / -1;">No shortcuts. Add from 'Actions'.</span>`;
            } else {
                const fragment = document.createDocumentFragment();
                getCollection('shortcuts').forEach(shortcut => {
                    const element = createShortcutElement(shortcut);
                    fragment.appendChild(element);
                });
                container.appendChild(fragment);
            }
        };

        const remove = (shortcutId) => {
            const itemIndex = getCollection('shortcuts').findIndex(s => s.id === shortcutId);
            if (itemIndex === -1) return;
            const itemCopy = { ...getCollection('shortcuts')[itemIndex] };

            services.confirmDelete('shortcuts', itemCopy.name, () => {
                getCollection('shortcuts').splice(itemIndex, 1);
                services.saveState();
                render();
            });
        };

        const add = () => {
            services.showModal('Add Shortcut',
                `<input type="text" id="shortcut-name" placeholder="Name" class="sidebar-input">
                 <input type="text" id="shortcut-url" placeholder="URL" class="sidebar-input">`,
                [{ label: 'Cancel' }, {
                    label: 'Add', class: 'button-primary', callback: () => {
                        const nameInput = document.getElementById('shortcut-name');
                        const urlInput = document.getElementById('shortcut-url');
                        const name = nameInput.value;
                        const url = urlInput.value;
                        if (services.validators.notEmpty(name) && services.validators.maxLength(name, 50) && services.validators.url(url)) {
                            getCollection('shortcuts').push({ id: services.generateId(), name, url });
                            services.saveState();
                            render();
                        } else {
                            services.showToast('Invalid name or URL');
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

            container.addEventListener('dragover', (e) => e.preventDefault());

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!draggedItemId) return;

                const targetElement = e.target.closest('.shortcut-item, .shortcuts-container');
                if (!targetElement) return;

                const shortcuts = getCollection('shortcuts');
                const draggedIndex = shortcuts.findIndex(s => s.id === draggedItemId);
                if (draggedIndex === -1) return;

                const [draggedItem] = shortcuts.splice(draggedIndex, 1);

                if (targetElement.classList.contains('shortcut-item') && targetElement.dataset.id !== draggedItemId) {
                    const targetIndex = shortcuts.findIndex(s => s.id === targetElement.dataset.id);
                    if (targetIndex !== -1) {
                        shortcuts.splice(targetIndex, 0, draggedItem);
                    } else {
                        shortcuts.push(draggedItem);
                    }
                } else if (targetElement.classList.contains('shortcut-item') && targetElement.dataset.id === draggedItemId) {
                    shortcuts.splice(draggedIndex, 0, draggedItem);
                } else {
                    shortcuts.push(draggedItem);
                }
                services.saveState();
                render();
                draggedItemId = null;
            });
        };

        return { init, render, add };
    };

    const renderAppDropdown = () => {
        const appSelect = DOMElements.appSelect;
        const selectedValue = appSelect.value;
        appSelect.innerHTML = '<option value="">-- Select an App --</option>';

        const sortedApps = [...getCollection('apps')].sort((a,b) => a.name.localeCompare(b.name));
        
        sortedApps.forEach(app => {
            appSelect.add(new Option(app.name, app.id));
        });
        
        // Only restore selection if the app still exists
        if (selectedValue && sortedApps.some(app => app.id === selectedValue)) {
            appSelect.value = selectedValue;
        } else {
            appSelect.value = '';
            if (selectedAppId && !sortedApps.some(app => app.id === selectedAppId)) {
                selectedAppId = null; // Clear stale reference
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

        if (activeNoteId && getCollection('notes').some(n => n.id == activeNoteId)) {
             noteSelect.value = activeNoteId;
        } else if (hasItems('notes')) {
            activeNoteId = getCollection('notes')[0].id;
            noteSelect.value = activeNoteId;
        } else {
            activeNoteId = null;
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

    const renderAll = () => {
        if (shortcutsManager) shortcutsManager.render();
        renderAppData();
        renderNotesData();
    };
    
    const checkFormDirty = () => {
        if (!initialAppData) return false;
        if (initialAppData.id === null) {
            return DOMElements.editAppName.value.trim() !== '' ||
                   DOMElements.editAppUrls.value.trim() !== '' ||
                   DOMElements.editAppEscalation.value.trim() !== '';
        }
        return DOMElements.editAppName.value.trim() !== initialAppData.name ||
               DOMElements.editAppUrls.value.trim() !== initialAppData.urls ||
               DOMElements.editAppEscalation.value.trim() !== initialAppData.escalation;
    };
    
    const updateSaveButtonState = () => {
        if(DOMElements.saveChangesBtn) DOMElements.saveChangesBtn.disabled = !checkFormDirty();
    };

    const displayAppDetails = (appId) => {
        selectedAppId = appId;
        const isVisible = !!appId;

        // --- Clear fields before loading new data ---
        // Always clear and reset fields first.
        DOMElements.editAppName.value = '';
        DOMElements.editAppUrls.value = '';
        DOMElements.editAppEscalation.value = '';
        DOMElements.editAppNameWrapper.classList.add('hidden'); // Hide app name field by default

        DOMElements.appDetailsContainer.classList.toggle('hidden', !isVisible);

        if (isVisible) {
            const app = findById('apps', appId);
            if (!app) {
                console.error(`Failed to find app with ID: ${appId}`);
                DOMElements.appDetailsContainer.classList.add('hidden'); // Ensure it's hidden if app lookup fails
                selectedAppId = null;
                initialAppData = null;
                return; // Exit
            }
            
            initialAppData = {...app};
            DOMElements.editAppName.value = app.name; // Keep name field populated for save logic
            
            // Normalize line breaks and set values
            DOMElements.editAppUrls.value = (app.urls || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
            DOMElements.editAppEscalation.value = (app.escalation || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        } else {
            initialAppData = null;
        }

        // Defer resize with setTimeout(0) to allow browser to render
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
        initialAppData = {id: null, name: '', urls: '', escalation: ''};
        updateSaveButtonState();
    };

    // ====================================================================
    // CSV IMPORT / EXPORT
    // ====================================================================

    /**
     * Validates a row from the CSV file
     */
    const validateCsvRow = (row, index) => {
        const entry = {
            id: row.id || SafeUI.generateId(), // Keep old ID or make new one
            name: (row.name || '').trim(),
            urls: (row.urls || '').trim(),
            escalation: (row.escalation || '').trim()
        };

        if (!SafeUI.validators.notEmpty(entry.name)) {
            return { error: `Row ${index + 2}: 'name' is required.` };
        }
        return { entry };
    };
    
    /**
     * Confirms and processes the CSV import data
     */
    const confirmCsvImport = (validatedData, importErrors) => {
        // --- FIX: This logic was split incorrectly in the original file ---
        // Logic to categorize entries
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
        // --- End Fix ---

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
                    
                    // Add new entries, checking for ID collisions
                    newEntries.forEach(entry => {
                        if (state.apps.some(app => app.id === entry.id)) {
                            console.warn(`ID collision detected for "${entry.name}" (${entry.id}). Assigning new ID.`);
                            entry.id = SafeUI.generateId(); // Re-assign
                        }
                        state.apps.push(entry);
                        importedCount++;
                    });

                    // Update existing entries
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

    // ====================================================================
    // SETTINGS MODAL
    // ====================================================================
    
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

        // Attach listeners to modal buttons
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
                
                // --- FIX: This was missing in the original file ---
                // After restoring, we must reset the UI
                selectedAppId = null;
                activeNoteId = null;
                displayAppDetails(null); // Hide details panel
                renderAll(); // Re-render dropdowns and lists
                SafeUI.showToast('Dashboard data restored.');
                SafeUI.hideModal();
                // --- End Fix ---
            }
        });
    };

    // --- FIX: Add the missing init() function wrapper and loadNavbar() call ---
    /**
     * Entry point for the application
     */
    async function init() {
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
        shortcutsManager = createShortcutsManager(state, DOMElements, {
            escapeHTML: SafeUI.escapeHTML,
            confirmDelete,
            saveState,
            showModal: SafeUI.showModal,
            showToast: SafeUI.showToast,
            validators: SafeUI.validators,
            generateId: SafeUI.generateId,
            SVGIcons: SafeUI.SVGIcons
        });
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

        // Add main event listeners
        DOMElements.appSelect.addEventListener('change', () => {
            const appId = DOMElements.appSelect.value;
            displayAppDetails(appId || null);
        });

        const debouncedSave = SafeUI.debounce(updateSaveButtonState, DEBOUNCE_DELAY);
        DOMElements.editAppName.addEventListener('input', debouncedSave);
        DOMElements.editAppUrls.addEventListener('input', debouncedSave);
        DOMElements.editAppEscalation.addEventListener('input', debouncedSave);

        DOMElements.saveChangesBtn.addEventListener('click', () => {
            const newName = DOMElements.editAppName.value.trim();
            if (!SafeUI.validators.notEmpty(newName) || !SafeUI.validators.maxLength(newName, 100)) {
                return SafeUI.showValidationError('Invalid Name', 'App Name must be between 1 and 100 characters.', 'edit-app-name');
            }

            // Check for duplicate name ONLY if it's a new app or the name has changed
            const isNewApp = initialAppData.id === null;
            const nameChanged = !isNewApp && newName !== initialAppData.name;
            
            if ((isNewApp || nameChanged) && DataValidator.hasDuplicate(state.apps, 'name', newName)) {
                return SafeUI.showValidationError('Duplicate Name', 'An application with this name already exists.', 'edit-app-name');
            }

            const appData = {
                name: newName,
                urls: DOMElements.editAppUrls.value.trim(),
                escalation: DOMElements.editAppEscalation.value.trim()
            };

            if (isNewApp) {
                // Creating a new app
                appData.id = SafeUI.generateId();
                getCollection('apps').push(appData);
                SafeUI.showToast('Application created');
            } else {
                // Updating an existing app
                const app = findById('apps', selectedAppId);
                if (app) {
                    app.name = appData.name;
                    app.urls = appData.urls;
                    app.escalation = appData.escalation;
                    SafeUI.showToast('Application updated');
                }
            }
            
            saveState();
            renderAppData(); // Re-render dropdown
            DOMElements.appSelect.value = appData.id || selectedAppId;
            displayAppDetails(appData.id || selectedAppId); // Reload data into form
        });

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

        DOMElements.addShortcutBtnMenu.addEventListener('click', () => shortcutsManager.add());
        DOMElements.addNewAppBtnMenu.addEventListener('click', createNewAppForm);
        DOMElements.btnSettings.addEventListener('click', showSettingsModal);

        // Notepad listeners
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
                activeNoteId = null; // Reset
                renderNotesData();
            });
        });

        // First-run check for notes
        if (!hasItems('notes')) {
            getCollection('notes').push({ id: SafeUI.generateId(), title: 'My Scratchpad', content: '' });
            saveState();
        }

        // Initial render
        renderAll();
        
        // --- CRITICAL FIX: Load the navbar ---
        SafeUI.loadNavbar("navbar-container");
    }

    // Run the initialization function
    init();
    
});