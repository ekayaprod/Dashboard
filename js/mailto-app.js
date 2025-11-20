/**
 * mailto-app.js
 * MailTo Generator Application Logic (ES6 Module / Hybrid)
 * Version: 2.2.0 (UX Overhaul: Sidebar Optimized)
 */

import { MsgReader } from './msgreader.js';

// Configuration
const APP_CONFIG = {
    NAME: 'mailto_library',
    VERSION: '2.2.0',
    DATA_KEY: 'mailto_library_v1',
    CSV_HEADERS: ['name', 'path', 'to', 'cc', 'bcc', 'subject', 'body']
};

const MAILTO_PARAM_KEYS = ['cc', 'bcc', 'subject']; 
const ICONS = {
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
    template: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm.15-1.4-1.291.79l-4.276 2.624V4.697l5.562 3.42zM16 4.697v7.104l-5.803-3.558zM9.031 8.83l1.291.79 4.276 2.624V4.697l-5.562 3.42z"/></svg>'
};

// Default state
const defaultState = {
    library: [],
    ui: {
        currentFolderId: 'root',
        // 'editor' or 'library'
        activeSection: 'editor' 
    }
};

// Globals
let DOMElements;
let state;
let saveState;
let currentFolderId = 'root';

// --- Recursive Finders ---
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
    if (id === 'root') return { id: 'root', name: 'Root', children: state.library };
    const result = findInTree(state.library, i => i.id === id);
    return result ? result.item : null;
}

function findParentOfItem(childId) {
    if (childId === 'root') return null; 
    const result = findInTree(state.library, i => i.id === childId);
    return result ? (result.parent || {id: 'root', children: state.library}) : null;
}

// --- UX Logic ---
function setActiveSection(sectionName) {
    const libSec = document.getElementById('library-section');
    const editSec = document.getElementById('editor-section');
    
    if (sectionName === 'library') {
        libSec.classList.add('expanded');
        libSec.classList.remove('collapsed');
        editSec.classList.remove('expanded');
        editSec.classList.add('collapsed');
    } else {
        editSec.classList.add('expanded');
        editSec.classList.remove('collapsed');
        libSec.classList.remove('expanded');
        libSec.classList.add('collapsed');
    }
    
    if (state.ui) { state.ui.activeSection = sectionName; saveState(); }
}

function clearEditorFields() {
    ['result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body', 'result-mailto', 'save-template-name'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    
    const fileInput = document.getElementById('msg-upload');
    if (fileInput) fileInput.value = '';
    
    document.getElementById('output-wrapper').classList.add('hidden');
    SafeUI.showToast("Editor cleared");
}

// --- Mailto Logic ---
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

// --- File Handling ---
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

// --- Navigation ---
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
            div.innerHTML = `<div class="list-item-icon ${item.type === 'folder'?'folder':'template'}">${ICONS[item.type === 'folder' ? 'folder' : 'template']}</div>
                             ${item.type === 'folder' 
                                ? `<span class="list-item-name-folder">${SafeUI.escapeHTML(item.name)}</span>` 
                                : `<a href="${SafeUI.escapeHTML(item.mailto)}" class="list-item-name">${SafeUI.escapeHTML(item.name)}</a>`
                             }
                             <div class="list-item-actions">
                                ${item.type === 'item' ? `<button class="icon-btn copy-btn" data-mailto="${SafeUI.escapeHTML(item.mailto)}">${SafeUI.SVGIcons.copy}</button>` : ''}
                                <button class="icon-btn move-btn" title="${item.type === 'folder' ? 'Rename Folder' : 'Edit/Load Template'}">${SafeUI.SVGIcons.pencil}</button>
                                <button class="icon-btn delete-btn">${SafeUI.SVGIcons.trash}</button>
                             </div>`;
            return div;
        }
    });
}

async function init() {
    console.log(`[MailTo] Initializing v${APP_CONFIG.VERSION}`);
    
    if (typeof SafeUI === 'undefined') { return; } // Safety check

    // Fetch Navbar
    try {
        const resp = await fetch('navbar.html');
        if (resp.ok) {
            document.getElementById('navbar-container').innerHTML = await resp.text();
            new Function(document.getElementById('navbar-container').querySelector('script').innerHTML)();
        }
    } catch(e) { console.error("Navbar load error", e); }

    const ctx = await AppLifecycle.initPage({
        storageKey: APP_CONFIG.DATA_KEY,
        defaultState: defaultState,
        version: APP_CONFIG.VERSION,
        requiredElements: [
            'navbar-container', 'btn-new-folder', 'btn-settings', 'breadcrumb-container', 'tree-list-container',
            'btn-generate', 'upload-wrapper', 'msg-upload', 'result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body',
            'output-wrapper', 'result-link', 'result-mailto', 'copy-mailto-btn', 'save-template-name', 'btn-save-to-library',
            'library-header', 'editor-header', 'btn-clear-all'
        ]
    });

    if (!ctx) return; 
    ({ elements: DOMElements, state, saveState } = ctx);

    // Set Initial Section
    setActiveSection(state.ui.activeSection || 'editor');

    // Accordion Toggles
    document.getElementById('library-header').addEventListener('click', (e) => {
        // Don't toggle if clicking buttons
        if (!e.target.closest('button')) setActiveSection('library');
    });
    document.getElementById('editor-header').addEventListener('click', (e) => {
        if (!e.target.closest('button')) setActiveSection('editor');
    });

    // Clear Button
    DOMElements.btnClearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        UIPatterns.confirmDelete('Form Data', 'Current Content', () => {
             clearEditorFields();
        });
    });

    // New Folder
    DOMElements.btnNewFolder.addEventListener('click', (e) => {
        e.stopPropagation();
        SafeUI.showModal('New Folder', '<input id="fn" class="sidebar-input">', [{label:'Create', class:'button-primary', callback:()=>{
            const name = document.getElementById('fn').value.trim();
            if(name) {
                const f = findItemById(currentFolderId);
                if(f && f.children) { f.children.push({id: SafeUI.generateId(), type:'folder', name, children:[]}); saveState(); renderCatalogue(); }
            }
        }}, {label:'Cancel'}]);
    });

    // Drag & Drop
    const handleDrag = e => { e.preventDefault(); DOMElements.uploadWrapper.classList.toggle('dragover', e.type === 'dragenter' || e.type === 'dragover'); };
    const handleDrop = e => { handleDrag(e); if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); };
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => DOMElements.uploadWrapper.addEventListener(evt, evt === 'drop' ? handleDrop : handleDrag));
    DOMElements.msgUpload.addEventListener('change', e => { if(e.target.files.length) handleFile(e.target.files[0]); });

    // Generate
    DOMElements.btnGenerate.addEventListener('click', () => {
        const d = {
            to: DOMElements.resultTo.value, cc: DOMElements.resultCc.value, bcc: DOMElements.resultBcc.value,
            subject: DOMElements.resultSubject.value, body: DOMElements.resultBody.value
        };
        const m = buildMailto(d);
        if (m.length > 2000) SafeUI.showToast("Warning: Link length > 2000 chars");

        DOMElements.resultMailto.value = m;
        DOMElements.resultLink.href = m;
        DOMElements.outputWrapper.classList.remove('hidden');
        
        // Auto-scroll to bottom of editor container
        document.querySelector('#editor-section .accordion-content').scrollTop = 9999;
    });

    // Copy
    DOMElements.copyMailtoBtn.addEventListener('click', () => {
        SafeUI.copyToClipboard(DOMElements.resultMailto.value);
        SafeUI.showToast("Copied");
    });

    // Save Template
    DOMElements.btnSaveToLibrary.addEventListener('click', () => {
        // Ensure output is generated first
        if (!DOMElements.resultMailto.value) DOMElements.btnGenerate.click();
        
        const name = DOMElements.saveTemplateName.value.trim() || DOMElements.resultSubject.value.trim() || "New Template";
        const f = findItemById(currentFolderId);
        if(f) {
            f.children.push({
                id: SafeUI.generateId(), type:'item', name, 
                mailto: DOMElements.resultMailto.value
            });
            saveState(); renderCatalogue();
            SafeUI.showToast("Saved to Library");
        }
    });

    // Tree Navigation
    DOMElements.treeListContainer.addEventListener('click', e => {
        const itemEl = e.target.closest('.list-item');
        if(!itemEl) return;
        const id = itemEl.dataset.id;
        const item = findItemById(id); 
        if(!item) return;

        if(e.target.closest('.list-item-name-folder') || e.target.closest('.list-item-icon.folder')) { 
            currentFolderId = item.id; renderCatalogue(); return;
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
                    saveState(); renderCatalogue(); 
                }
            });
            return;
        }

        if(e.target.closest('.move-btn')) {
            if (item.type === 'folder') {
                // Rename logic...
            } else {
                const parsed = parseMailto(item.mailto);
                DOMElements.resultTo.value = parsed.to || '';
                DOMElements.resultCc.value = parsed.cc || '';
                DOMElements.resultBcc.value = parsed.bcc || '';
                DOMElements.resultSubject.value = parsed.subject || '';
                DOMElements.resultBody.value = parsed.body || '';
                DOMElements.saveTemplateName.value = item.name;
                
                setActiveSection('editor');
                SafeUI.showToast("Loaded");
            }
        }
    });

    DOMElements.breadcrumbContainer.addEventListener('click', e => {
        if(e.target.dataset.id) { currentFolderId = e.target.dataset.id; renderCatalogue(); }
    });

    renderCatalogue();
    
    // Settings Modal (CSV) logic kept same as before...
    SharedSettingsModal.init({
        buttonId: 'btn-settings', appName: APP_CONFIG.NAME, state,
        pageSpecificDataHtml: `<button id="exp" class="button-base">Export CSV</button><button id="imp" class="button-base">Import CSV</button>`,
        onModalOpen: () => {
            CsvManager.setupExport({exportBtn: document.getElementById('exp'), headers: APP_CONFIG.CSV_HEADERS, dataGetter: ()=>[], filename:'export.csv'});
            CsvManager.setupImport({
                importBtn: document.getElementById('imp'), 
                headers: APP_CONFIG.CSV_HEADERS, 
                onValidate: (r) => (r.name ? {entry: r} : null), 
                onConfirm: (d)=>{}
            });
        },
        onRestoreCallback: (d) => { state.library = d.library; saveState(); renderCatalogue(); }
    });

    console.log("[MailTo] Ready");
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
