/**
 * mailto-app.js
 * MailTo Generator Application Logic (ES6 Module / Hybrid)
 */

const APP_CONFIG = {
    NAME: 'mailto_library',
    VERSION: '2.3.3',
    DATA_KEY: 'mailto_library_v1',
    CSV_HEADERS: ['name', 'path', 'to', 'cc', 'bcc', 'subject', 'body']
};

const MAILTO_PARAM_KEYS = ['cc', 'bcc', 'subject']; 

const defaultState = {
    library: [],
    ui: {
        currentFolderId: 'root',
        activeSection: 'editor' 
    }
};

let DOMElements;
let state;
let saveState;
let currentFolderId = 'root';

function populateFolderSelect(selectEl, excludeId = null, includeCreateNew = false) {
    const folders = TreeUtils.getAllFolders(state.library);
    selectEl.innerHTML = '';

    if (includeCreateNew) {
        const createOpt = document.createElement('option');
        createOpt.value = '__CREATE_NEW__';
        createOpt.innerHTML = '➕ &lt; Create New Folder &gt;';
        selectEl.appendChild(createOpt);
    }

    folders.forEach(f => {
        if (f.id === excludeId) return; 
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.innerHTML = '&nbsp;'.repeat(f.level * 2) + (f.level > 0 ? '📂 ' : '') + SafeUI.escapeHTML(f.name);
        selectEl.appendChild(opt);
    });
}

function setActiveSection(sectionName) {
    const libSec = document.getElementById('library-section');
    const editSec = document.getElementById('editor-section');
    const libHeader = document.getElementById('library-header');
    const editHeader = document.getElementById('editor-header');
    
    const setExpanded = (el, header, isExpanded) => {
        if (isExpanded) {
            el.classList.add('expanded');
            el.classList.remove('collapsed');
            if (header) header.setAttribute('aria-expanded', 'true');
        } else {
            el.classList.remove('expanded');
            el.classList.add('collapsed');
            if (header) header.setAttribute('aria-expanded', 'false');
        }
    };
    
    if (sectionName === 'library') {
        setExpanded(libSec, libHeader, true);
        setExpanded(editSec, editHeader, false);
    } else if (sectionName === 'editor') {
        setExpanded(editSec, editHeader, true);
        setExpanded(libSec, libHeader, false);
    } else {
        setExpanded(libSec, libHeader, false);
        setExpanded(editSec, editHeader, false);
    }
    
    if (state.ui) { state.ui.activeSection = sectionName; saveState(); }
}

function updateLivePreview() {
    const d = {
        to: DOMElements.resultTo.value,
        cc: DOMElements.resultCc.value,
        bcc: DOMElements.resultBcc.value,
        subject: DOMElements.resultSubject.value,
        body: DOMElements.resultBody.value
    };
    const m = buildMailto(d);
    DOMElements.resultMailto.value = m;
    DOMElements.resultLink.href = m || '#';

    const hasContent = m.length > 7; // 'mailto:' length
    if (hasContent) {
        DOMElements.resultLink.classList.remove('disabled');
    } else {
        DOMElements.resultLink.classList.add('disabled');
    }
}

function clearEditorFields() {
    ['result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body', 'result-mailto', 'save-template-name'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    
    const fileInput = document.getElementById('msg-upload');
    if (fileInput) fileInput.value = '';
    
    updateLivePreview();
    SafeUI.showToast("Editor cleared");
}

function parseMailto(str) {
    const data = {to:'', cc:'', bcc:'', subject:'', body:''};
    if (!str || !str.startsWith('mailto:')) return data;
    try {
        const qIndex = str.indexOf('?');
        if(qIndex === -1) {
            data.to = decodeURIComponent(str.substring(7));
            return data;
        }
        data.to = decodeURIComponent(str.substring(7, qIndex));
        const params = new URLSearchParams(str.substring(qIndex + 1));
        if(params.has('subject')) data.subject = params.get('subject');
        if(params.has('body')) data.body = params.get('body');
        if(params.has('cc')) data.cc = params.get('cc');
        if(params.has('bcc')) data.bcc = params.get('bcc');
        return data;
    } catch (e) { return data; }
}

function buildMailto(data) {
    try {
        let params = [];
        MAILTO_PARAM_KEYS.forEach(k => { if(data[k]) params.push(`${k}=${encodeURIComponent(data[k])}`); });
        if(data.body) params.push(`body=${encodeURIComponent(data.body).replace(/%0A/g, '%0D%0A')}`);
        return `mailto:${encodeURIComponent(data.to)}?${params.join('&')}`;
    } catch (e) { return ''; }
}

let msgWorker = null;

function handleWorkerMessage(e) {
    const response = e.data;
    const uploadWrapper = document.getElementById('upload-wrapper');
    if (uploadWrapper) {
        uploadWrapper.classList.remove('loading');
        uploadWrapper.removeAttribute('aria-busy');
    }

    if (response.success) {
        const d = response.data;
        if(DOMElements.resultSubject) DOMElements.resultSubject.value = d.subject || '';
        if(DOMElements.resultBody) DOMElements.resultBody.value = d.body || '';

        const map = {1:[], 2:[], 3:[]};
        if (d.recipients) {
            d.recipients.forEach(r => {
                const addr = r.email || (r.name && r.name.includes('@')?r.name:'');
                if(addr) map[r.recipientType || 1].push(addr);
            });
        }
        if(DOMElements.resultTo) DOMElements.resultTo.value = map[1].join(', ');
        if(DOMElements.resultCc) DOMElements.resultCc.value = map[2].join(', ');
        if(DOMElements.resultBcc) DOMElements.resultBcc.value = map[3].join(', ');

        setActiveSection('editor');
        SafeUI.showToast('File loaded');
    } else {
        SafeUI.showModal("Error", `<p>${SafeUI.escapeHTML(response.error)}</p>`, [{label:'OK'}]);
    }
}

/**
 * Initializes the background worker for parsing MSG files.
 * @returns {Worker} The initialized MSG worker instance.
 */
function initWorker() {
    if (!msgWorker) {
        msgWorker = new Worker(new URL('../workers/msg-worker.js', import.meta.url), { type: 'module' });
        msgWorker.onmessage = handleWorkerMessage;
        msgWorker.onerror = (e) => {
            const uploadWrapper = document.getElementById('upload-wrapper');
            if (uploadWrapper) {
                uploadWrapper.classList.remove('loading');
                uploadWrapper.removeAttribute('aria-busy');
            }
            console.error(`Worker Error in ${e.filename} at line ${e.lineno}:`, e.message);
            SafeUI.showModal("Error", `<p>An error occurred in the background worker.</p>`, [{label:'OK'}]);
        };
    }
    return msgWorker;
}

function handleFile(file) {
    const uploadWrapper = document.getElementById('upload-wrapper');
    if (uploadWrapper) {
        uploadWrapper.classList.add('loading');
        uploadWrapper.setAttribute('aria-busy', 'true');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const worker = initWorker();
            // Transfer the buffer to the worker for zero-copy efficiency
            worker.postMessage(e.target.result, [e.target.result]);
        } catch (err) { 
            if (uploadWrapper) {
                uploadWrapper.classList.remove('loading');
                uploadWrapper.removeAttribute('aria-busy');
            }
            SafeUI.showModal("Error", `<p>${err.message}</p>`, [{label:'OK'}]); 
        }
    };
    reader.readAsArrayBuffer(file);
}

function getItemsInCurrentFolder() {
    if (currentFolderId === 'root') return state.library;
    const f = TreeUtils.findItemById(state.library, currentFolderId);
    if (!f) { currentFolderId = 'root'; return state.library; }
    return f ? f.children : [];
}

function renderCatalogue() {
    const path = TreeUtils.getBreadcrumbPath(state.library, currentFolderId);
    DOMElements.breadcrumbContainer.innerHTML = path.map((p, i) => 
        i === path.length - 1 
        ? `<span class="breadcrumb-current">${SafeUI.escapeHTML(p.name)}</span>`
        : `<a class="breadcrumb-link" data-id="${p.id}">${SafeUI.escapeHTML(p.name)}</a><span class="breadcrumb-separator">/</span>`
    ).join('');

    const items = getItemsInCurrentFolder().sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
    });
    
    ListRenderer.renderList({
        container: DOMElements.treeListContainer,
        items: items,
        emptyMessage: "Empty folder.",
        createItemElement: (item) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.dataset.id = item.id;
            const isFolder = item.type === 'folder';
            
            div.innerHTML = `
                 <div class="list-item-icon ${isFolder?'folder':'template'}">${isFolder ? SafeUI.SVGIcons.folder : SafeUI.SVGIcons.template}</div>
                 ${isFolder 
                    ? `<span class="list-item-name-folder">${SafeUI.escapeHTML(item.name)}</span>` 
                    : `<a href="${SafeUI.escapeHTML(item.mailto)}" class="list-item-name">${SafeUI.escapeHTML(item.name)}</a>`
                 }
                 <div class="list-item-actions">
                    ${!isFolder ? `<button class="icon-btn copy-btn" title="Copy Link">${SafeUI.SVGIcons.copy}</button>` : ''}
                    <button class="icon-btn move-btn" title="Move">${SafeUI.SVGIcons.move}</button>
                    <button class="icon-btn edit-btn" title="${isFolder?'Rename':'Edit'}">${SafeUI.SVGIcons.pencil}</button>
                    <button class="icon-btn delete-btn" title="Delete">${SafeUI.SVGIcons.trash}</button>
                 </div>`;
            return div;
        }
    });
}

function openMoveModal(itemId) {
    const item = TreeUtils.findItemById(state.library, itemId);
    if(!item) return;

    const content = `
        <p>Move <strong>${SafeUI.escapeHTML(item.name)}</strong> to:</p>
        <div class="form-group">
            <select id="move-target-select" class="form-control"></select>
        </div>
    `;

    SafeUI.showModal("Move Item", content, [
        {
            label: 'Move',
            class: 'button-primary',
            callback: () => {
                const targetId = document.getElementById('move-target-select').value;
                if(targetId && targetId !== itemId) {
                    const oldParent = TreeUtils.findParentOfItem(state.library, itemId);
                    if (oldParent) {
                        if (oldParent.id === 'root') {
                            state.library = state.library.filter(c => c.id !== itemId);
                        } else {
                            oldParent.children = oldParent.children.filter(c => c.id !== itemId);
                        }
                    }
                    
                    const newParent = TreeUtils.findItemById(state.library, targetId);
                    if (newParent && newParent.children) {
                        newParent.children.push(item);
                        saveState();
                        renderCatalogue();
                        SafeUI.showToast("Item moved");
                    }
                }
            }
        },
        { label: 'Cancel' }
    ]);

    setTimeout(() => {
        const sel = document.getElementById('move-target-select');
        if(sel) populateFolderSelect(sel, item.type === 'folder' ? itemId : null);
    }, 50);
}

async function init() {
    
    if (typeof SafeUI === 'undefined') { return; }

    const ctx = await AppLifecycle.initPage({
        storageKey: APP_CONFIG.DATA_KEY,
        defaultState: defaultState,
        version: APP_CONFIG.VERSION,
        requiredElements: [
            'btn-new-folder', 'btn-settings', 'breadcrumb-container', 'tree-list-container',
            'upload-wrapper', 'msg-upload', 'result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body',
            'output-wrapper', 'result-link', 'result-mailto', 'copy-mailto-btn', 'save-template-name', 'btn-save-to-library',
            'library-header', 'editor-header', 'btn-clear-all'
        ]
    });

    if (!ctx) return; 
    ({ elements: DOMElements, state, saveState } = ctx);

    setActiveSection(state.ui.activeSection || 'editor');

    const refreshSaveDropdown = () => {
        const el = document.getElementById('save-target-folder');
        if(el) {
            populateFolderSelect(el);
            if(currentFolderId) el.value = currentFolderId;
        }
    };

    const handleHeaderInteraction = (e, section) => {
        // Allow bubbling only if not button or input
        if (e.target.closest('button, input, select, a') && e.target !== e.currentTarget) return;

        if (e.type === 'keydown' && !(e.key === 'Enter' || e.key === ' ')) return;
        if (e.type === 'keydown') e.preventDefault();

        const next = state.ui.activeSection === section ? null : section;
        setActiveSection(next);
        if (next === 'editor') refreshSaveDropdown();
    };

    ['library-header', 'editor-header'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.setAttribute('role', 'button');
            el.setAttribute('tabindex', '0');
            el.addEventListener('click', (e) => handleHeaderInteraction(e, id === 'library-header' ? 'library' : 'editor'));
            el.addEventListener('keydown', (e) => handleHeaderInteraction(e, id === 'library-header' ? 'library' : 'editor'));
        }
    });

    DOMElements.btnClearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        UIPatterns.confirmAction(
            'Clear Form',
            '<p>Are you sure you want to clear the Subject and Body?</p>',
            'Clear',
            () => {
                 clearEditorFields();
            }
        );
    });

    DOMElements.btnClearAll.addEventListener('mousedown', (e) => e.stopPropagation());

    DOMElements.btnNewFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        SafeUI.showModal('New Folder', '<input id="fn" class="form-control" placeholder="Folder Name">', [{label:'Create', class:'button-primary', callback:()=>{
            const name = document.getElementById('fn').value.trim();
            if(name) {
                const f = TreeUtils.findItemById(state.library, currentFolderId);
                if(f && f.children) { 
                    f.children.push({id: SafeUI.generateId(), type:'folder', name, children:[]}); 
                    saveState(); 
                    renderCatalogue(); 
                    refreshSaveDropdown();
                }
            }
        }}, {label:'Cancel'}]);
    });

    const uploadWrapper = document.getElementById('upload-wrapper');
    uploadWrapper.addEventListener('click', (e) => {
        if (e.target !== DOMElements.msgUpload) DOMElements.msgUpload.click();
    });
    DOMElements.msgUpload.addEventListener('change', e => { if(e.target.files.length) handleFile(e.target.files[0]); });
    
    const handleDrag = e => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = e => { 
        e.preventDefault(); e.stopPropagation();
        if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); 
    };
    uploadWrapper.addEventListener('dragenter', handleDrag);
    uploadWrapper.addEventListener('dragover', handleDrag);
    uploadWrapper.addEventListener('drop', handleDrop);

    // Live Update Listeners
    ['resultTo', 'resultCc', 'resultBcc', 'resultSubject', 'resultBody'].forEach(key => {
        if (DOMElements[key]) {
            DOMElements[key].addEventListener('input', updateLivePreview);
        }
    });

    DOMElements.copyMailtoBtn.addEventListener('click', () => {
        UIPatterns.copyToClipboard(DOMElements.resultMailto.value, "Copied");
    });

    DOMElements.btnSaveToLibrary.addEventListener('click', () => {
        updateLivePreview(); // Ensure up to date
        
        const defaultName = DOMElements.resultSubject.value.trim() || "New Template";
        const folderSelectId = 'modal-save-folder-select';

        const content = `
            <div class="form-group">
                <label>Template Name</label>
                <input id="modal-save-name" class="form-control" value="${SafeUI.escapeHTML(defaultName)}" placeholder="Template Name">
            </div>
            <div class="form-group">
                <label>Save To</label>
                <select id="${folderSelectId}" class="form-control"></select>
            </div>
            <div id="modal-new-folder-group" class="form-group hidden" style="margin-left: 1rem; border-left: 2px solid var(--border-color); padding-left: 0.5rem;">
                <label>New Folder Name</label>
                <input id="modal-new-folder-name" class="form-control" placeholder="Folder Name">
            </div>
        `;

        SafeUI.showModal("Save Template", content, [
            {
                label: 'Save',
                class: 'btn-primary',
                callback: () => {
                    const name = document.getElementById('modal-save-name').value.trim();
                    if (!name) return SafeUI.showValidationError("Invalid Name", "Template name is required", "modal-save-name");

                    const folderSelect = document.getElementById(folderSelectId);
                    let targetId = folderSelect.value;

                    if (targetId === '__CREATE_NEW__') {
                        const newFolderName = document.getElementById('modal-new-folder-name').value.trim();
                        if (!newFolderName) return SafeUI.showValidationError("Invalid Folder", "Folder name is required", "modal-new-folder-name");

                        // Create folder inside current context or root? Let's default to currentFolderId or root if context is confusing,
                        // but the dropdown implies a global selection.
                        // The simple logic: Create new folder in Root (safest) or inside currentFolderId?
                        // Let's assume Root for simplicity of the dropdown interaction unless 'currentFolderId' is the parent context.
                        // Actually, simpler: create it inside the currently viewed folder or Root.

                        const parentId = currentFolderId && TreeUtils.findItemById(state.library, currentFolderId) ? currentFolderId : 'root';
                        const parentFolder = TreeUtils.findItemById(state.library, parentId);

                        const newFolder = {
                            id: SafeUI.generateId(),
                            type: 'folder',
                            name: newFolderName,
                            children: []
                        };
                        parentFolder.children.push(newFolder);
                        targetId = newFolder.id;
                    }

                    const targetFolder = TreeUtils.findItemById(state.library, targetId);
                    if (targetFolder) {
                        targetFolder.children.push({
                            id: SafeUI.generateId(),
                            type: 'item',
                            name,
                            mailto: DOMElements.resultMailto.value
                        });
                        saveState();
                        renderCatalogue();
                        SafeUI.showToast("Saved to Library");
                        return true;
                    } else {
                        SafeUI.showToast("Error: Target folder not found.");
                        return false;
                    }
                }
            },
            { label: 'Cancel' }
        ]);

        // Post-render logic for the modal
        setTimeout(() => {
            const sel = document.getElementById(folderSelectId);
            populateFolderSelect(sel, null, true); // Enable 'Create New'

            // Default to current folder if possible
            if (currentFolderId && TreeUtils.findItemById(state.library, currentFolderId)) {
                sel.value = currentFolderId;
            } else {
                sel.value = 'root';
            }

            const newFolderGroup = document.getElementById('modal-new-folder-group');
            sel.addEventListener('change', () => {
                if (sel.value === '__CREATE_NEW__') {
                    newFolderGroup.classList.remove('hidden');
                    document.getElementById('modal-new-folder-name').focus();
                } else {
                    newFolderGroup.classList.add('hidden');
                }
            });
        }, 50);
    });

    DOMElements.treeListContainer.addEventListener('click', e => {
        const itemEl = e.target.closest('.list-item');
        if(!itemEl) return;
        const id = itemEl.dataset.id;
        const item = TreeUtils.findItemById(state.library, id);
        if(!item) return;

        if(e.target.closest('.list-item-name-folder') || e.target.closest('.list-item-icon.folder')) { 
            currentFolderId = item.id; renderCatalogue(); refreshSaveDropdown(); return;
        }
        
        if(e.target.closest('.copy-btn')) {
            UIPatterns.copyToClipboard(item.mailto, "Copied command");
            return;
        }

        if(e.target.closest('.delete-btn')) {
            UIPatterns.confirmDelete(item.type, item.name, () => {
                const p = TreeUtils.findParentOfItem(state.library, id);
                if(p) {
                    if (p.id === 'root') {
                        state.library = state.library.filter(c => c.id !== id);
                    } else {
                        p.children = p.children.filter(c => c.id !== id);
                    }
                    if (currentFolderId === id) currentFolderId = 'root';
                    saveState(); renderCatalogue(); refreshSaveDropdown();
                }
            });
            return;
        }

        if(e.target.closest('.edit-btn')) {
            if (item.type === 'folder') {
                SafeUI.showModal('Rename', `<input id="ren" class="form-control" value="${SafeUI.escapeHTML(item.name)}">`, [{label:'Save', class:'button-primary', callback:()=>{
                    const v = document.getElementById('ren').value.trim();
                    if(v) { item.name = v; saveState(); renderCatalogue(); refreshSaveDropdown(); }
                }}, {label:'Cancel'}]);
            } else {
                const parsed = parseMailto(item.mailto);
                DOMElements.resultTo.value = parsed.to || '';
                DOMElements.resultCc.value = parsed.cc || '';
                DOMElements.resultBcc.value = parsed.bcc || '';
                DOMElements.resultSubject.value = parsed.subject || '';
                DOMElements.resultBody.value = parsed.body || '';

                // Note: saveTemplateName is hidden/deprecated in UI but we update it in state if needed
                if(DOMElements.saveTemplateName) DOMElements.saveTemplateName.value = item.name;

                updateLivePreview(); // Trigger preview update
                setActiveSection('editor');
                SafeUI.showToast("Loaded");
            }
        }
        
        if(e.target.closest('.move-btn')) {
            openMoveModal(id);
        }
    });

    DOMElements.breadcrumbContainer.addEventListener('click', e => {
        if(e.target.dataset.id) { currentFolderId = e.target.dataset.id; renderCatalogue(); refreshSaveDropdown(); }
    });

    renderCatalogue();
    refreshSaveDropdown();
    
    SharedSettingsModal.init({
        buttonId: 'btn-settings', appName: APP_CONFIG.NAME, state,
        pageSpecificDataHtml: `<button id=\"exp\" class=\"btn\">Export CSV</button><button id=\"imp\" class=\"btn\">Import CSV</button>`,
        onModalOpen: () => {
            CsvManager.setupExport({exportBtn: document.getElementById('exp'), headers: APP_CONFIG.CSV_HEADERS, dataGetter: ()=>[], filename:'export.csv'});
            CsvManager.setupImport({
                importBtn: document.getElementById('imp'), 
                headers: APP_CONFIG.CSV_HEADERS, 
                onValidate: (r) => (r.name ? {entry: r} : null), 
                onConfirm: (d)=>{}
            });
        },
        onRestoreCallback: (d) => { state.library = d.library; saveState(); renderCatalogue(); refreshSaveDropdown(); }
    });
}

// MailTo uses ES modules so we need to be careful about scope,
// but AppLifecycle should be available globally via bootstrap.
if (typeof AppLifecycle !== 'undefined') {
    AppLifecycle.onBootstrap(init);
} else {
    // Fallback if AppLifecycle isn't loaded yet (rare race condition in modules)
    if (window.__BOOTSTRAP_READY) {
        init();
    } else {
        let bootstrapReady = false;
        document.addEventListener('bootstrap:ready', () => {
            bootstrapReady = true;
            init();
        });

        setTimeout(() => {
            if (!bootstrapReady && !window.__BOOTSTRAP_READY) {
                console.error('Bootstrap did not complete within 5 seconds');
                const banner = document.getElementById('app-startup-error');
                if (banner) {
                    banner.innerHTML = `<strong>Application Startup Timeout</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">The application failed to load within 5 seconds. Check the browser console for errors.</p>`;
                    banner.classList.remove('hidden');
                }
            }
        }, 5000);
    }
}
