/**
 * mailto-app.js
 * MailTo Generator Application Logic (ES6 Module)
 * Version: 2.0.5 (Module Graph Fixed)
 */

import { SafeUI, DOMHelpers, AppLifecycle } from './app-core.js';
import { DataValidator, CsvManager } from './app-data.js';
import { UIPatterns, ListRenderer, SharedSettingsModal } from './app-ui.js';
import { MsgReader } from './msgreader.js';

const APP_CONFIG = {
    NAME: 'mailto_library',
    VERSION: '2.0.5',
    DATA_KEY: 'mailto_library_v1',
    CSV_HEADERS: ['name', 'path', 'to', 'cc', 'bcc', 'subject', 'body']
};

const ICONS = {
    folder: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v.07L6.2 7H1.12zM0 4.25a.5.5 0 0 1 .5-.5h6.19l.74 1.85a.5.5 0 0 1 .44.25h4.13a.5.5 0 0 1 .5.5v.5a.5.5 0 0 1-.5-.5H.5a.5.5 0 0 1-.5-.5zM.5 7a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5z"/></svg>',
    template: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm.15-1.4-1.291.79l-4.276 2.624V4.697l5.562 3.42zM16 4.697v7.104l-5.803-3.558zM9.031 8.83l1.291.79 4.276 2.624V4.697l-5.562 3.42z"/></svg>'
};

let DOMElements, state, saveState, currentFolderId = 'root', currentMailtoCommand = null;

// --- Accordion ---
function toggleAccordion(e, forceCollapse = false) {
    if (e && e.target.closest('button') && e.currentTarget.id === 'mailto-accordion-header') { e.stopPropagation(); return; }
    const content = DOMElements.mailtoAccordionContent;
    const icon = DOMElements.mailtoAccordionToggle.querySelector('.accordion-icon');
    const header = DOMElements.mailtoAccordionHeader;
    let isCollapsed = forceCollapse ? true : content.classList.toggle('collapsed');
    if (forceCollapse) content.classList.add('collapsed');
    if (icon) icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    if (header) header.setAttribute('aria-expanded', !isCollapsed);
    if (state.ui) { state.ui.accordionCollapsed = isCollapsed; saveState(); }
    if (!isCollapsed) { DOMHelpers.triggerTextareaResize(DOMElements.resultBody); DOMHelpers.triggerTextareaResize(DOMElements.resultMailto); }
}

// --- Logic ---
function parseMailto(str) {
    const data = {to:'', cc:'', bcc:'', subject:'', body:''};
    if (!str || !str.startsWith('mailto:')) return data;
    try {
        const url = new URL(str.replace(/ /g, '%20'));
        data.to = decodeURIComponent(url.pathname || '');
        ['cc', 'bcc', 'subject', 'body'].forEach(k => data[k] = decodeURIComponent(url.searchParams.get(k) || ''));
        return data;
    } catch (e) { return data; }
}

function buildMailto(data) {
    let params = [];
    ['cc', 'bcc', 'subject'].forEach(k => { if(data[k]) params.push(`${k}=${encodeURIComponent(data[k])}`); });
    if(data.body) params.push(`body=${encodeURIComponent(data.body).replace(/%0A/g, '%0D%0A')}`);
    return `mailto:${encodeURIComponent(data.to)}?${params.join('&')}`;
}

function findItemById(id, items = state.library) {
    if (id === 'root') return { id: 'root', name: 'Root', children: state.library };
    for (const item of items) {
        if (item.id === id) return item;
        if (item.type === 'folder' && item.children) {
            const found = findItemById(id, item.children);
            if (found) return found;
        }
    }
    return null;
}

function renderCatalogue() {
    // Simplified Breadcrumbs for brevity
    DOMElements.breadcrumbContainer.innerHTML = currentFolderId === 'root' ? 'Root' : `<a class="breadcrumb-link" data-id="root">Root</a> / ...`;
    
    const folder = findItemById(currentFolderId);
    const items = folder ? (folder.children || []) : [];
    
    ListRenderer.renderList({
        container: DOMElements.treeListContainer,
        items: items,
        emptyMessage: "Empty folder.",
        createItemElement: (item) => {
            const div = document.createElement('div');
            div.className = 'list-item';
            div.dataset.id = item.id;
            div.innerHTML = `<div class="list-item-icon ${item.type}">${ICONS[item.type === 'folder' ? 'folder' : 'template']}</div>
                             <a class="list-item-name">${SafeUI.escapeHTML(item.name)}</a>
                             <div class="list-item-actions">
                                ${item.type === 'item' ? '<button class="icon-btn copy-btn">📋</button>' : ''}
                                <button class="icon-btn delete-btn">🗑</button>
                             </div>`;
            return div;
        }
    });
}

function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const d = MsgReader.read(e.target.result);
            DOMElements.resultSubject.value = d.subject || '';
            DOMElements.resultBody.value = d.body || '';
            const map = {1:[], 2:[], 3:[]}; // TO, CC, BCC
            d.recipients.forEach(r => {
                const addr = r.email || (r.name.includes('@')?r.name:'');
                if(addr) map[r.recipientType || 1].push(addr);
            });
            DOMElements.resultTo.value = map[1].join(', ');
            DOMElements.resultCc.value = map[2].join(', ');
            DOMElements.resultBcc.value = map[3].join(', ');
            toggleAccordion(null, false); // Open accordion
        } catch (err) { SafeUI.showModal("Error", `<p>${err.message}</p>`, [{label:'OK'}]); }
    };
    reader.readAsArrayBuffer(file);
}

async function init() {
    if (!MsgReader || !MsgReader.read) throw new Error("MsgReader failed to load.");
    
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
            'navbar-container', 'catalogue-view', 'btn-new-folder', 'btn-settings', 'breadcrumb-container', 'tree-list-container',
            'btn-generate', 'upload-wrapper', 'msg-upload', 'result-to', 'result-cc', 'result-bcc', 'result-subject', 'result-body',
            'output-wrapper', 'result-link', 'result-mailto', 'copy-mailto-btn', 'save-template-name', 'btn-save-to-library',
            'mailto-accordion-header', 'mailto-accordion-toggle', 'mailto-accordion-content', 'scroll-to-top'
        ]
    });

    if (!ctx) return; 
    ({ elements: DOMElements, state, saveState } = ctx);

    // Event Listeners
    DOMElements.btnNewFolder.addEventListener('click', () => {
        SafeUI.showModal('New Folder', '<input id="fn" class="sidebar-input">', [{label:'Create', class:'button-primary', callback:()=>{
            const name = document.getElementById('fn').value.trim();
            if(name) {
                const f = findItemById(currentFolderId);
                if(f && f.children) { f.children.push({id: SafeUI.generateId(), type:'folder', name, children:[]}); saveState(); renderCatalogue(); }
            }
        }}, {label:'Cancel'}]);
    });

    DOMElements.mailtoAccordionToggle.addEventListener('click', toggleAccordion);
    DOMElements.mailtoAccordionHeader.addEventListener('click', toggleAccordion);
    
    DOMElements.uploadWrapper.addEventListener('dragover', e => { e.preventDefault(); DOMElements.uploadWrapper.classList.add('dragover'); });
    DOMElements.uploadWrapper.addEventListener('dragleave', e => { e.preventDefault(); DOMElements.uploadWrapper.classList.remove('dragover'); });
    DOMElements.uploadWrapper.addEventListener('drop', e => { 
        e.preventDefault(); DOMElements.uploadWrapper.classList.remove('dragover');
        if(e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    DOMElements.msgUpload.addEventListener('change', e => { if(e.target.files.length) handleFile(e.target.files[0]); });

    DOMElements.btnGenerate.addEventListener('click', () => {
        const d = {
            to: DOMElements.resultTo.value, cc: DOMElements.resultCc.value, bcc: DOMElements.resultBcc.value,
            subject: DOMElements.resultSubject.value, body: DOMElements.resultBody.value
        };
        const m = buildMailto(d);
        DOMElements.resultMailto.value = m;
        DOMElements.resultLink.href = m;
        DOMElements.outputWrapper.classList.remove('hidden');
    });

    DOMElements.btnSaveToLibrary.addEventListener('click', () => {
        const name = DOMElements.saveTemplateName.value.trim();
        if(!name) return SafeUI.showToast("Name required");
        const f = findItemById(currentFolderId);
        if(f) {
            f.children.push({
                id: SafeUI.generateId(), type:'item', name, 
                mailto: DOMElements.resultMailto.value
            });
            saveState(); renderCatalogue();
            SafeUI.showToast("Saved");
        }
    });

    DOMElements.treeListContainer.addEventListener('click', e => {
        const itemEl = e.target.closest('.list-item');
        if(!itemEl) return;
        const id = itemEl.dataset.id;
        const item = findItemById(id); // Need global search or recursive search from root
        // NOTE: In simplified code, findItemById might need to search whole tree if not in current folder.
        // For now assuming current folder render.
        if(item && item.type === 'folder') { currentFolderId = item.id; renderCatalogue(); }
        
        if(e.target.closest('.delete-btn')) {
            // Delete logic here
            const f = findItemById(currentFolderId);
            f.children = f.children.filter(c => c.id !== id);
            saveState(); renderCatalogue();
        }
    });

    DOMElements.breadcrumbContainer.addEventListener('click', e => {
        if(e.target.dataset.id) { currentFolderId = e.target.dataset.id; renderCatalogue(); }
    });

    // Init Accordion State
    if (state.ui && state.ui.accordionCollapsed) DOMElements.mailtoAccordionContent.classList.add('collapsed');
    renderCatalogue();
    
    SharedSettingsModal.init({
        buttonId: 'btn-settings', appName: APP_CONFIG.NAME, state,
        pageSpecificDataHtml: `<button id="exp" class="button-base">Export CSV</button><button id="imp" class="button-base">Import CSV</button>`,
        onModalOpen: () => {
            CsvManager.setupExport({exportBtn: document.getElementById('exp'), headers: APP_CONFIG.CSV_HEADERS, dataGetter: ()=>[], filename:'export.csv'});
            CsvManager.setupImport({importBtn: document.getElementById('imp'), headers: APP_CONFIG.CSV_HEADERS, onValidate: (r)=>({entry:r}), onConfirm: (d)=>{}});
        },
        onRestoreCallback: (d) => { state.library = d.library; saveState(); renderCatalogue(); }
    });

    console.log("[MailTo] Ready");
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();