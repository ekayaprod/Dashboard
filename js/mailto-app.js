/**
 * mailto-app.js
 * MailTo Generator Application Logic (ES6 Module)
 * Version: 2.0.0 (ES6 Module Refactor)
 */

// Explicit imports - browser guarantees these load first
import { SafeUI, DOMHelpers, AppLifecycle } from './app-core.js';
import { BackupRestore, DataValidator, CsvManager } from './app-data.js';
import { UIPatterns, ListRenderer, SharedSettingsModal } from './app-ui.js';

// Page-specific external library
import { MsgReader } from './msgreader.js';

// Configuration
const APP_CONFIG = {
    NAME: 'mailto_library',
    VERSION: '2.0.0',
    DATA_KEY: 'mailto_library_v1',
    CSV_HEADERS: ['name', 'path', 'to', 'cc', 'bcc', 'subject', 'body']
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAILTO_FIELDS = ['to', 'cc', 'bcc', 'subject', 'body'];
const ICONS = {
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
    template: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm.15-1.4-1.291.79l-4.276 2.624V4.697l5.562 3.42zM16 4.697v7.104l-5.803-3.558zM9.031 8.83l1.291.79 4.276 2.624V4.697l-5.562 3.42z"/></svg>'
};
const CSV_PATH_REGEX = /^\/[\w\s\/-]*$/;

// Default state
const defaultState = {
    library: [],
    ui: {
        currentFolderId: 'root',
        catalogueScrollTop: 0,
        accordionCollapsed: true
    }
};

// Application state
let DOMElements;
let state;
let saveState;
let currentFolderId = 'root';
let currentMailtoCommand = null;

// ============================================================================
// ACCORDION MANAGEMENT
// ============================================================================

function toggleAccordion(e, forceCollapse = false) {
    if (e) {
        if (e.target.closest('button') && e.currentTarget.id === 'mailto-accordion-header') {
            e.stopPropagation();
            return;
        }
    }

    const content = DOMElements.mailtoAccordionContent;
    const icon = DOMElements.mailtoAccordionToggle.querySelector('.accordion-icon');
    const header = DOMElements.mailtoAccordionHeader;
    
    let isCollapsed;
    
    if (forceCollapse) {
        isCollapsed = true;
        content.classList.add('collapsed');
    } else {
        isCollapsed = content.classList.toggle('collapsed');
    }
    
    if (icon) icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    if (header) header.setAttribute('aria-expanded', !isCollapsed);
    
    if (state.ui) {
        state.ui.accordionCollapsed = isCollapsed;
        saveState();
    }
    
    if (!isCollapsed) {
        resizeResultBody();
        resizeResultMailto();
    }
}

function initAccordion() {
    let collapsed = state.ui ? state.ui.accordionCollapsed : true;
    
    const content = DOMElements.mailtoAccordionContent;
    const icon = DOMElements.mailtoAccordionToggle.querySelector('.accordion-icon');
    const header = DOMElements.mailtoAccordionHeader;

    if (collapsed) {
        content.classList.add('collapsed');
        if (icon) icon.style.transform = 'rotate(-90deg)';
        if (header) header.setAttribute('aria-expanded', 'false');
    } else {
        content.classList.remove('collapsed');
        if (icon) icon.style.transform = 'rotate(0deg)';
        if (header) header.setAttribute('aria-expanded', 'true');
    }
    
    DOMElements.mailtoAccordionToggle.addEventListener('click', toggleAccordion);
    DOMElements.mailtoAccordionHeader.addEventListener('click', toggleAccordion);
}

// ============================================================================
// EDITOR UTILITIES
// ============================================================================

function clearEditorFields() {
    currentMailtoCommand = null;
    MAILTO_FIELDS.forEach(field => {
        const element = DOMElements['result' + field.charAt(0).toUpperCase() + field.slice(1)];
        if (element) element.value = '';
    });
    DOMElements.saveTemplateName.value = '';
    DOMElements.outputWrapper.classList.add('hidden');
}

const resizeResultBody = () => DOMHelpers.triggerTextareaResize(DOMElements.resultBody);
const resizeResultMailto = () => DOMHelpers.triggerTextareaResize(DOMElements.resultMailto);

// ============================================================================
// MAILTO UTILITIES
// ============================================================================

function parseMailto(mailtoStr) {
    const data = {};
    MAILTO_FIELDS.forEach(field => data[field] = '');

    if (!mailtoStr || !mailtoStr.startsWith('mailto:')) return data;
    if (!/^mailto:[^\s]*/.test(mailtoStr)) return data;

    try {
        const url = new URL(mailtoStr.replace(/ /g, '%20'));
        data.to = decodeURIComponent(url.pathname || '');
        MAILTO_FIELDS.slice(1).forEach(field => {
            data[field] = decodeURIComponent(url.searchParams.get(field) || '');
        });
        return data;
    } catch (e) {
        console.warn("Mailto string parsing failed:", mailtoStr, e);
        if (mailtoStr.indexOf('?') === -1) {
            try {
                data.to = decodeURIComponent(mailtoStr.substring(7));
            } catch {
                data.to = mailtoStr.substring(7);
            }
        }
        return data;
    }
}

function buildMailto(data) {
    let mailto = 'mailto:';
    if (data.to) {
        const recipients = data.to.split(',').map(r => r.trim()).filter(Boolean);
        mailto += recipients.map(r => encodeURIComponent(r)).join(',');
    }
    
    const params = [];
    
    MAILTO_FIELDS.slice(1).forEach(field => {
        if (data[field]) {
            if (field === 'body') {
                const normalizedBody = data.body.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                const encodedBody = encodeURIComponent(normalizedBody).replace(/%0A/g, '%0D%0A');
                params.push('body=' + encodedBody);
            } else {
                params.push(field + '=' + encodeURIComponent(data[field]));
            }
        }
    });
    
    if (params.length > 0) {
        mailto += '?' + params.join('&');
    }
    return mailto;
}

// ============================================================================
// LIBRARY TREE NAVIGATION
// ============================================================================

function findItemById(id, items = state.library, visited = new Set()) {
    if (id === 'root') return { id: 'root', name: 'Root', children: state.library, path: '/' };
    for (const item of items) {
        if (visited.has(item.id)) continue;
        visited.add(item.id);

        if (item.id === id) return item;
        if (item.type === 'folder' && item.children) {
            const found = findItemById(id, item.children, visited);
            if (found) return found;
        }
    }
    return null;
}

function findParentOfItem(childId, parent = { id: 'root', children: state.library }, visited = new Set()) {
    if (visited.has(parent.id)) return null;
    visited.add(parent.id);
    
    if (parent.children) {
        if (parent.children.some(child => child.id === childId)) return parent;
        for (const item of parent.children) {
            if (item.type === 'folder') {
                const foundParent = findParentOfItem(childId, item, visited);
                if (foundParent) return foundParent;
            }
        }
    }
    return null;
}

function getItemsInCurrentFolder() {
    if (currentFolderId === 'root') return state.library;
    const folder = findItemById(currentFolderId);
    return folder ? folder.children : [];
}

function getBreadcrumbPath(folderId) {
    if (folderId === 'root') return [{ id: 'root', name: 'Root' }];

    const path = [];
    const visitedIds = new Set();
    let iterations = 0;
    const maxIterations = (state.library.length || 1) * 10;

    const stack = state.library.map(item => [item, []]);

    while (stack.length > 0) {
        if (++iterations > maxIterations) {
            console.warn('[MailTo] getBreadcrumbPath: Max iterations reached');
            break;
        }

        const [currentItem, parentPath] = stack.pop();
        
        if (visitedIds.has(currentItem.id)) continue;
        visitedIds.add(currentItem.id);

        const currentPath = [...parentPath, { id: currentItem.id, name: currentItem.name }];

        if (currentItem.id === folderId) {
            path.push(...currentPath);
            break;
        }

        if (currentItem.type === 'folder' && currentItem.children) {
            for (let i = currentItem.children.length - 1; i >= 0; i--) {
                stack.push([currentItem.children[i], currentPath]);
            }
        }
    }
    
    path.unshift({ id: 'root', name: 'Root' });
    return path;
}

function navigateToFolder(id) {
    currentFolderId = id;
    if (state.ui) {
        state.ui.currentFolderId = id;
        saveState();
    }
    renderCatalogue();
}

// ============================================================================
// RENDERING
// ============================================================================

function renderBreadcrumbs(path) {
    const html = path.map((part, index) => {
        const escapedId = SafeUI.escapeHTML(part.id);
        const escapedName = SafeUI.escapeHTML(part.name);

        if (index === path.length - 1) {
            return `<span class="breadcrumb-current">${escapedName}</span>`;
        } else {
            return `<a class="breadcrumb-link" data-id="${escapedId}">${escapedName}</a><span class="breadcrumb-separator">/</span>`;
        }
    }).join('');
    DOMElements.breadcrumbContainer.innerHTML = html;
}

function renderCatalogue() {
    const path = getBreadcrumbPath(currentFolderId);
    renderBreadcrumbs(path);

    const items = getItemsInCurrentFolder();
    const sortedItems = [...items].sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return (a.name || '').localeCompare(b.name || '');
    });
    
    ListRenderer.renderList({
        container: DOMElements.treeListContainer,
        items: sortedItems,
        emptyMessage: "This folder is empty. Click 'New Folder' to add one, or 'Create New Template' above.",
        createItemElement: (item) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.dataset.id = item.id;
            div.dataset.type = item.type;
            
            const iconType = item.type === 'folder' ? 'folder' : 'template';
            const iconSvg = ICONS[iconType];
            
            let nameElement = '';
            const escapedName = SafeUI.escapeHTML(item.name);

            if (item.type === 'folder') {
                nameElement = `<span class="list-item-name-folder">${escapedName}</span>`;
            } else {
                const escapedMailto = SafeUI.escapeHTML(item.mailto);
                nameElement = `<a href="${escapedMailto}" class="list-item-name" title="Launch: ${escapedName}">${escapedName}</a>`;
            }

            const moveButton = item.type === 'item' ?
                `<button class="icon-btn move-btn" title="Move to...">${SafeUI.SVGIcons.pencil}</button>` : '';

            div.innerHTML = `
                <div class="list-item-icon ${iconType}">${iconSvg}</div>
                ${nameElement}
                <div class="list-item-actions">
                    ${item.type === 'item' ? `<button class="icon-btn copy-btn" title="Copy mailto: command" data-mailto="${SafeUI.escapeHTML(item.mailto)}">${SafeUI.SVGIcons.copy}</button>` : ''}
                    ${moveButton}
                    <button class="icon-btn delete-btn" title="Delete">${SafeUI.SVGIcons.trash}</button>
                </div>
            `;
            return div;
        }
    });
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function handleTreeItemCopy(item, copyBtn) {
    const mailtoCommand = copyBtn.dataset.mailto;
    if (mailtoCommand && mailtoCommand !== 'undefined' && mailtoCommand !== 'null') {
        SafeUI.copyToClipboard(mailtoCommand);
        SafeUI.showToast(`Copied "${item.name}" to clipboard!`);
    } else {
        SafeUI.showToast('No command to copy from this template.');
    }
}

function handleTreeItemDelete(id, item) {
    UIPatterns.confirmDelete(item.type, item.name, () => {
        const parent = findParentOfItem(id);
        if (parent) {
            const index = parent.children.findIndex(i => i.id === id);
            if (index > -1) {
                parent.children.splice(index, 1);
                saveState();
                renderCatalogue();
            }
        }
    });
}

function handleTreeItemMove(id, item) {
    const folders = [];
    function findFolders(container, path, currentFolderId) {
        folders.push({
            id: currentFolderId,
            name: path,
            disabled: currentFolderId === findParentOfItem(id)?.id
        });
        container.forEach(i => {
            if (i.type === 'folder') {
                findFolders(i.children, path + i.name + '/', i.id);
            }
        });
    }
    
    findFolders(state.library, '/', 'root');

    const folderListHtml = folders.map(folder => `
        <li class="move-folder-item ${folder.disabled ? 'disabled' : ''}" data-folder-id="${SafeUI.escapeHTML(folder.id)}">
            ${ICONS.folder} ${SafeUI.escapeHTML(folder.name)}
        </li>
    `).join('');

    const modalHtml = `
        <p>Move "<strong>${SafeUI.escapeHTML(item.name)}</strong>" to:</p>
        <ul class="move-folder-list">
            ${folderListHtml}
        </ul>
    `;
    
    SafeUI.showModal('Move Template', modalHtml, [{ label: 'Cancel' }]);
    
    document.querySelector('.move-folder-list').addEventListener('click', (e) => {
        const targetFolderEl = e.target.closest('.move-folder-item');
        if (!targetFolderEl || targetFolderEl.classList.contains('disabled')) return;
        
        const targetFolderId = targetFolderEl.dataset.folderId;
        
        const originalParent = findParentOfItem(id);
        if (!originalParent) return;
        
        const itemIndex = originalParent.children.findIndex(i => i.id === id);
        if (itemIndex === -1) return;
        
        const [itemToMove] = originalParent.children.splice(itemIndex, 1);
        
        let newParentContainer;
        if (targetFolderId === 'root') {
            newParentContainer = state.library;
        } else {
            newParentContainer = findItemById(targetFolderId)?.children;
        }
        
        if (!newParentContainer) {
            originalParent.children.splice(itemIndex, 0, itemToMove);
            return;
        }
        
        newParentContainer.push(itemToMove);
        
        saveState();
        renderCatalogue();
        SafeUI.hideModal();
        SafeUI.showToast('Template moved!');
    });
}

function handleFile(file) {
    try {
        if (!file) return SafeUI.showModal('Error', '<p>No file selected.</p>', [{label: 'OK'}]);
        if (file.size > MAX_FILE_SIZE_BYTES) return SafeUI.showModal('File Too Large', '<p>File must be under 10MB.</p>', [{label: 'OK'}]);

        if (!file.name.endsWith('.msg') && !file.name.endsWith('.oft') && !file.name.endsWith('.eml') && !file.name.endsWith('.email')) {
            return SafeUI.showModal('Invalid File', '<p>Please upload a <strong>.msg, .oft, .eml,</strong> or <strong>.email</strong> file.</p>', [{label: 'OK'}]);
        }
        
        clearEditorFields();

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const arrayBuffer = e.target.result;
                if (!arrayBuffer) throw new Error('File is empty.');
                
                const fileData = MsgReader.read(arrayBuffer);
                if (!fileData) throw new Error('Parser failed to return data.');
                
                DOMElements.resultSubject.value = fileData.subject || '';
                DOMElements.resultBody.value = fileData.body || '';
                
                const recipients = fileData.recipients || [];
                const toRecipients = [];
                const ccRecipients = [];
                const bccRecipients = [];

                recipients.forEach(r => {
                    const addr = r.email || '';
                    if (!addr) return;
                    
                    let cleanAddr = addr;
                    const match = addr.match(/<([^>]+)>/);
                    if (match) cleanAddr = match[1];
                    
                    cleanAddr = cleanAddr.trim();
                    if (!cleanAddr) return;
                    
                    if (r.recipientType === 2) ccRecipients.push(cleanAddr);
                    else if (r.recipientType === 3) bccRecipients.push(cleanAddr);
                    else toRecipients.push(cleanAddr);
                });

                DOMElements.resultTo.value = toRecipients.join(', ');
                DOMElements.resultCc.value = ccRecipients.join(', ');
                DOMElements.resultBcc.value = bccRecipients.join(', ');

                DOMElements.outputWrapper.classList.add('hidden');
                setTimeout(() => resizeResultBody(), 0);
                SafeUI.showToast('File loaded successfully!');
                
            } catch (err) {
                console.error('File parsing error:', err);
                SafeUI.showModal('File Error', `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{label: 'OK'}]);
            }
        };
        reader.onerror = () => SafeUI.showModal('File Error', '<p>File reading failed.</p>', [{label: 'OK'}]);
        reader.readAsArrayBuffer(file);

    } catch (e) {
        console.error('File operation failed:', e);
        SafeUI.showToast('File operation failed.');
    }
}

function generateAndShowMailto() {
    const mailtoData = {
        to: DOMElements.resultTo.value.trim(),
        cc: DOMElements.resultCc.value.trim(),
        bcc: DOMElements.resultBcc.value.trim(),
        subject: DOMElements.resultSubject.value.trim(),
        body: DOMElements.resultBody.value
    };

    const mailto = buildMailto(mailtoData);

    currentMailtoCommand = mailto;
    DOMElements.resultMailto.value = mailto;
    DOMElements.resultLink.href = mailto;
    DOMElements.outputWrapper.classList.remove('hidden');
    
    const templateNameValue = DOMElements.saveTemplateName.value;
    if (!templateNameValue.trim()) {
        DOMElements.saveTemplateName.value = (mailtoData.subject || 'New Template').replace(/[\r\n\t\/\\]/g, ' ').trim();
    }

    setTimeout(() => resizeResultMailto(), 0);
}

function handleNewFolder() {
    SafeUI.showModal('New Folder', '<input id="folder-name-input" class="sidebar-input" placeholder="Folder Name">', [
        {label: 'Cancel'},
        {label: 'Create', class: 'button-primary', callback: () => {
            try {
                const nameInput = document.getElementById('folder-name-input');
                const name = nameInput.value.trim();
                
                if (name.includes('/') || name.includes('\\')) return SafeUI.showValidationError('Invalid Name', 'Folder name cannot contain path separators.', 'folder-name-input');
                if (!SafeUI.validators.notEmpty(name)) return SafeUI.showValidationError('Invalid Name', 'Folder name cannot be empty.', 'folder-name-input');
                
                const container = getItemsInCurrentFolder();
                if (DataValidator.hasDuplicate(container, 'name', name)) return SafeUI.showValidationError('Duplicate Name', 'A folder with this name already exists.', 'folder-name-input');
                
                container.push({
                    id: SafeUI.generateId(),
                    type: 'folder',
                    name: name,
                    children: []
                });
                saveState();
                renderCatalogue();
            } catch(e) {
                console.error('Folder creation failed:', e);
                SafeUI.showToast('Folder creation failed.');
            }
        }}
    ]);
}

function handleSaveToLibrary() {
    if (!currentMailtoCommand) return SafeUI.showValidationError('No Command Generated', 'Click "Generate Command" first.', 'btn-generate');

    const name = DOMElements.saveTemplateName.value.trim();
    if (!SafeUI.validators.notEmpty(name)) return SafeUI.
showValidationError('Invalid Name', 'Template name cannot be empty.', 'save-template-name');
    
    const container = getItemsInCurrentFolder();
    if (DataValidator.hasDuplicate(container, 'name', name)) return SafeUI.showValidationError('Duplicate Name', 'An item with this name already exists.', 'save-template-name');
    
    container.push({
        id: SafeUI.generateId(),
        type: 'item',
        name: name,
        mailto: currentMailtoCommand
    });
    saveState();
    SafeUI.showToast('Template saved!');
    
    clearEditorFields();
    toggleAccordion(null, true);
    
    renderCatalogue();
}

// ============================================================================
// SETTINGS MODAL
// ============================================================================

function setupSettingsModal() {
    const pageDataHtml = `
        <button id="modal-export-csv-btn" class="button-base">Export Library (CSV)</button>
        <button id="modal-import-csv-btn" class="button-base">Import Library (CSV)</button>
    `;

    const onModalOpen = () => {
        CsvManager.setupExport({
            exportBtn: document.getElementById('modal-export-csv-btn'),
            headers: APP_CONFIG.CSV_HEADERS,
            dataGetter: () => {
                const csvData = [];
                function walk(items, currentPath) {
                    for (const item of items) {
                        if (item.type === 'folder') {
                            walk(item.children, currentPath + item.name + '/');
                        } else if (item.type === 'item') {
                            const mailtoParts = parseMailto(item.mailto);
                            const row = { name: item.name, path: currentPath };
                            MAILTO_FIELDS.forEach(field => { row[field] = mailtoParts[field]; });
                            csvData.push(row);
                        }
                    }
                }
                walk(state.library, '/');
                if (csvData.length === 0) {
                    SafeUI.showToast("Library is empty, nothing to export.");
                    return [];
                }
                return csvData;
            },
            filename: `${APP_CONFIG.NAME}-export.csv`
        });
        
        const validateCsvRow = (row, index) => {
            if (!row.name || !row.name.trim()) return { error: `Row ${index + 2}: 'name' column is required.` };
            if (!row.path || !CSV_PATH_REGEX.test(row.path.trim())) return { error: `Row ${index + 2}: 'path' must be a valid folder path.` };
            return { entry: row };
        };
        
        const confirmCsvImport = (validatedData, importErrors) => {
            const summaryHtml = `<p>This will <strong>ADD ${validatedData.length} templates</strong> to your library.</p>
                                ${importErrors.length > 0 ? `<p><strong>${importErrors.length} rows had errors and will be skipped.</strong></p>` : ''}
                                <p>Do you want to continue?</p>`;
            SafeUI.showModal("Confirm CSV Import", summaryHtml, [
                { label: 'Cancel' },
                {
                    label: 'Import',
                    class: 'button-primary',
                    callback: () => {
                        let importedCount = 0;
                        let skippedCount = 0;
                        for (const row of validatedData) {
                            const pathParts = row.path.split('/').filter(p => p.trim().length > 0);
                            let currentContainer = state.library;
                            for (const part of pathParts) {
                                let folder = currentContainer.find(i => i.type === 'folder' && i.name.toLowerCase() === part.toLowerCase());
                                if (!folder) {
                                    folder = { id: SafeUI.generateId(), type: 'folder', name: part, children: [] };
                                    currentContainer.push(folder);
                                }
                                currentContainer = folder.children;
                            }
                            if (DataValidator.hasDuplicate(currentContainer, 'name', row.name)) {
                                skippedCount++;
                            } else {
                                const newMailto = buildMailto(row);
                                currentContainer.push({ id: SafeUI.generateId(), type: 'item', name: row.name.trim(), mailto: newMailto });
                                importedCount++;
                            }
                        }
                        if (importedCount > 0) { saveState(); renderCatalogue(); }
                        SafeUI.showToast(`Import complete. Added ${importedCount}, skipped ${skippedCount}.`);
                        SafeUI.hideModal();
                    }
                }
            ]);
            return false;
        };
        
        CsvManager.setupImport({
            importBtn: document.getElementById('modal-import-csv-btn'),
            headers: APP_CONFIG.CSV_HEADERS,
            onValidate: validateCsvRow,
            onConfirm: confirmCsvImport
        });
    };

    const onRestore = (dataToRestore) => {
        state.library = dataToRestore.library || [];
        
        if (dataToRestore.ui) state.ui = dataToRestore.ui;
        else state.ui = { ...defaultState.ui };
        
        currentFolderId = 'root';
        if (state.ui) state.ui.currentFolderId = 'root';
        
        saveState();
        renderCatalogue();
        initAccordion();
        SafeUI.showToast('Restored previous session');
    };

    SharedSettingsModal.init({
        buttonId: 'btn-settings',
        appName: APP_CONFIG.NAME,
        state: state,
        pageSpecificDataHtml: pageDataHtml,
        onModalOpen: onModalOpen,
        onRestoreCallback: onRestore,
        itemValidators: {
            library: []
        }
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function attachEventListeners() {
    setupSettingsModal();
    initAccordion();

    DOMElements.btnNewFolder.addEventListener('click', handleNewFolder);
    DOMElements.btnGenerate.addEventListener('click', generateAndShowMailto);
    DOMElements.btnSaveToLibrary.addEventListener('click', handleSaveToLibrary);
    
    DOMElements.copyMailtoBtn.addEventListener('click', async () => {
        if (!currentMailtoCommand) return SafeUI.showToast('No command to copy');
        const success = await SafeUI.copyToClipboard(currentMailtoCommand);
        SafeUI.showToast(success ? "Command copied to clipboard!" : "Failed to copy.");
    });
    
    DOMElements.uploadWrapper.addEventListener('dragenter', (e) => {
        e.preventDefault();
        DOMElements.uploadWrapper.classList.add('dragover');
    });
    DOMElements.uploadWrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        DOMElements.uploadWrapper.classList.add('dragover');
    });
    DOMElements.uploadWrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        DOMElements.uploadWrapper.classList.remove('dragover');
    });
    DOMElements.uploadWrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        DOMElements.uploadWrapper.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files && files.length > 0) handleFile(files[0]);
    });
    
    DOMElements.msgUpload.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    DOMElements.treeListContainer.addEventListener('click', (e) => {
        const itemEl = e.target.closest('.list-item');
        if (!itemEl) return;
        if (e.target.closest('.list-item-name')) return;
        
        e.preventDefault();

        const id = itemEl.dataset.id;
        const item = findItemById(id);
        if (!item) return;

        if (e.target.closest('.list-item-name-folder') || e.target.closest('.list-item-icon.folder')) {
            if (item.type === 'folder') navigateToFolder(item.id);
            return;
        }

        const copyBtn = e.target.closest('.copy-btn');
        if (copyBtn) return handleTreeItemCopy(item, copyBtn);
        
        const moveBtn = e.target.closest('.move-btn');
        if (moveBtn) return handleTreeItemMove(id, item);
        
        if (e.target.closest('.delete-btn')) return handleTreeItemDelete(id, item);
    });
    
    DOMElements.breadcrumbContainer.addEventListener('click', (e) => {
        const link = e.target.closest('.breadcrumb-link');
        if (link && link.dataset.id) {
            const targetId = link.dataset.id;
            if (targetId === 'root' || findItemById(targetId)) navigateToFolder(targetId);
            else navigateToFolder('root');
        }
    });
    
    const mainContent = document.querySelector('.main-content');
    mainContent.addEventListener('scroll', SafeUI.debounce(() => {
        if (state.ui) {
            state.ui.catalogueScrollTop = mainContent.scrollTop;
            saveState();
        }
    }, 500));
    
    const scrollToTopBtn = document.getElementById('scroll-to-top');
    if (scrollToTopBtn) {
        mainContent.addEventListener('scroll', SafeUI.debounce(() => {
            scrollToTopBtn.classList.toggle('visible', mainContent.scrollTop > 300);
        }, 200));
        scrollToTopBtn.addEventListener('click', () => {
            mainContent.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    console.log(`[MailTo] Initializing v${APP_CONFIG.VERSION}`);
    
    // Load navbar
    const navResponse = await fetch('navbar.html');
    const navContainer = document.getElementById('navbar-container');
    if (navContainer && navResponse.ok) {
        navContainer.innerHTML = await navResponse.text();
    }
    
    // Initialize page
    const ctx = await AppLifecycle.initPage({
        storageKey: APP_CONFIG.DATA_KEY,
        defaultState: defaultState,
        version: APP_CONFIG.VERSION,
        requiredElements: [
            'navbar-container', 'toast', 'modal-overlay', 'modal-content',
            'catalogue-view', 'btn-new-folder', 'btn-settings',
            'breadcrumb-container', 'tree-list-container',
            'btn-generate', 'upload-wrapper', 'msg-upload',
            'result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body',
            'output-wrapper', 'result-link', 'result-mailto', 'copy-mailto-btn',
            'save-template-name', 'btn-save-to-library',
            'mailto-accordion-header', 'mailto-accordion-toggle', 'mailto-accordion-content'
        ]
    });
    
    if (!ctx || !ctx.elements) {
        console.error('[MailTo] Context initialization failed');
        return;
    }
    
    DOMElements = ctx.elements;
    state = ctx.state;
    saveState = ctx.saveState;
    
    DOMElements.btnNewFolder.innerHTML = SafeUI.SVGIcons.plus + ICONS.folder;
    
    DOMHelpers.setupTextareaAutoResize(DOMElements.resultBody);
    DOMHelpers.setupTextareaAutoResize(DOMElements.resultMailto, 150);
    
    attachEventListeners();
    
    // Restore state
    if (state.ui) {
        if (state.ui.currentFolderId && findItemById(state.ui.currentFolderId)) {
            currentFolderId = state.ui.currentFolderId;
        }
        
        renderCatalogue();
        
        const mainContent = document.querySelector('.main-content');
        if (state.ui.catalogueScrollTop && mainContent) {
            setTimeout(() => {
                mainContent.scrollTop = state.ui.catalogueScrollTop;
            }, 0);
        }
        
        if (Object.keys(state.ui).some(key => state.ui[key] !== defaultState.ui[key])) {
            SafeUI.showToast('Restored previous session');
        }
    } else {
        renderCatalogue();
    }
    
    console.log('[MailTo] Init complete');
}

// Auto-run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}