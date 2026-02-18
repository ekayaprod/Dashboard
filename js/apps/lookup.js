// ============================================================================
// PAGE-SPECIFIC LOGIC: Lookup (lookup.html)
// ============================================================================

const LookupHelpers = {
    /**
     * Creates a new lookup entry object with default values.
     * @param {Object} partial - Partial entry object to merge with defaults.
     * @returns {Object} A complete lookup entry object.
     */
    createEntry: (partial = {}) => ({
        id: partial.id || SafeUI.generateId(),
        keyword: (partial.keyword || '').trim(),
        assignmentGroup: (partial.assignmentGroup || '').trim(),
        notes: (partial.notes || '').trim(),
        phoneLogPath: (partial.phoneLogPath || '').trim()
    }),

    /**
     * Validates a lookup entry.
     * @param {Object} entry - The entry to validate.
     * @returns {{valid: boolean, errors: string[]}} Validation result.
     */
    validateEntry: (entry) => {
        const errors = [];
        if (!entry.keyword?.trim()) errors.push('Keyword required');
        return { valid: errors.length === 0, errors };
    },

    keywordUtils: {
        /**
         * Parses a comma-separated keyword string into an array.
         * @param {string} keywordString
         * @returns {string[]} Array of keywords.
         */
        parse: (keywordString) => keywordString.split(',').map(k => k.trim()).filter(Boolean),

        /**
         * Merges two keyword strings, removing duplicates.
         * @param {string} keywordString1
         * @param {string} keywordString2
         * @param {boolean} [caseSensitive=false]
         * @returns {string} Merged comma-separated string.
         */
        merge: (keywordString1, keywordString2, caseSensitive = false) => {
            const keywords1 = LookupHelpers.keywordUtils.parse(keywordString1);
            const keywords2 = LookupHelpers.keywordUtils.parse(keywordString2);
            if (caseSensitive) return [...new Set([...keywords1, ...keywords2])].join(', ');
            const keywordMap = new Map();
            [...keywords1, ...keywords2].forEach(kw => {
                const key = kw.toLowerCase();
                if (!keywordMap.has(key)) keywordMap.set(key, kw);
            });
            return Array.from(keywordMap.values()).join(', ');
        }
    },

    /**
     * Validates a custom search URL template.
     * @param {string} url - The URL template containing {query}.
     * @returns {{valid: boolean, message: string}} Validation result.
     */
    validateSearchUrl: (url) => {
        if (!url) return { valid: false, message: 'URL required' };
        if (!/\{query\}/i.test(url)) return { valid: false, message: 'Must contain {query}' };
        try {
            const testUrl = url.replace(/\{query\}/ig, 'test');
            const urlObj = new URL(testUrl);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return { valid: false, message: 'Must use http:// or https://' };
            }
        } catch (e) {
            return { valid: false, message: 'The URL format is invalid.' };
        }
        return { valid: true, message: '' };
    }
};

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'lookup',
        VERSION: '2.3.1',
        DATA_KEY: 'lookup_v2_data',
        CSV_HEADERS: ['id', 'keyword', 'assignmentGroup', 'notes', 'phoneLogPath']
    };

    const TEXTAREA_MAX_HEIGHT = 200;
    const SEARCH_FIELDS = ['keyword', 'assignmentGroup', 'phoneLogPath'];

    const ANIMATION_DURATION_MS = 300;
    const SCROLL_DEBOUNCE_DELAY_MS = 500;
    const RENDER_DEBOUNCE_DELAY_MS = 150;
    const SCROLL_TOP_VISIBILITY_THRESHOLD = 300;
    const ANIMATION_DELAY_INCREMENT_S = 0.05;
    const SENTINEL_ROOT_MARGIN = '200px';
    const MAX_IMPORT_ERRORS_DISPLAY = 10;
    const MAX_ANIMATED_ITEMS = 10;

    // ============================================================================
    // INITIALIZATION ROUTINE
    // ============================================================================
    (async () => {
        try {
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
                    'btn-clear-search', 'search-spinner', 'results-status'
                ]
            });

            if (!ctx) return;

            let { elements: DOMElements, state, saveState: originalSaveState } = ctx;

            // Initialize Search Index
            if (state.items && state.items.length > 0) {
                 SearchHelper.createIndex(state.items, SEARCH_FIELDS);
            }

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

            const BATCH_SIZE = 50;
            let currentEditState = { id: null, type: null };
            let isEditMode = false;
            let currentMatches = [];
            let renderedCount = 0;
            let loadingSentinel = null;
            let loadingObserver = null;
            let currentSearchId = 0;

            const setLoading = (isLoading) => {
                if (DOMElements.searchSpinner) {
                    DOMElements.searchSpinner.classList.toggle('hidden', !isLoading);
                }
                if (DOMElements.localResults) {
                    DOMElements.localResults.setAttribute('aria-busy', isLoading ? 'true' : 'false');
                    if (isLoading) {
                         DOMElements.localResults.classList.add('results-fading');
                    } else {
                         DOMElements.localResults.classList.remove('results-fading');
                    }
                }
            };

            const updateResultsStatus = (matches, rendered) => {
                if (!DOMElements.resultsStatus) return;

                if (matches === 0) {
                    DOMElements.resultsStatus.textContent = '';
                    return;
                }

                const showingText = rendered >= matches ?
                    `Showing all ${matches} results` :
                    `Showing ${rendered} of ${matches} results`;

                DOMElements.resultsStatus.textContent = showingText;
            };

            const setupObserver = () => {
                loadingSentinel = document.createElement('div');
                loadingSentinel.id = 'loading-sentinel';
                loadingSentinel.style.height = '20px';
                loadingSentinel.style.marginTop = '10px';

                loadingObserver = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        if (renderedCount < currentMatches.length) {
                            renderBatch(true);
                        }
                    }
                }, { root: null, rootMargin: SENTINEL_ROOT_MARGIN });
            };

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


            const getEmptyMessage = (lowerTerm) => {
                if (isEditMode) return 'No entries. Create?';

                if (lowerTerm) {
                    const escapedTerm = SafeUI.escapeHTML(lowerTerm);
                    return `
                        <div class="empty-search-state" style="text-align: center; padding: 2rem 1rem;">
                            <div style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.5;">🔍</div>
                            <h3 style="margin: 0 0 1rem 0; font-weight: 500;">No matches for "${escapedTerm}"</h3>
                            <button class="btn btn-primary" data-action="create-from-search">
                                Create "${escapedTerm}"
                            </button>
                        </div>
                    `;
                }

                return `
                    <div style="text-align: center; padding: 2rem 1rem; opacity: 0.7;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⌨️</div>
                        <p style="margin: 0;">Type to search...</p>
                    </div>
                `;
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

            const renderBatch = (append = false) => {
                const start = append ? renderedCount : 0;
                const end = Math.min(start + BATCH_SIZE, currentMatches.length);
                const batch = currentMatches.slice(start, end);
                const searchTerm = DOMElements.searchInput.value.trim();

                if (batch.length === 0 && !append && currentMatches.length > 0) return;

                // Add fade-in animation to appended items
                const createAnimatedItemElement = (item, index) => {
                     const el = (isEditMode || (currentEditState.id === item.id)) ?
                        createEditForm(item) :
                        createItemElement(item, searchTerm);

                     if (append) el.classList.add('fade-in');

                     // Artisan: Staggered animation for initial load
                     if (!append && index < MAX_ANIMATED_ITEMS) {
                         el.classList.add('fade-in');
                         el.style.animationDelay = `${index * ANIMATION_DELAY_INCREMENT_S}s`;
                     }
                     return el;
                };

                ListRenderer.renderList({
                    container: DOMElements.localResults,
                    items: batch,
                    emptyMessage: getEmptyMessage(searchTerm.toLowerCase()),
                    createItemElement: createAnimatedItemElement,
                    append: append
                });

                renderedCount = end;
                updateResultsStatus(currentMatches.length, renderedCount);

                if (loadingSentinel) {
                    // Remove if exists to re-append at end
                    if (loadingSentinel.parentNode) loadingSentinel.parentNode.removeChild(loadingSentinel);

                    if (renderedCount < currentMatches.length) {
                        DOMElements.localResults.appendChild(loadingSentinel);
                        loadingObserver.observe(loadingSentinel);
                    } else {
                        loadingObserver.unobserve(loadingSentinel);
                    }
                }
            };

            const renderLocalList = async (searchTerm = '', searchId) => {
                let itemsToRender = [];
                const lowerTerm = searchTerm.toLowerCase().trim();

                itemsToRender = isEditMode ? [...state.items] : [];

                if (lowerTerm && !isEditMode) {
                    const sourceItems = state.items;
                    // Bolt: Async Optimized Search
                    itemsToRender = await SearchHelper.searchIndexAsync(sourceItems, lowerTerm);

                    // Race condition check: if a new search started, abort
                    if (searchId !== currentSearchId) return;
                }

                if (currentEditState.id) {
                    const isItemVisible = itemsToRender.some(item => item.id === currentEditState.id);
                    if (!isItemVisible) {
                        const itemInState = state.items.find(item => item.id === currentEditState.id);
                        if (itemInState) itemsToRender.unshift(itemInState);
                    }
                }

                DOMElements.btnAddNewEntry.classList.toggle('hidden', isEditMode || itemsToRender.length > 0 || !lowerTerm);

                // Reset state for new search
                currentMatches = itemsToRender;
                renderedCount = 0;

                renderBatch(false);
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
                        const validation = LookupHelpers.validateSearchUrl(search.urlTemplate);
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

                // Ensure observer is setup
                if (!loadingObserver) setupObserver();

                // Increment search ID to invalidate previous searches
                const mySearchId = ++currentSearchId;

                // Artisan: Performance optimization (Bolt+)
                // Wrap heavy rendering in requestAnimationFrame to allow UI (spinner) to update first.
                requestAnimationFrame(() => {
                    requestAnimationFrame(async () => {
                        // Ensure loading state is visible during async search
                        setLoading(true);

                        await renderLocalList(searchTerm, mySearchId);

                        // Check if we are still the active search
                        if (mySearchId === currentSearchId) {
                            renderCustomSearches(searchTerm);
                            DOMElements.btnClearSearch.classList.toggle('hidden', searchTerm.length === 0);

                            // Hide spinner after render is done
                            setLoading(false);
                        }
                    });
                });
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
                                <button class="btn-copy btn-icon" title="Copy ${label}" aria-label="Copy ${label}" data-copy="${SafeUI.escapeHTML(value)}">
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
                            <button class="btn-edit btn-icon" title="Edit" aria-label="Edit Entry">${SafeUI.SVGIcons.pencil}</button>
                            <button class="btn-delete btn-icon" title="Delete" aria-label="Delete Entry">${SafeUI.SVGIcons.trash}</button>
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
                const newItem = LookupHelpers.createEntry({ keyword: searchTerm });

                // Bolt: Update Index for new item
                SearchHelper.createIndex([newItem], SEARCH_FIELDS);

                state.items.unshift(newItem);

                currentEditState = { id: newItem.id, type: 'local' };
                DOMElements.searchInput.value = '';
                if(state.ui) {
                    state.ui.searchTerm = '';
                    saveState();
                }

                renderAll();
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

                const validation = LookupHelpers.validateEntry({ keyword, assignmentGroup });
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
                        itemToUpdate = LookupHelpers.createEntry({ id });
                        state.items.push(itemToUpdate);
                    }
                    Object.assign(itemToUpdate, { keyword, assignmentGroup, notes, phoneLogPath });

                    // Bolt: Update Index for modified item
                    SearchHelper.createIndex([itemToUpdate], SEARCH_FIELDS);

                    sortAndSaveState();
                    clearEditStateAndRender("Saved.");
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
                                    existingEntry.keyword = LookupHelpers.keywordUtils.merge(existingEntry.keyword, keyword);
                                    handleDelete(id, true);
                                    sortAndSaveState();
                                    clearEditStateAndRender("Merged.");
                                }
                            }
                        ])
                    );
                } else {
                    saveAction();
                }
            }

            function handleDelete(id, skipConfirm = false) {
                // Artisan: Optimistic UI removal for performance (Bolt+) and smoothness (Palette+)
                const element = DOMElements.localResults.querySelector(`[data-id="${id}"]`);

                if (currentEditState.id === id) currentEditState = { id: null, type: null };

                const index = state.items.findIndex(i => i.id === id);
                if (index === -1) return;

                const doDelete = () => {
                    if (element) {
                        // Palette+: Fade out animation
                        element.classList.add('fade-out');

                        // Bolt+: Wait for animation, then surgical DOM removal to avoid full O(N) re-render
                        setTimeout(() => {
                            // 1. Update Data State
                            // Check index again in case of race condition (unlikely here but safe)
                            const currentIndex = state.items.findIndex(i => i.id === id);
                            if (currentIndex > -1) state.items.splice(currentIndex, 1);

                            // 2. Update View State (currentMatches)
                            const matchIndex = currentMatches.findIndex(i => i.id === id);
                            if (matchIndex > -1) {
                                currentMatches.splice(matchIndex, 1);
                            }

                            // 3. Update DOM
                            if (element.parentNode) element.parentNode.removeChild(element);

                            // 4. Update Counters
                            renderedCount--;
                            updateResultsStatus(currentMatches.length, renderedCount);

                            // 5. Persist
                            sortAndSaveState();

                            // 6. Feedback
                            if (!skipConfirm) SafeUI.showToast("Deleted.");

                            // 7. Handle Empty/Edge Cases
                            if (currentMatches.length === 0) {
                                renderAll();
                            }
                        }, ANIMATION_DURATION_MS); // Duration matches CSS animation
                    } else {
                        // Fallback if element not found in DOM
                        state.items.splice(index, 1);
                        sortAndSaveState();
                        clearEditStateAndRender(skipConfirm ? null : "Deleted.");
                    }
                };

                if (skipConfirm) doDelete();
                else UIPatterns.confirmDelete('Entry', state.items[index].keyword || 'New Entry', doDelete);
            }

            function validateCsvRow(row, index) {
                const entry = LookupHelpers.createEntry(row);
                const validation = LookupHelpers.validateEntry(entry);
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

                const errorList = importErrors.slice(0, MAX_IMPORT_ERRORS_DISPLAY).map(e => `<li>${SafeUI.escapeHTML(e)}</li>`).join('');
                const moreErrors = importErrors.length > MAX_IMPORT_ERRORS_DISPLAY ? `<li>... and ${importErrors.length - MAX_IMPORT_ERRORS_DISPLAY} more errors.</li>` : '';

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
                summaryHtml += `<p>Cannot be undone.</p>`;

                SafeUI.showModal("Import CSV", summaryHtml,
                    modalActions.cancelAndConfirm('Import', () => {
                        actions.forEach(action => {
                            if (action.action === 'add') state.items.push(action.item);
                            else if (action.action === 'overwrite') {
                                const index = state.items.findIndex(i => i.id === action.item.id);
                                if (index > -1) state.items[index] = action.item;
                                else state.items.push(action.item);
                            }
                        });

                        // Bolt: Rebuild Index for all items (batch op)
                        SearchHelper.createIndex(state.items, SEARCH_FIELDS);

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
                            <input type="text" class="form-control search-name" value="${SafeUI.escapeHTML(search.name)}" placeholder="Name">
                            <input type="text" class="form-control search-url" value="${SafeUI.escapeHTML(search.urlTemplate)}" placeholder="https://site.com?q={query}">
                            <button type="button" class="btn-icon delete-search-btn" title="Delete Search">${SafeUI.SVGIcons.trash}</button>
                        </div>
                    `).join('');

                    if (searchesHtml.length === 0) {
                        searchesHtml = '<p class="form-help" style="text-align: center; margin: 0.5rem 0;">No custom searches added yet.</p>';
                    }

                    return `
                        <div class="form-group">
                            <label>Custom Search</label>
                            <p class="form-help">External links. Use <strong>{query}</strong> for term.</p>
                            <div id="custom-search-list">${searchesHtml}</div>
                            <button type="button" id="btn-add-search" class="btn" style="margin-top: 0.5rem;">Add Search</button>
                        </div>
                    `;
                };

                const pageDataHtml = `
                    <button id="modal-export-csv-btn" class="btn">Export CSV</button>
                    <button id="modal-import-csv-btn" class="btn">Import CSV</button>
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

                        const validation = LookupHelpers.validateSearchUrl(urlTemplate);
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
                            <input type="text" id="search-name-${newId}" class="form-control search-name" value="" placeholder="Name">
                            <input type="text" id="search-url-${newId}" class="form-control search-url" value="" placeholder="https://site.com?q={query}">
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

                    // Bolt: Rebuild Index on Restore
                    if (state.items.length > 0) {
                        SearchHelper.createIndex(state.items, SEARCH_FIELDS);
                    }

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
                }, ANIMATION_DURATION_MS);

                const debouncedRender = SafeUI.debounce(renderAll, RENDER_DEBOUNCE_DELAY_MS);

                DOMElements.searchInput.addEventListener('input', () => {
                    setLoading(true);
                    debouncedRender();
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
                    const createFromSearchBtn = e.target.closest('[data-action="create-from-search"]');
                    if (createFromSearchBtn) {
                        handleAddNewEntry();
                        return;
                    }

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
                        await UIPatterns.copyToClipboard(copyBtn.dataset.copy);
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
                }, SCROLL_DEBOUNCE_DELAY_MS));

                const scrollToTopBtn = document.getElementById('scroll-to-top');
                if (scrollToTopBtn) {
                    DOMElements.localResults.addEventListener('scroll', SafeUI.debounce(() => {
                        scrollToTopBtn.classList.toggle('visible', DOMElements.localResults.scrollTop > SCROLL_TOP_VISIBILITY_THRESHOLD);
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

                DOMElements.btnEditMode.textContent = isEditMode ? 'Exit Edit' : 'Edit';
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
                        DOMElements.btnEditMode.textContent = 'Exit Edit';
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
