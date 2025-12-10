// ============================================================================
// PAGE-SPECIFIC LOGIC: Lookup (lookup.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'lookup',
        VERSION: '2.3.1',
        DATA_KEY: 'lookup_v2_data',
        CSV_HEADERS: ['id', 'keyword', 'assignmentGroup', 'notes', 'phoneLogPath']
    };

    const TEXTAREA_MAX_HEIGHT = 200;

    // ============================================================================
    // INITIALIZATION ROUTINE
    // ============================================================================
    (async () => {
        try {
            if (typeof SafeUI === 'undefined' || !SafeUI.isReady || typeof DOMHelpers === 'undefined') {
                const banner = document.getElementById('app-startup-error');
                if (banner) {
                    banner.innerHTML = `<strong>Application Failed to Load</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Critical dependencies (SafeUI, DOMHelpers) missing.</p>`;
                    banner.classList.remove('hidden');
                }
                console.error("Critical dependencies missing (SafeUI, DOMHelpers).");
                return;
            }

            console.log(`[Lookup] Bypassing AppLifecycle.run, initializing v${APP_CONFIG.VERSION}`);

            const defaultState = {
                items: [],
                settings: {
                    customSearches: []
                },
                ui: {
                    searchTerm: '',
                    scrollTop: 0,
                    isEditMode: false
                }
            };

            const ctx = await AppLifecycle.initPage({
                storageKey: APP_CONFIG.DATA_KEY,
                defaultState: defaultState,
                version: APP_CONFIG.VERSION,
                requiredElements: [
                    'search-input', 'local-results',
                    'btn-add-new-entry', 'btn-settings', 'btn-edit-mode',
                    'toast', 'modal-overlay', 'modal-content',
                        'custom-search-section', 'custom-search-buttons',
                    'btn-clear-search'
                ]
            });

            if (!ctx) return;

            let { elements: DOMElements, state, saveState: originalSaveState } = ctx;

            try {
                if (state.settings.kbBaseUrl) {
                    console.warn("Migrating old kbBaseUrl to new customSearches format...");
                    if (state.settings.kbBaseUrl.includes('{query}')) {
                        state.settings.customSearches = [{
                            id: SafeUI.generateId(),
                            name: 'KB Search',
                            urlTemplate: state.settings.kbBaseUrl
                        }];
                    }
                    delete state.settings.kbBaseUrl;
                    originalSaveState();
                }
            } catch (err) {
                console.error("Migration failed:", err);
            }

            const saveState = () => {
                try { originalSaveState(); }
                catch (e) {
                    console.error("Failed to save state:", e);
                    SafeUI.showModal("Error", "<p>Failed to save data.</p>", [{label: 'OK'}]);
                }
            };

            const sortAndSaveState = () => {
                state.items.sort((a, b) => a.keyword.localeCompare(b.keyword));
                saveState();
            };

            let currentEditState = { id: null, type: null };
            let isEditMode = false;

            const focusAndScroll = (elementId) => {
                setTimeout(() => {
                    const el = document.getElementById(elementId);
                    if (el) {
                        el.focus();
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 0);
            };

            const clearEditStateAndRender = (message = null) => {
                currentEditState = { id: null, type: null };
                renderAll();
                if (message) SafeUI.showToast(message);
            };

            const createEntry = (partial = {}) => ({
                id: partial.id || SafeUI.generateId(),
                keyword: (partial.keyword || '').trim(),
                assignmentGroup: (partial.assignmentGroup || '').trim(),
                notes: (partial.notes || '').trim(),
                phoneLogPath: (partial.phoneLogPath || '').trim()
            });

            const validateEntry = (entry) => {
                const errors = [];
                if (!entry.keyword?.trim()) errors.push('Keyword is required');
                return { valid: errors.length === 0, errors };
            };

            const keywordUtils = {
                parse: (keywordString) => keywordString.split(',').map(k => k.trim()).filter(Boolean),
                merge: (keywordString1, keywordString2, caseSensitive = false) => {
                    const keywords1 = keywordUtils.parse(keywordString1);
                    const keywords2 = keywordUtils.parse(keywordString2);
                    if (caseSensitive) return [...new Set([...keywords1, ...keywords2])].join(', ');
                    const keywordMap = new Map();
                    [...keywords1, ...keywords2].forEach(kw => {
                        const key = kw.toLowerCase();
                        if (!keywordMap.has(key)) keywordMap.set(key, kw);
                    });
                    return Array.from(keywordMap.values()).join(', ');
                }
            };

            const validateSearchUrl = (url) => {
                if (!url) return { valid: false, message: 'URL Template cannot be empty.' };
                if (!/\{query\}/i.test(url)) return { valid: false, message: 'The URL must contain the {query} placeholder.' };
                try {
                    const testUrl = url.replace(/\{query\}/ig, 'test');
                    const urlObj = new URL(testUrl);
                    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                        return { valid: false, message: 'URL must use http:// or https:// protocol.' };
                    }
                } catch (e) {
                    return { valid: false, message: 'The URL format is invalid.' };
                }
                return { valid: true, message: '' };
            };

            const getEmptyMessage = (lowerTerm) => {
                if (isEditMode) return 'No entries in the database. Click "+ Create Entry".';
                return lowerTerm ? 'No local entries found.' : 'Search to see local results.';
            };

            const modalActions = {
                cancelAndConfirm: (label, callback, isDangerous = false) => [
                    { label: 'Cancel' },
                    { label, class: isDangerous ? 'btn-danger' : 'btn-primary', callback }
                ],
                cancelAndMultiple: (actions) => [ { label: 'Cancel' }, ...actions ]
            };

            const getFormValues = (form, id) => {
                const fields = ['keyword', 'group', 'notes', 'path'];
                return fields.reduce((values, field) => {
                    const key = (field === 'group') ? 'assignmentGroup' : (field === 'path' ? 'phoneLogPath' : field);
                    const element = form.querySelector(`#edit-${field}-${id}`);
                    values[key] = element ? element.value.trim() : '';
                    return values;
                }, {});
            };

            const renderLocalList = (searchTerm = '') => {
                let itemsToRender = [];
                const lowerTerm = searchTerm.toLowerCase().trim();

                itemsToRender = isEditMode ? [...state.items] : [];

                if (lowerTerm && !isEditMode) {
                    const sourceItems = state.items;
                    itemsToRender = SearchHelper.simpleSearch(sourceItems, lowerTerm, ['keyword', 'assignmentGroup', 'phoneLogPath']);
                }

                if (currentEditState.id) {
                    const isItemVisible = itemsToRender.some(item => item.id === currentEditState.id);
                    if (!isItemVisible) {
                        const itemInState = state.items.find(item => item.id === currentEditState.id);
                        if (itemInState) itemsToRender.unshift(itemInState);
                    }
                }

                DOMElements.btnAddNewEntry.classList.toggle('hidden', isEditMode || itemsToRender.length > 0 || !lowerTerm);

                ListRenderer.renderList({
                    container: DOMElements.localResults,
                    items: itemsToRender,
                    emptyMessage: getEmptyMessage(lowerTerm),
                    createItemElement: (item) => {
                        if (isEditMode || (currentEditState.id === item.id)) {
                            return createEditForm(item);
                        }
                        return createItemElement(item, searchTerm);
                    }
                });
            };

            const renderCustomSearches = (term) => {
                const container = DOMElements.customSearchButtons;
                const searches = state.settings.customSearches || [];

                if (searches.length === 0) {
                    DOMElements.customSearchSection.classList.add('hidden');
                    return;
                }

                DOMElements.customSearchSection.classList.remove('hidden');
                container.innerHTML = '';
                const fragment = document.createDocumentFragment();

                searches.forEach(search => {
                    const button = document.createElement('a');
                    button.className = 'btn btn-primary btn-full-width-padded';
                    button.target = '_blank';
                    button.rel = 'noopener noreferrer';

                    const escapedName = SafeUI.escapeHTML(search.name);

                    if (!term) {
                        button.textContent = `Search ${escapedName} (enter a term first)`;
                        button.classList.add('button-disabled-link');
                        button.removeAttribute('href');
                    } else {
                        const validation = validateSearchUrl(search.urlTemplate);
                        if (!validation.valid) {
                            button.textContent = `Search ${escapedName} (URL is invalid)`;
                            button.classList.add('button-disabled-link');
                            button.removeAttribute('href');
                        } else {
                            const finalUrl = search.urlTemplate.replace(/\{query\}/ig, encodeURIComponent(term));
                            button.textContent = `Search "${SafeUI.escapeHTML(term)}" in ${escapedName}`;
                            button.classList.remove('button-disabled-link');
                            button.href = finalUrl;
                        }
                    }
                    fragment.appendChild(button);
                });
                container.appendChild(fragment);
            };

            const renderAll = () => {
                const searchTerm = DOMElements.searchInput.value.trim();
                if (isEditMode) {
                    DOMElements.btnAddNewEntry.classList.remove('hidden');
                }
                renderLocalList(searchTerm);
                renderCustomSearches(searchTerm);

                DOMElements.btnClearSearch.classList.toggle('hidden', searchTerm.length === 0);
            };

            function createItemElement(item, searchTerm) {
                const li = document.createElement('li');
                li.className = 'result-item';
                li.dataset.id = item.id;

                const createDataRow = (label, value, highlightTerm) => {
                    if (!value) return '';
                    const highlightedValue = highlightTerm ? UIPatterns.highlightSearchTerm(value, highlightTerm) : SafeUI.escapeHTML(value);
                    return `
                        <div class="item-row">
                            <strong>${label}:</strong>
                            <div class="item-value">
                                <span>${highlightedValue}</span>
                                <button class="btn-copy btn-icon" title="Copy ${label}" data-copy="${SafeUI.escapeHTML(value)}">
                                    ${SafeUI.SVGIcons.copy}
                                </button>
                            </div>
                        </div>
                    `;
                };

                const createNotesRow = (notes) => {
                    if (!notes) return '';
                    return `
                        <div class="item-row-notes">
                            <strong>Notes:</strong>
                            <span class="item-notes-text">${SafeUI.escapeHTML(notes)}</span>
                        </div>
                    `;
                };

                li.innerHTML = `
                    <div class="item-header">
                        <span class="item-keyword">${UIPatterns.highlightSearchTerm(item.keyword, searchTerm)}</span>
                        <div class="item-actions">
                            <button class="btn-edit btn-icon" title="Edit">${SafeUI.SVGIcons.pencil}</button>
                            <button class="btn-delete btn-icon" title="Delete">${SafeUI.SVGIcons.trash}</button>
                        </div>
                    </div>
                    <div class="item-content">
                        ${createDataRow('Group', item.assignmentGroup, searchTerm)}
                        ${createDataRow('Path', item.phoneLogPath, searchTerm)}
                        ${createNotesRow(item.notes)}
                    </div>
                `;
                return li;
            }

            function createEditForm(item) {
                const li = document.createElement('li');
                li.className = 'edit-form-li';

                const form = document.createElement('form');
                form.className = 'edit-form';
                form.dataset.id = item.id;

                form.innerHTML = `
                    <div class="form-grid">
                        <label for="edit-keyword-${item.id}">Keyword(s)</label>
                        <input type="text" id="edit-keyword-${item.id}" class="form-control" value="${SafeUI.escapeHTML(item.keyword)}" placeholder="Comma-separated keywords">

                        <label for="edit-group-${item.id}">Assignment Group</label>
                        <input type="text" id="edit-group-${item.id}" class="form-control" value="${SafeUI.escapeHTML(item.assignmentGroup)}" placeholder="Group name">

                        <label for="edit-notes-${item.id}">Notes</label>
                        <textarea id="edit-notes-${item.id}" class="form-control sidebar-textarea" placeholder="Procedural notes...">${SafeUI.escapeHTML(item.notes)}</textarea>

                        <label for="edit-path-${item.id}">Phone Log Path</label>
                        <input type="text" id="edit-path-${item.id}" class="form-control" value="${SafeUI.escapeHTML(item.phoneLogPath)}" placeholder="Cat > SubCat > Item">
                    </div>
                    <div class="edit-form-actions">
                        <button type="button" class="btn-delete btn btn-danger">Delete</button>
                        <button type="button" class="btn-cancel btn">Cancel</button>
                        <button type="submit" class="btn-save btn btn-primary">Save</button>
                    </div>
                `;

                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    handleSave(form, item.id);
                });

                form.querySelector('.btn-delete').addEventListener('click', () => {
                    UIPatterns.confirmDelete('Entry', item.keyword || 'New Entry', () => handleDelete(item.id));
                });

                form.querySelector('.btn-cancel').addEventListener('click', () => {
                    if (!item.keyword.trim()) {
                        handleDelete(item.id, true);
                    }
                    clearEditStateAndRender();
                });

                setTimeout(() => {
                    const notesTextarea = form.querySelector(`#edit-notes-${item.id}`);
                    if (notesTextarea) {
                        DOMHelpers.setupTextareaAutoResize(notesTextarea, TEXTAREA_MAX_HEIGHT);
                    }
                }, 0);

                li.appendChild(form);
                return li;
            }

            function handleAddNewEntry() {
                if (currentEditState.id) {
                    SafeUI.showToast("Please save or cancel your current edit first.");
                    return;
                }

                const searchTerm = DOMElements.searchInput.value.trim();
                const newItem = createEntry({ keyword: searchTerm });
                state.items.unshift(newItem);

                currentEditState = { id: newItem.id, type: 'local' };
                DOMElements.searchInput.value = '';
                if(state.ui) {
                    state.ui.searchTerm = '';
                    saveState();
                }

                clearEditStateAndRender();
                focusAndScroll(`edit-keyword-${newItem.id}`);
            }

            function handleEdit(id) {
                if (currentEditState.id && currentEditState.id !== id) {
                    SafeUI.showToast("Please save or cancel your current edit first.");
                    return;
                }
                currentEditState = { id: id, type: 'local' };
                renderAll();
                focusAndScroll(`edit-keyword-${id}`);
            }

            function handleSave(form, id) {
                const { keyword, assignmentGroup, notes, phoneLogPath } = getFormValues(form, id);

                const validation = validateEntry({ keyword, assignmentGroup });
                if (!validation.valid) {
                    const errorField = validation.errors[0].includes('Keyword') ? `edit-keyword-${id}` : `edit-group-${id}`;
                    return SafeUI.showValidationError("Invalid Input", validation.errors.join('. '), errorField);
                }

                const existingEntry = (assignmentGroup && state.items.find(item =>
                    item.assignmentGroup.toLowerCase() === assignmentGroup.toLowerCase() &&
                    item.id !== id
                ));

                const saveAction = () => {
                    let itemToUpdate = state.items.find(item => item.id === id);
                    if (!itemToUpdate) {
                        itemToUpdate = createEntry({ id });
                        state.items.push(itemToUpdate);
                    }
                    Object.assign(itemToUpdate, { keyword, assignmentGroup, notes, phoneLogPath });

                    sortAndSaveState();
                    clearEditStateAndRender("Entry saved.");
                };

                if (existingEntry) {
                    SafeUI.showModal("Duplicate Group",
                        `<p>An entry for "<strong>${SafeUI.escapeHTML(existingEntry.assignmentGroup)}</strong>" already exists with keyword(s) "<strong>${SafeUI.escapeHTML(existingEntry.keyword)}</strong>".</p>`,
                        modalActions.cancelAndMultiple([
                            { label: 'Continue (Create New)', class: 'btn-danger', callback: saveAction },
                            {
                                label: 'Merge Keywords',
                                class: 'btn-primary',
                                callback: () => {
                                    existingEntry.keyword = keywordUtils.merge(existingEntry.keyword, keyword);
                                    handleDelete(id, true);
                                    sortAndSaveState();
                                    clearEditStateAndRender("Keywords merged.");
                                }
                            }
                        ])
                    );
                } else {
                    saveAction();
                }
            }

            function handleDelete(id, skipConfirm = false) {
                if (currentEditState.id === id) currentEditState = { id: null, type: null };

                const index = state.items.findIndex(i => i.id === id);
                if (index === -1) return;

                const doDelete = () => {
                    state.items.splice(index, 1);
                    sortAndSaveState();
                    clearEditStateAndRender(skipConfirm ? null : "Entry deleted.");
                };

                if (skipConfirm) doDelete();
                else UIPatterns.confirmDelete('Entry', state.items[index].keyword || 'New Entry', doDelete);
            }

            function validateCsvRow(row, index) {
                const entry = createEntry(row);
                const validation = validateEntry(entry);
                if (!validation.valid) return { error: `Row ${index + 2}: ${validation.errors.join(', ')}` };

                const contentKey = `${entry.keyword.toLowerCase()}|${entry.assignmentGroup.toLowerCase()}`;
                if (entry.id && state.items.some(item => item.id === entry.id)) return { action: 'overwrite', entry: entry };
                if (state.items.some(item => `${item.keyword.toLowerCase()}|${item.assignmentGroup.toLowerCase()}` === contentKey)) {
                    return { error: `Row ${index + 2}: A identical entry (Keyword + Group) already exists. Row skipped.` };
                }
                return { action: 'add', entry: entry };
            }

            function confirmCsvImport(validatedData, importErrors) {
                const actions = validatedData.map(item => {
                    const existingItem = state.items.find(i => i.id === item.id);
                    return { action: existingItem ? 'overwrite' : 'add', item: item };
                });

                const toAdd = actions.filter(a => a.action === 'add').length;
                const toOverwrite = actions.filter(a => a.action === 'overwrite').length;

                const errorList = importErrors.slice(0, 10).map(e => `<li>${SafeUI.escapeHTML(e)}</li>`).join('');
                const moreErrors = importErrors.length > 10 ? `<li>... and ${importErrors.length - 10} more errors.</li>` : '';

                let summaryHtml = `<p>CSV file processed:</p>
                    <ul style="text-align: left; margin: 0.5rem 0 1rem 1.5rem;">
                        <li><strong>${toAdd}</strong> new entries will be added.</li>
                        <li><strong>${toOverwrite}</strong> existing entries will be overwritten (matched by ID).</li>
                    </ul>`;

                if (importErrors.length > 0) {
                    summaryHtml += `<p><strong>${importErrors.length} rows had errors and were skipped:</strong></p>
                            <ul style="font-size: 0.8rem; max-height: 150px; overflow-y: auto; text-align: left;">
                                ${errorList}${moreErrors}
                            </ul>`;
                }
                summaryHtml += `<p>This cannot be undone.</p>`;

                SafeUI.showModal("Confirm Import", summaryHtml,
                    modalActions.cancelAndConfirm('Import Data', () => {
                        actions.forEach(action => {
                            if (action.action === 'add') state.items.push(action.item);
                            else if (action.action === 'overwrite') {
                                const index = state.items.findIndex(i => i.id === action.item.id);
                                if (index > -1) state.items[index] = action.item;
                                else state.items.push(action.item);
                            }
                        });
                        sortAndSaveState();
                        renderAll();
                        SafeUI.showToast(`Imported ${toAdd + toOverwrite} entries.`);
                        SafeUI.hideModal();
                    }, true)
                );
                return false;
            }

            function setupSettingsModal() {
                const getSettingsHtml = () => {
                    let searchesHtml = state.settings.customSearches.map(search => `
                        <div class="custom-search-item" data-id="${search.id}">
                            <input type="text" class="form-control search-name" value="${SafeUI.escapeHTML(search.name)}" placeholder="Search Name">
                            <input type="text" class="form-control search-url" value="${SafeUI.escapeHTML(search.urlTemplate)}" placeholder="https://my-kb.com/search?q={query}">
                            <button type="button" class="btn-icon delete-search-btn" title="Delete Search">${SafeUI.SVGIcons.trash}</button>
                        </div>
                    `).join('');

                    if (searchesHtml.length === 0) {
                        searchesHtml = '<p class="form-help" style="text-align: center; margin: 0.5rem 0;">No custom searches added yet.</p>';
                    }

                    return `
                        <div class="form-group">
                            <label>Custom Search Engines</label>
                            <p class="form-help">Add links to external sites. Use <strong>{query}</strong> as a placeholder for the search term.</p>
                            <div id="custom-search-list">${searchesHtml}</div>
                            <button type="button" id="btn-add-search" class="btn" style="margin-top: 0.5rem;">+ Add Search</button>
                        </div>
                    `;
                };

                const pageDataHtml = `
                    <button id="modal-export-csv-btn" class="btn">Export DB (CSV)</button>
                    <button id="modal-import-csv-btn" class="btn">Import DB (CSV)</button>
                `;

                const onSave = () => {
                    const searchItems = document.querySelectorAll('#custom-search-list .custom-search-item');
                    const newCustomSearches = [];
                    let validationFailed = false;

                    searchItems.forEach(item => {
                        const nameInput = item.querySelector('.search-name');
                        const urlInput = item.querySelector('.search-url');
                        const name = nameInput.value.trim();
                        const urlTemplate = urlInput.value.trim();

                        if (!name) {
                            SafeUI.showValidationError("Invalid Name", "Search Name cannot be empty.", nameInput.id);
                            validationFailed = true;
                            return;
                        }

                        const validation = validateSearchUrl(urlTemplate);
                        if (!validation.valid) {
                            SafeUI.showValidationError("Invalid URL", validation.message, urlInput.id);
                            validationFailed = true;
                            return;
                        }

                        newCustomSearches.push({
                            id: item.dataset.id,
                            name: name,
                            urlTemplate: urlTemplate
                        });
                    });

                    if (validationFailed) return false;

                    state.settings.customSearches = newCustomSearches;
                    saveState();
                    SafeUI.showToast("Settings saved.");
                    renderAll();
                    return true;
                };

                const onModalOpen = () => {
                    const listContainer = document.getElementById('custom-search-list');

                    document.getElementById('btn-add-search').addEventListener('click', () => {
                        const newId = SafeUI.generateId();
                        const newItem = document.createElement('div');
                        newItem.className = 'custom-search-item';
                        newItem.dataset.id = newId;
                        newItem.innerHTML = `
                            <input type="text" id="search-name-${newId}" class="form-control search-name" value="" placeholder="Search Name">
                            <input type="text" id="search-url-${newId}" class="form-control search-url" value="" placeholder="https://my-kb.com/search?q={query}">
                            <button type="button" class="btn-icon delete-search-btn" title="Delete Search">${SafeUI.SVGIcons.trash}</button>
                        `;
                        const emptyMsg = listContainer.querySelector('p');
                        if (emptyMsg) emptyMsg.remove();
                        listContainer.appendChild(newItem);
                        document.getElementById(`search-name-${newId}`).focus();
                    });

                    listContainer.addEventListener('click', (e) => {
                        const deleteBtn = e.target.closest('.delete-search-btn');
                        if (deleteBtn) {
                            deleteBtn.closest('.custom-search-item').remove();
                            if (listContainer.children.length === 0) {
                                listContainer.innerHTML = '<p class="form-help" style="text-align: center; margin: 0.5rem 0;">No custom searches added yet.</p>';
                            }
                        }
                    });

                    CsvManager.setupExport({
                        exportBtn: document.getElementById('modal-export-csv-btn'),
                        headers: APP_CONFIG.CSV_HEADERS,
                        dataGetter: () => state.items,
                        filename: 'lookup-export.csv'
                    });

                    CsvManager.setupImport({
                        importBtn: document.getElementById('modal-import-csv-btn'),
                        headers: APP_CONFIG.CSV_HEADERS,
                        onValidate: validateCsvRow,
                        onConfirm: (validatedData, importErrors) => confirmCsvImport(validatedData, importErrors)
                    });
                };

                const onRestore = (dataToRestore) => {
                    state.items = dataToRestore.items || [];
                    if (dataToRestore.settings?.kbBaseUrl) {
                        state.settings.customSearches = [{
                            id: SafeUI.generateId(),
                            name: 'KB Search (Restored)',
                            urlTemplate: dataToRestore.settings.kbBaseUrl
                        }];
                    } else {
                        state.settings = dataToRestore.settings || { customSearches: [] };
                    }

                    if (dataToRestore.ui) {
                        state.ui = dataToRestore.ui;
                    } else {
                        state.ui = { searchTerm: '', scrollTop: 0, isEditMode: false };
                    }

                    sortAndSaveState();
                    renderAll();

                    isEditMode = state.ui.isEditMode || false;
                    DOMElements.btnEditMode.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';
                    DOMElements.btnEditMode.classList.toggle('btn-primary', isEditMode);

                    SafeUI.hideModal();
                    SafeUI.showToast('Restored previous session');
                };

                window.SharedSettingsModal.init({
                    buttonId: 'btn-settings',
                    appName: APP_CONFIG.NAME,
                    state: state,
                    customSettingsHtml: getSettingsHtml(),
                    pageSpecificDataHtml: pageDataHtml,
                    onModalOpen: onModalOpen,
                    onModalSave: onSave,
                    onRestoreCallback: onRestore,
                    itemValidators: {
                        items: APP_CONFIG.CSV_HEADERS,
                        settings: []
                    }
                });
            }

            function attachEventListeners() {
                const debouncedSearchSave = SafeUI.debounce(() => {
                    if (state.ui) {
                        state.ui.searchTerm = DOMElements.searchInput.value.trim();
                        saveState();
                    }
                }, 300);

                DOMElements.searchInput.addEventListener('input', () => {
                    renderAll();
                    debouncedSearchSave();
                });

                DOMElements.btnAddNewEntry.addEventListener('click', handleAddNewEntry);

                setupSettingsModal();

                DOMElements.btnEditMode.addEventListener('click', () => {
                    if (currentEditState.id) {
                        const form = document.querySelector('.edit-form-li form');
                        if (form) {
                            const item = state.items.find(i => i.id === currentEditState.id);
                            if (item) {
                                const { keyword, assignmentGroup, notes, phoneLogPath } = getFormValues(form, currentEditState.id);
                                const hasChanges =
                                    keyword !== item.keyword ||
                                    assignmentGroup !== item.assignmentGroup ||
                                    notes !== item.notes ||
                                    phoneLogPath !== item.phoneLogPath;

                                if (hasChanges) {
                                    UIPatterns.confirmUnsavedChanges(() => toggleEditMode());
                                    return;
                                }
                            }
                        }
                    }
                    toggleEditMode();
                });

                DOMElements.localResults.addEventListener('click', async (e) => {
                    const editBtn = e.target.closest('.btn-edit');
                    if (editBtn) {
                        handleEdit(e.target.closest('.result-item').dataset.id);
                        return;
                    }
                    const deleteBtn = e.target.closest('.btn-delete');
                    if (deleteBtn) {
                        handleDelete(e.target.closest('.result-item').dataset.id, false);
                        return;
                    }
                    const copyBtn = e.target.closest('.btn-copy');
                    if (copyBtn) {
                        const success = await SafeUI.copyToClipboard(copyBtn.dataset.copy);
                        SafeUI.showToast(success ? "Copied to clipboard!" : "Failed to copy.");
                        return;
                    }
                });

                DOMElements.btnClearSearch.addEventListener('click', () => {
                    DOMElements.searchInput.value = '';
                    if (state.ui) {
                        state.ui.searchTerm = '';
                        saveState();
                    }
                    renderAll();
                });

                DOMElements.localResults.addEventListener('scroll', SafeUI.debounce(() => {
                    if (state.ui) {
                        state.ui.scrollTop = DOMElements.localResults.scrollTop;
                        saveState();
                    }
                }, 500));

                const scrollToTopBtn = document.getElementById('scroll-to-top');
                if (scrollToTopBtn) {
                    DOMElements.localResults.addEventListener('scroll', SafeUI.debounce(() => {
                        scrollToTopBtn.classList.toggle('visible', DOMElements.localResults.scrollTop > 300);
                    }, 200));
                    scrollToTopBtn.addEventListener('click', () => {
                        DOMElements.localResults.scrollTo({ top: 0, behavior: 'smooth' });
                    });
                }
            }

            function toggleEditMode() {
                isEditMode = !isEditMode;

                if (state.ui) {
                    state.ui.isEditMode = isEditMode;
                    saveState();
                }

                DOMElements.btnEditMode.textContent = isEditMode ? 'Exit Edit Mode' : 'Edit Mode';
                DOMElements.btnEditMode.classList.toggle('btn-primary', isEditMode);
                clearEditStateAndRender();
            }

            function init() {
                attachEventListeners();

                if (state.ui) {
                    if (state.ui.searchTerm) {
                        DOMElements.searchInput.value = state.ui.searchTerm;
                        SafeUI.showToast('Restored previous search');
                    }

                    if (state.ui.isEditMode) {
                        isEditMode = true;
                        DOMElements.btnEditMode.textContent = 'Exit Edit Mode';
                        DOMElements.btnEditMode.classList.add('btn-primary');
                    }

                    renderAll();

                    if (state.ui.scrollTop) {
                        setTimeout(() => {
                            DOMElements.localResults.scrollTop = state.ui.scrollTop;
                        }, 0);
                    }
                } else {
                    renderAll();
                }
            }

            init();
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
