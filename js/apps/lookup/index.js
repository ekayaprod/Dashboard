// // import { LOOKUP_ICONS } from "./icons.js";
// // import { LookupHelpers } from "./helpers.js";
// // import { LookupRenderer } from "./renderer.js";
// // import { LookupCSV } from "./csv.js";
// // import { LookupSettings } from "./settings.js";

// ============================================================================
// PAGE-SPECIFIC LOGIC: Lookup (lookup.html)
// ============================================================================





AppLifecycle.onBootstrap(initializePage);

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
const BATCH_SIZE = 50;

function initializePage() {
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

            let currentEditState = { id: null, type: null };
            let isEditMode = false;
            let currentMatches = [];
            let renderedCount = 0;
            let loadingSentinel = null;
            let loadingObserver = null;
            let currentSearchId = 0;

            const setLoading = (isLoading) => {
                if (DOMElements.localResults) {
                    DOMElements.localResults.setAttribute('aria-busy', isLoading ? 'true' : 'false');

                    if (isLoading) {
                        // Palette+: Show skeleton loader immediately
                        LookupRenderer.renderSkeletons(DOMElements.localResults, 4);
                        DOMElements.localResults.classList.remove('results-fading'); // Ensure opacity is full
                    }
                }

                // Curator: Hide spinner as we use skeletons now
                if (DOMElements.searchSpinner) {
                    DOMElements.searchSpinner.classList.add('hidden');
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
                        LookupRenderer.createItemElement(item, searchTerm);

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
                    emptyMessage: LookupRenderer.getEmptyMessage(searchTerm.toLowerCase(), isEditMode),
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

                        <label for="edit-group-${item.id}">Group</label>
                        <input type="text" id="edit-group-${item.id}" class="form-control" value="${SafeUI.escapeHTML(item.assignmentGroup)}" placeholder="Group name">

                        <label for="edit-notes-${item.id}">Notes</label>
                        <textarea id="edit-notes-${item.id}" class="form-control sidebar-textarea" placeholder="Add notes here...">${SafeUI.escapeHTML(item.notes)}</textarea>

                        <label for="edit-path-${item.id}">Path</label>
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
                        LookupHelpers.modalActions.cancelAndMultiple([
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

                const setEditMode = (mode) => { isEditMode = mode; };
                LookupSettings.init({
                    state,
                    config: APP_CONFIG,
                    callbacks: {
                        saveState,
                        renderAll,
                        sortAndSaveState,
                        setEditMode
                    },
                    domElements: DOMElements
                });

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
                        // Palette+: Tactile feedback and optimistic UI
                        // Prevent rapid clicks from messing up the icon state
                        if (copyBtn.classList.contains('btn-copy-success')) return;

                        const originalIcon = copyBtn.innerHTML;
                        copyBtn.innerHTML = LOOKUP_ICONS.check;
                        copyBtn.classList.add('btn-copy-success');

                        // We still show the toast via UIPatterns, but the button also reacts
                        await UIPatterns.copyToClipboard(copyBtn.dataset.copy);

                        // Revert after delay
                        setTimeout(() => {
                            if (copyBtn) {
                                copyBtn.innerHTML = originalIcon;
                                copyBtn.classList.remove('btn-copy-success');
                            }
                        }, 1000);
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

                DOMElements.btnEditMode.textContent = isEditMode ? 'Done' : 'Manage';
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
                        DOMElements.btnEditMode.textContent = 'Done';
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
            if (typeof AppLifecycle !== 'undefined' && AppLifecycle.showStartupError) {
                AppLifecycle.showStartupError("Application Error", `Unexpected error: ${err.message}`);
            }
        }
    })();
}
