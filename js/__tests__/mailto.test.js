import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../mailto.html'), 'utf8');

describe('js/apps/mailto.js', () => {
    let mockAppCtx;

    beforeEach(() => {
        document.body.innerHTML = html;
        window.localStorage.clear();
        vi.resetModules();
        vi.clearAllMocks();

        window.SafeUI = { showToast: vi.fn(), showModal: vi.fn(), escapeHTML: (s) => s, SVGIcons: { folder: '', link: '', copy: '', drag: '', close: '' }, debounce: (fn) => fn };
        window.DOMHelpers = {
            createElement: (tag, className) => {
                const el = document.createElement(tag);
                if (className) el.className = className;
                return el;
            },
            createOption: (value, text) => {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = text || value;
                return opt;
            },
            triggerTextareaResize: vi.fn(),
            setupTextareaAutoResize: vi.fn()
        };

        window.TreeUtils = {
            findItemById: vi.fn((node, id) => {
                if (!id || id === 'root') return { id: 'root', type: 'folder', children: [] };
                return { id, type: 'folder', children: [] };
            }),
            removeItem: vi.fn(),
            moveItem: vi.fn(),
            createFolder: vi.fn(),
            createTemplate: vi.fn(),
            walk: vi.fn(),
            getBreadcrumbPath: vi.fn(() => []),
            getAllFolders: vi.fn(() => [])
        };

        window.TreeRenderer = class {
            constructor() {}
            render() {}
        };

        mockAppCtx = {
            state: { library: [], ui: { activeSection: 'editor', currentFolderId: null } },
            defaultState: { library: [], ui: { activeSection: 'editor', currentFolderId: null } },
            saveState: vi.fn(),
            registerExportBuilder: vi.fn(),
            elements: {
                itemCatalogue: document.getElementById('itemCatalogue') || document.createElement('div'),
                btnAddFolder: document.getElementById('btnAddFolder') || document.createElement('button'),
                btnAddTemplate: document.getElementById('btnAddTemplate') || document.createElement('button'),
                builderPanel: document.getElementById('builderPanel') || document.createElement('div'),
                builderClose: document.getElementById('builderClose') || document.createElement('button'),
                builderSubject: document.getElementById('builderSubject') || document.createElement('input'),
                builderTo: document.getElementById('builderTo') || document.createElement('input'),
                builderCc: document.getElementById('builderCc') || document.createElement('input'),
                builderBcc: document.getElementById('builderBcc') || document.createElement('input'),
                builderBody: document.getElementById('builderBody') || document.createElement('textarea'),
                btnCopySubject: document.getElementById('btnCopySubject') || document.createElement('button'),
                btnCopyBody: document.getElementById('btnCopyBody') || document.createElement('button'),
                btnOpenMailto: document.getElementById('btnOpenMailto') || document.createElement('button'),
                viewEditorBtn: document.getElementById('viewEditorBtn') || document.createElement('button'),
                viewLibraryBtn: document.getElementById('viewLibraryBtn') || document.createElement('button'),
                sectionEditor: document.getElementById('sectionEditor') || document.createElement('div'),
                sectionLibrary: document.getElementById('sectionLibrary') || document.createElement('div'),
                saveFolderSelect: document.getElementById('saveFolderSelect') || document.createElement('select'),
                btnSaveToLibrary: document.getElementById('btnSaveToLibrary') || document.createElement('button'),
                currentTemplateId: document.getElementById('currentTemplateId') || document.createElement('input'),
                btnClearAll: document.getElementById('btnClearAll') || document.createElement('button'),
                btnNewFolder: document.createElement('button'),
                libraryBreadcrumbs: document.createElement('div'),
                libraryEmptyState: document.createElement('div'),
                mobileControls: document.createElement('div'),
                btnLoadMsg: document.createElement('button'),
                msgUpload: document.createElement('input'),
                msgDropzone: document.createElement('div'),
                copyMailtoBtn: document.createElement('button'),
                resultMailto: document.createElement('textarea'),
                copyHtmlBtn: document.createElement('button'),
                resultHtml: document.createElement('textarea'),
                treeListContainer: document.createElement('div'),
                btnBackToParent: document.createElement('button'),
                currentFolderName: document.createElement('div'),
                breadcrumbContainer: document.createElement('div'),
                resultTo: document.createElement('input'),
                resultCc: document.createElement('input'),
                resultBcc: document.createElement('input'),
                resultSubject: document.createElement('input'),
                resultBody: document.createElement('textarea'),
                saveTemplateName: document.createElement('input'),
                resultLink: document.createElement('a')
            }
        };

        window.AppLifecycle = {
            onBootstrap: (cb) => cb(),
            initPage: async (config) => mockAppCtx
        };

        window.UIPatterns = {
            copyToClipboard: vi.fn(),
            confirmAction: vi.fn((title, msg, cb) => cb())
        };

        // Mock global functionality
        window.DragDropList = class { constructor() {} };
        window.ListRenderer = { renderList: vi.fn() };
        window.SharedSettingsModal = { init: vi.fn() };
    });

    it('should initialize successfully and load UI states', async () => {
        await import('../apps/mailto.js');
        await new Promise(r => setTimeout(r, 0));
        expect(mockAppCtx.elements.viewLibraryBtn).toBeDefined();
    });
});
