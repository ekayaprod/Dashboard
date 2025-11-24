/**
 * mailto-app.js
 * MailTo Generator Application Logic (ES6 Module / Hybrid)
 */

import { MsgReader } from '../msgreader.js';

const APP_CONFIG = {
    NAME: 'mailto_library',
    VERSION: '2.3.3',
    DATA_KEY: 'mailto_library_v1',
    CSV_HEADERS: ['name', 'path', 'to', 'cc', 'bcc', 'subject', 'body']
};

const MAILTO_PARAM_KEYS = ['cc', 'bcc', 'subject']; 

const ICONS = {
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
    template: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4Zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2Zm13 2.383-4.708 2.825L15 11.105V5.383Zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741ZM1 11.105l4.708-2.897L1 5.383v5.722Z"/></svg>',
    trash: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5Zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6Z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1ZM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118ZM2.5 3h11V2h-11v1Z"/></svg>',
    move: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M15 2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2zM0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm5.854 8.854a.5.5 0 1 0-.708-.708L4 11.293V1.5a.5.5 0 0 0-1 0v9.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 2a.5.5 0 0 0 .708 0l2-2z"/></svg>',
    edit: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>'
};

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

function findInTree(items, predicate, parent = null) {
    for (const item of items) {
        if (predicate(item)) return { item, parent };
        if (item.type === 'folder' && item.children) {
            const result = findInTree(item.children, predicate, item);
            if (result) return result;
        }
    }
    return null;
}

function findItemById(id) {
    if (id === 'root') return { id: 'root', name: 'Root', children: state.library, type: 'folder' };
    const result = findInTree(state.library, i => i.id === id);
    return result ? result.item : null;
}

function findParentOfItem(childId) {
    if (childId === 'root') return null; 
    const result = findInTree(state.library, i => i.id === childId);
    return result ? (result.parent || {id: 'root', children: state.library}) : null;
}

function getAllFolders(items = state.library, level = 0) {
    let folders = [];
    if (level === 0) folders.push({ id: 'root', name: 'Root', level: 0 });

    items.forEach(item => {
        if (item.type === 'folder') {
            folders.push({ id: item.id, name: item.name, level: level + 1 });
            if (item.children) {
                folders = folders.concat(getAllFolders(item.children, level + 1));
            }
        }
    });
    return folders;
}

function populateFolderSelect(selectEl, excludeId = null, includeCreateNew = false) {
    const folders = getAllFolders();
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
    
    const setExpanded = (el, isExpanded) => {
        if (isExpanded) {
            el.classList.add('expanded');
            el.classList.remove('collapsed');
        } else {
            el.classList.remove('expanded');
            el.classList.add('collapsed');
        }
    };
    
    if (sectionName === 'library') {
        setExpanded(libSec, true);
        setExpanded(editSec, false);
    } else if (sectionName === 'editor') {
        setExpanded(editSec, true);
        setExpanded(libSec, false);
    } else {
        setExpanded(libSec, false);
        setExpanded(editSec, false);
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

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const d = MsgReader.read(e.target.result);
            DOMElements.resultSubject.value = d.subject || '';
            DOMElements.resultBody.value = d.body || '';
            
            const map = {1:[], 2:[], 3:[]}; 
            d.recipients.forEach(r => {
                const addr = r.email || (r.name && r.name.includes('@')?r.name:'');
                if(addr) map[r.recipientType || 1].push(addr);
            });
            DOMElements.resultTo.value = map[1].join(', ');
            DOMElements.resultCc.value = map[2].join(', ');
            DOMElements.resultBcc.value = map[3].join(', ');
            
            setActiveSection('editor');
            SafeUI.showToast('File loaded');
        } catch (err) { 
            SafeUI.showModal("Error", `<p>${err.message}</p>`, [{label:'OK'}]); 
        }
    };
    reader.readAsArrayBuffer(file);
}

function getBreadcrumbPath(folderId) {
    if (folderId === 'root') return [{ id: 'root', name: 'Root' }];
    const path = [];
    const visitedIds = new Set();
    const stack = state.library.map(item => [item, []]);
    while (stack.length > 0) {
        const [curr, pPath] = stack.pop();
        if (visitedIds.has(curr.id)) continue;
        visitedIds.add(curr.id);
        const cPath = [...pPath, { id: curr.id, name: curr.name }];
        if (curr.id === folderId) { path.push(...cPath); break; }
        if (curr.type === 'folder' && curr.children) {
            for (let i = curr.children.length - 1; i >= 0; i--) stack.push([curr.children[i], cPath]);
        }
    }
    path.unshift({ id: 'root', name: 'Root' });
    return path;
}

function getItemsInCurrentFolder() {
    if (currentFolderId === 'root') return state.library;
    const f = findItemById(currentFolderId);
    if (!f) { currentFolderId = 'root'; return state.library; }
    return f ? f.children : [];
}

function renderCatalogue() {
    const path = getBreadcrumbPath(currentFolderId);
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
                 <div class="list-item-icon ${isFolder?'folder':'template'}">${ICONS[isFolder ? 'folder' : 'template']}</div>
                 ${isFolder 
                    ? `<span class="list-item-name-folder">${SafeUI.escapeHTML(item.name)}</span>` 
                    : `<a href="${SafeUI.escapeHTML(item.mailto)}" class="list-item-name">${SafeUI.escapeHTML(item.name)}</a>`
                 }
                 <div class="list-item-actions">
                    ${!isFolder ? `<button class="icon-btn copy-btn" title="Copy Link">${ICONS.folder}</button>` : ''}
                    <button class="icon-btn move-btn" title="Move">${ICONS.move}</button>
                    <button class="icon-btn edit-btn" title="${isFolder?'Rename':'Edit'}">${ICONS.edit}</button>
                    <button class="icon-btn delete-btn" title="Delete">${ICONS.trash}</button>
                 </div>`;
            return div;
        }
    });
}

function openMoveModal(itemId) {
    const item = findItemById(itemId);
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
                    const oldParent = findParentOfItem(itemId);
                    if (oldParent) oldParent.children = oldParent.children.filter(c => c.id !== itemId);
                    
                    const newParent = findItemById(targetId);
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
    console.log(`[MailTo] Initializing v${APP_CONFIG.VERSION}`);
    
    if (typeof SafeUI === 'undefined') { return; }

    const ctx = await AppLifecycle.initPage({
        storageKey: APP_CONFIG.DATA_KEY,
        defaultState: defaultState,
        version: APP_CONFIG.VERSION,
        requiredElements: [
            'navbar-container', 'btn-new-folder', 'btn-settings', 'breadcrumb-container', 'tree-list-container',
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

    const handleHeaderClick = (section) => {
        const next = state.ui.activeSection === section ? null : section;
        setActiveSection(next);
        if(next === 'editor') refreshSaveDropdown();
    };

    document.getElementById('library-header').addEventListener('click', (e) => {
        if (!e.target.closest('button')) handleHeaderClick('library');
    });
    document.getElementById('editor-header').addEventListener('click', (e) => {
        if (!e.target.closest('button')) handleHeaderClick('editor');
    });

    DOMElements.btnClearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        UIPatterns.confirmDelete('Form Data', 'Current Content', () => {
             clearEditorFields();
        });
    });

    DOMElements.btnClearAll.addEventListener('mousedown', (e) => e.stopPropagation());

    DOMElements.btnNewFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        SafeUI.showModal('New Folder', '<input id="fn" class="form-control" placeholder="Folder Name">', [{label:'Create', class:'button-primary', callback:()=>{
            const name = document.getElementById('fn').value.trim();
            if(name) {
                const f = findItemById(currentFolderId);
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
        SafeUI.copyToClipboard(DOMElements.resultMailto.value);
        SafeUI.showToast("Copied");
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

                        const parentId = currentFolderId && findItemById(currentFolderId) ? currentFolderId : 'root';
                        const parentFolder = findItemById(parentId);

                        const newFolder = {
                            id: SafeUI.generateId(),
                            type: 'folder',
                            name: newFolderName,
                            children: []
                        };
                        parentFolder.children.push(newFolder);
                        targetId = newFolder.id;
                    }

                    const targetFolder = findItemById(targetId);
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
            if (currentFolderId && findItemById(currentFolderId)) {
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
        const item = findItemById(id); 
        if(!item) return;

        if(e.target.closest('.list-item-name-folder') || e.target.closest('.list-item-icon.folder')) { 
            currentFolderId = item.id; renderCatalogue(); refreshSaveDropdown(); return;
        }
        
        if(e.target.closest('.copy-btn')) {
            SafeUI.copyToClipboard(item.mailto);
            SafeUI.showToast("Copied command");
            return;
        }

        if(e.target.closest('.delete-btn')) {
            UIPatterns.confirmDelete(item.type, item.name, () => {
                const p = findParentOfItem(id);
                if(p) { 
                    p.children = p.children.filter(c => c.id !== id); 
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

    console.log("[MailTo] Ready");
}

// MailTo uses ES modules so we need to be careful about scope,
// but AppLifecycle should be available globally via bootstrap.
if (typeof AppLifecycle !== 'undefined') {
    AppLifecycle.onBootstrap(init);
} else {
    // Fallback if AppLifecycle isn't loaded yet (rare race condition in modules)
    let bootstrapReady = false;
    document.addEventListener('bootstrap:ready', () => {
        bootstrapReady = true;
        init();
    });

    setTimeout(() => {
        if (!bootstrapReady) {
            console.error('Bootstrap did not complete within 5 seconds');
            const banner = document.getElementById('app-startup-error');
            if (banner) {
                banner.innerHTML = `<strong>Application Startup Timeout</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">The application failed to load within 5 seconds. Check the browser console for errors.</p>`;
                banner.classList.remove('hidden');
            }
        }
    }, 5000);
}
