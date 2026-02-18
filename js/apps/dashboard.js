// ============================================================================
// PAGE-SPECIFIC LOGIC: Dashboard (index.html)
// Handles Applications, Shortcuts, and local settings
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const DEBOUNCE_DELAY = 300;

    let DOMElements;
    let state;
    let saveState;
    let APP_CONFIG;
    let selectedAppId = null;
    let initialAppData = null;

    const checkFormDirty = () => {
        if (!initialAppData) return false;
        const currentUrls = DOMElements.editAppUrls.value.trim();
        const currentEscalation = DOMElements.editAppEscalation.value.trim();

        if (initialAppData.id === null) {
            return DOMElements.editAppName.value.trim() !== '' || currentUrls !== '' || currentEscalation !== '';
        }
        return DOMElements.editAppName.value.trim() !== initialAppData.name ||
                currentUrls !== initialAppData.urls ||
                currentEscalation !== initialAppData.escalation;
    };

    const updateSaveButtonState = () => {
        if(DOMElements.saveChangesBtn) DOMElements.saveChangesBtn.disabled = !checkFormDirty();
    };

    const initQuickList = () => {
        window.QuickListManager.init({
            container: DOMElements.shortcutsContainer,
            items: DataHelpers.getCollection(state, 'shortcuts'),
            emptyMessage: "No shortcuts. Add from 'Actions'.",
            getItemName: (item) => item.name,
            getItemHref: (item) => item.url,
            onDeleteClick: (item, renderCallback) => {
                UIPatterns.confirmDelete('Shortcut', item.name, () => {
                    const shortcuts = DataHelpers.getCollection(state, 'shortcuts');
                    const itemIndex = shortcuts.findIndex(s => s.id === item.id);
                    if (itemIndex > -1) {
                        shortcuts.splice(itemIndex, 1);
                        saveState();
                        renderCallback();
                    }
                });
            },
            addNewButtonId: 'add-shortcut-btn-menu',
            onAddNewClick: (renderCallback) => {
                SafeUI.showModal('Add Shortcut',
                    `<input type="text" id="shortcut-name" placeholder="Name" class="form-control">
                        <input type="text" id="shortcut-url" placeholder="URL" class="form-control">`,
                    [{ label: 'Cancel' }, {
                        label: 'Add', class: 'btn-primary', callback: () => {
                            const nameInput = document.getElementById('shortcut-name');
                            const urlInput = document.getElementById('shortcut-url');
                            const name = nameInput.value;
                            const url = urlInput.value;
                            if (SafeUI.validators.notEmpty(name) && SafeUI.validators.maxLength(name, 50) && SafeUI.validators.url(url)) {
                                DataHelpers.getCollection(state, 'shortcuts').push({ id: SafeUI.generateId(), name, url });
                                saveState();
                                renderCallback();
                            } else {
                                SafeUI.showToast('Invalid name or URL');
                                return false;
                            }
                        }
                    }]
                );
            }
        });
    };

    const renderAppDropdown = () => {
        const appSelect = DOMElements.appSelect;
        const selectedValue = appSelect.value;
        appSelect.innerHTML = '<option value="">-- Select an App --</option>';
        const sortedApps = [...DataHelpers.getCollection(state, 'apps')].sort((a,b) => a.name.localeCompare(b.name));
        sortedApps.forEach(app => { appSelect.add(new Option(app.name, app.id)); });

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
        if (!DataHelpers.hasItems(state, 'apps')) {
            DOMElements.appSelectGroup.classList.add('hidden');
            DOMElements.appEmptyState.classList.remove('hidden');
        } else {
            DOMElements.appSelectGroup.classList.remove('hidden');
            DOMElements.appEmptyState.classList.add('hidden');
            renderAppDropdown();
        }
    };

    const renderAllPageSpecific = () => {
        initQuickList();
        renderAppData();
    };

    const normalizeLineEndings = (text) => {
        if (!text) return '';
        return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    };

    const displayAppDetails = (appId) => {
        selectedAppId = appId;

        if (state.ui) {
            state.ui.selectedAppId = appId;
            saveState();
        }

        const isVisible = !!appId;

        DOMElements.editAppName.value = '';
        DOMElements.editAppUrls.value = '';
        DOMElements.editAppEscalation.value = '';
        DOMElements.editAppNameWrapper.classList.add('hidden');
        DOMElements.appDetailsContainer.classList.toggle('hidden', !isVisible);

        if (isVisible) {
            const app = DataHelpers.findById(state, 'apps', appId);
            if (!app) {
                console.error(`Failed to find app with ID: ${appId}`);
                DOMElements.appDetailsContainer.classList.add('hidden');
                selectedAppId = null;
                initialAppData = null;
                if (state.ui) {
                    state.ui.selectedAppId = null;
                    saveState();
                }
                return;
            }
            const urlsNormalized = normalizeLineEndings(app.urls);
            const escalationNormalized = normalizeLineEndings(app.escalation);

            initialAppData = { ...app, urls: urlsNormalized, escalation: escalationNormalized };
            DOMElements.editAppName.value = app.name;
            DOMElements.editAppUrls.value = urlsNormalized;
            DOMElements.editAppEscalation.value = escalationNormalized;
        } else {
            initialAppData = null;
        }

        const escalationTextarea = DOMElements.editAppEscalation;
        const isCollapsed = escalationTextarea.value.trim() === '';
        escalationTextarea.style.height = isCollapsed ? '40px' : 'auto';

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

    const setupSettingsModal = () => {
        const pageDataHtml = `
            <button id="modal-export-csv-btn" class="btn">Export Apps (CSV)</button>
            <button id="modal-import-csv-btn" class="btn">Import Apps (CSV)</button>
        `;

        const onModalOpen = () => {
            CsvManager.setupExport({
                exportBtn: document.getElementById('modal-export-csv-btn'),
                dataGetter: () => state.apps,
                headers: APP_CONFIG.APP_CSV_HEADERS,
                filename: `${APP_CONFIG.NAME}-export.csv`
            });

            CsvManager.setupImport({
                importBtn: document.getElementById('modal-import-csv-btn'),
                headers: APP_CONFIG.APP_CSV_HEADERS,
                onValidate: (row, index) => {
                    const entry = {
                        id: row.id || SafeUI.generateId(),
                        name: (row.name || '').trim(),
                        urls: (row.urls || '').trim(),
                        escalation: (row.escalation || '').trim()
                    };
                    if (!SafeUI.validators.notEmpty(entry.name)) return { error: `Row ${index + 2}: 'name' is required.` };
                    if (!SafeUI.validators.maxLength(entry.name, 100)) return { error: `Row ${index + 2}: 'name' must not exceed 100 characters.` };
                    if (DataValidator.hasDuplicate(state.apps, 'name', entry.name, row.id)) return { error: `Row ${index + 2}: App name "${entry.name}" already exists.` };
                    return { entry: entry };
                },
                onConfirm: (validatedData, importErrors) => {
                    const newEntries = [];
                    const updatedEntries = [];
                    const existingIds = new Set(state.apps.map(app => app.id));
                    validatedData.forEach(entry => {
                        if (existingIds.has(entry.id)) { updatedEntries.push(entry); } else { newEntries.push(entry); }
                    });
                    const errorList = importErrors.slice(0, 10).map(e => `<li>${SafeUI.escapeHTML(e)}</li>`).join('');
                    const moreErrors = importErrors.length > 10 ? `<li>... and ${importErrors.length - 10} more errors.</li>` : '';
                    let summaryHtml = `<p>Found <strong>${newEntries.length} new</strong> applications and <strong>${updatedEntries.length} applications to overwrite</strong>.</p>`;
                    if (importErrors.length > 0) {
                        summaryHtml += `<p>The following ${importErrors.length} rows had errors and were skipped:</p><ul style="font-size: 0.8rem; max-height: 150px; overflow-y: auto; text-align: left;">${errorList}${moreErrors}</ul>`;
                    }
                    summaryHtml += `<p>Apply changes? This is permanent.</p>`;
                    SafeUI.showModal("Confirm CSV Import", summaryHtml, [
                        { label: 'Cancel' },
                        {
                            label: 'Import and Overwrite',
                            class: 'btn-primary',
                            callback: () => {
                                let importedCount = 0;
                                newEntries.forEach(entry => {
                                    if (state.apps.some(app => app.id === entry.id)) { entry.id = SafeUI.generateId(); }
                                    state.apps.push(entry);
                                    importedCount++;
                                });
                                updatedEntries.forEach(entry => {
                                    const existingIndex = state.apps.findIndex(app => app.id === entry.id);
                                    if (existingIndex > -1) { state.apps[existingIndex] = entry; importedCount++; }
                                });
                                saveState();
                                renderAppData();
                                SafeUI.showToast(`Imported ${importedCount} applications.`);
                                SafeUI.hideModal();
                            }
                        }
                    ]);
                    return false;
                }
            });
        };

        const onRestore = (dataToRestore) => {
            console.warn('FULL RESTORE: Overwriting all localStorage data');
            try { localStorage.removeItem('dashboard_state_v5'); } catch (e) { console.error('Failed to clear localStorage:', e); }

            let regeneratedCount = 0;
            ['apps', 'notes', 'shortcuts'].forEach(key => {
                (dataToRestore[key] || []).forEach(item => {
                    if (item.id && item.id.length < 20) {
                        item.id = SafeUI.generateId();
                        regeneratedCount++;
                    }
                });
            });

            state.apps = dataToRestore.apps || [];
            state.notes = dataToRestore.notes || [];
            state.shortcuts = dataToRestore.shortcuts || [];

            state.ui = dataToRestore.ui || { selectedAppId: null };

            saveState();

            setTimeout(() => {
                const verification = localStorage.getItem('dashboard_state_v5');
                if (!verification) {
                    SafeUI.showModal('Restore Warning', '<p>Restore completed but verification failed. Please refresh the page.</p>', [{label: 'OK'}]);
                } else if (regeneratedCount > 0) {
                    SafeUI.showToast(`Restored and regenerated ${regeneratedCount} legacy IDs`);
                }
            }, 100);

            selectedAppId = null;
            displayAppDetails(null);
            renderAllPageSpecific();

            if (state.ui.selectedAppId) {
                DOMElements.appSelect.value = state.ui.selectedAppId;
                displayAppDetails(state.ui.selectedAppId);
            }
        };

        if (window.SharedSettingsModal) {
            window.SharedSettingsModal.init({
                buttonId: 'btn-settings',
                appName: APP_CONFIG.NAME,
                state: state,
                pageSpecificDataHtml: pageDataHtml,
                onModalOpen: onModalOpen,
                onRestoreCallback: onRestore,
                itemValidators: {
                    apps: APP_CONFIG.APP_CSV_HEADERS,
                    notes: ['id', 'title', 'content'],
                    shortcuts: ['id', 'name', 'url'],
                    ui: []
                }
            });
        } else {
            console.error("SharedSettingsModal not found.");
            DOMElements.btnSettings.disabled = true;
        }
    };

    const initDashboardPageSpecific = (ctx, appConfig) => {
        DOMElements = ctx.elements;
        state = ctx.state;
        APP_CONFIG = appConfig;
        const originalSaveState = ctx.saveState;
        saveState = () => { originalSaveState(); };

        DOMHelpers.setupTextareaAutoResize(DOMElements.editAppUrls);
        DOMHelpers.setupTextareaAutoResize(DOMElements.editAppEscalation);

        DOMElements.addShortcutBtnMenu.innerHTML = SafeUI.SVGIcons.plus;
        DOMElements.addNewAppBtnMenu.innerHTML = SafeUI.SVGIcons.plus + ' App';
        DOMElements.deleteAppBtn.innerHTML = SafeUI.SVGIcons.trash;

        initQuickList();

        window.addEventListener('beforeunload', (e) => {
            if (checkFormDirty()) { e.preventDefault(); e.returnValue = ''; }
        });

        DOMElements.appSelect.addEventListener('change', () => {
            if (checkFormDirty()) {
                UIPatterns.confirmUnsavedChanges(() => {
                    const appId = DOMElements.appSelect.value || null;
                    displayAppDetails(appId);
                });
                DOMElements.appSelect.value = selectedAppId;
                return;
            }
            const appId = DOMElements.appSelect.value || null;
            displayAppDetails(appId);
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

            const isNewApp = initialAppData.id === null;
            const nameChanged = !isNewApp && newName !== initialAppData.name;

            if ((isNewApp || nameChanged) && DataValidator.hasDuplicate(state.apps, 'name', newName, isNewApp ? null : selectedAppId)) {
                return SafeUI.showValidationError('Duplicate Name', 'An application with this name already exists.', 'edit-app-name');
            }

            const appData = {
                name: newName,
                urls: DOMElements.editAppUrls.value.trim(),
                escalation: DOMElements.editAppEscalation.value.trim()
            };

            if (isNewApp) {
                appData.id = SafeUI.generateId();
                DataHelpers.getCollection(state, 'apps').push(appData);
                SafeUI.showToast('Application created');
            } else {
                const app = DataHelpers.findById(state, 'apps', selectedAppId);
                if (app) {
                    app.name = appData.name;
                    app.urls = appData.urls;
                    app.escalation = appData.escalation;
                    SafeUI.showToast('Application updated');
                }
            }

            saveState();
            renderAppData();
            DOMElements.appSelect.value = appData.id || selectedAppId;
            displayAppDetails(appData.id || selectedAppId);
        });

        DOMElements.deleteAppBtn.addEventListener('click', () => {
            if (!selectedAppId) return;
            const app = DataHelpers.findById(state, 'apps', selectedAppId);
            if (!app) return;

            UIPatterns.confirmDelete('Application', app.name, () => {
                state.apps = state.apps.filter(a => a.id !== selectedAppId);
                saveState();
                selectedAppId = null;
                displayAppDetails(null);
                renderAppData();
            });
        });

        DOMElements.addNewAppBtnMenu.addEventListener('click', createNewAppForm);

        setupSettingsModal();
        renderAppData();

        let restoredApp = false;
        if (state.ui && state.ui.selectedAppId) {
            const appExists = DataHelpers.getCollection(state, 'apps').some(app => app.id === state.ui.selectedAppId);
            if (appExists) {
                DOMElements.appSelect.value = state.ui.selectedAppId;
                displayAppDetails(state.ui.selectedAppId);
                restoredApp = true;
            } else {
                state.ui.selectedAppId = null;
                saveState();
            }
        }

        setTimeout(() => {
            const notepadRestored = window.NotepadManager && window.NotepadManager.didRestore;
            if (restoredApp && !notepadRestored) {
                    SafeUI.showToast('Restored previous session');
            }
        }, 100);
    };

    (async () => {
        try {
            const APP_VERSION = '6.3.1';
            console.log(`[Dashboard] Initializing v${APP_VERSION}`);

            const LOCAL_STORAGE_KEY = 'dashboard_state_v5';
            const APP_CONFIG = {
                NAME: 'dashboard',
                APP_CSV_HEADERS: ['id', 'name', 'urls', 'escalation']
            };

            const defaultState = {
                apps: [],
                notes: [],
                shortcuts: [],
                ui: {
                    selectedAppId: null
                }
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
                    'btn-settings',
                    'notepad-header',
                    'note-select', 'notepad-editor', 'toast', 'new-note-btn', 'rename-note-btn', 'delete-note-btn'
                ]
            });

            if (!ctx) return;

            initDashboardPageSpecific(ctx, APP_CONFIG);

            if (typeof window.NotepadManager?.init === 'function') {
                window.NotepadManager.init(ctx);
            } else {
                console.error("NotepadManager.init not found.");
                const banner = document.getElementById('app-startup-error');
                if (banner) {
                    banner.innerHTML = `<strong>Application Failed to Load</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">The core Notepad module failed to load.</p>`;
                    banner.classList.remove('hidden');
                }
            }

        } catch (err) {
            console.error("Unhandled exception during initialization:", err);
            const banner = document.getElementById('app-startup-error');
            if (banner) {
                banner.innerHTML = `<strong>Application Error</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Unexpected error: ${err.message}</p>`;
                banner.classList.remove('hidden');
            }
        }
    })();
}
