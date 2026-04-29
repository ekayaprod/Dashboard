// import { LookupHelpers } from './helpers.js';
// import { LookupCSV } from './csv.js';

const LookupSettings = {
    confirmCsvImport: ({ state, validatedData, importErrors, callbacks }) => {
        const { sortAndSaveState, renderAll } = callbacks;

        const actions = validatedData.map(item => {
            const existingItem = state.items.find(i => i.id === item.id);
            return { action: existingItem ? 'overwrite' : 'add', item: item };
        });

        const toAdd = actions.filter(a => a.action === 'add').length;
        const toOverwrite = actions.filter(a => a.action === 'overwrite').length;

        const MAX_IMPORT_ERRORS_DISPLAY = 10;
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
        summaryHtml += `<p>This action cannot be undone.</p>`;

        SafeUI.showModal("Confirm Import", summaryHtml,
            LookupHelpers.modalActions.cancelAndConfirm('Import Data', () => {
                actions.forEach(action => {
                    if (action.action === 'add') state.items.push(action.item);
                    else if (action.action === 'overwrite') {
                        const index = state.items.findIndex(i => i.id === action.item.id);
                        if (index > -1) state.items[index] = action.item;
                        else state.items.push(action.item);
                    }
                });

                if (window.SearchHelper) {
                    window.SearchHelper.createIndex(state.items, ['keyword', 'assignmentGroup', 'phoneLogPath']);
                }

                sortAndSaveState();
                renderAll();
                SafeUI.showToast(`Imported ${toAdd + toOverwrite} entries.`);
                SafeUI.hideModal();
            }, true)
        );
        return false;
    },

    init: ({ state, config, callbacks, domElements }) => {
        const { saveState, renderAll, sortAndSaveState, setEditMode } = callbacks;

        const getSettingsHtml = () => {
            let searchesHtml = state.settings.customSearches.map(search => `
                <div class="custom-search-item" data-id="${search.id}">
                    <input type="text" class="form-control search-name" value="${SafeUI.escapeHTML(search.name)}" placeholder="Search Name">
                    <input type="text" class="form-control search-url" value="${SafeUI.escapeHTML(search.urlTemplate)}" placeholder="https://my-kb.com/search?q={query}">
                    <button type="button" class="btn-icon delete-search-btn" title="Delete Search">${SafeUI.SVGIcons.trash}</button>
                </div>
            `).join('');

            if (searchesHtml.length === 0) {
                searchesHtml = `
                    <div class="empty-state-container" aria-live="polite">
                        <p class="empty-state-text">No custom searches added yet.</p>
                    </div>
                `;
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
                        listContainer.innerHTML = `
                            <div class="empty-state-container" aria-live="polite">
                                <p class="empty-state-text">No custom searches added yet.</p>
                            </div>
                        `;
                    }
                }
            });

            CsvManager.setupExport({
                exportBtn: document.getElementById('modal-export-csv-btn'),
                headers: config.CSV_HEADERS,
                dataGetter: () => state.items,
                filename: 'lookup-export.csv'
            });

            CsvManager.setupImport({
                importBtn: document.getElementById('modal-import-csv-btn'),
                headers: config.CSV_HEADERS,
                onValidate: (row, index) => LookupCSV.validateRow(row, index, state.items),
                onConfirm: (validatedData, importErrors) => LookupSettings.confirmCsvImport({ state, validatedData, importErrors, callbacks })
            });
        };

        const onRestore = (dataToRestore) => {
            state.items = dataToRestore.items || [];

            if (state.items.length > 0 && window.SearchHelper) {
                window.SearchHelper.createIndex(state.items, ['keyword', 'assignmentGroup', 'phoneLogPath']);
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

            const isEditMode = state.ui.isEditMode || false;
            domElements.btnEditMode.textContent = isEditMode ? 'Done' : 'Manage';
            domElements.btnEditMode.classList.toggle('btn-primary', isEditMode);
            if (setEditMode) setEditMode(isEditMode);

            SafeUI.hideModal();
            SafeUI.showToast('Restored previous session');
        };

        window.SharedSettingsModal.init({
            buttonId: 'btn-settings',
            appName: config.NAME,
            state: state,
            customSettingsHtml: getSettingsHtml(),
            pageSpecificDataHtml: pageDataHtml,
            onModalOpen: onModalOpen,
            onModalSave: onSave,
            onRestoreCallback: onRestore,
            itemValidators: {
                items: config.CSV_HEADERS,
                settings: []
            }
        });
    }
};
