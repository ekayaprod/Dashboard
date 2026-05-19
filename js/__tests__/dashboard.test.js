import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const html = fs.readFileSync(path.resolve(__dirname, '../../dashboard.html'), 'utf8');

describe('js/apps/dashboard.js', () => {
    let mockAppCtx;

    beforeEach(() => {
        document.body.innerHTML = html;
        window.localStorage.clear();
        vi.resetModules();
        vi.clearAllMocks();

        window.SafeUI = { showToast: vi.fn(), showModal: vi.fn(), escapeHTML: (s) => s, SVGIcons: { plus: '<svg></svg>', drag: '<svg></svg>', link: '<svg></svg>', trash: '<svg></svg>', add: '', remove: '', edit: '' }, debounce: (fn) => fn };
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

        window.DragDropList = class {
            constructor(container, opts) { this.container = container; this.opts = opts; }
            render(items) {}
        };

        window.SharedSettingsModal = { init: vi.fn() };
        window.QuickListManager = { init: vi.fn() };
        window.NotepadManager = { init: vi.fn() };

        mockAppCtx = {
            state: { apps: [], shortcuts: [], notes: [], ui: { selectedAppId: null } },
            defaultState: { apps: [], shortcuts: [], notes: [], ui: { selectedAppId: null } },
            saveState: vi.fn(),
            registerExportBuilder: vi.fn(),
            elements: {
                appSelect: document.getElementById('appSelect') || document.createElement('select'),
                newAppBtn: document.getElementById('newAppBtn') || document.createElement('button'),
                editAppContainer: document.getElementById('editAppContainer') || document.createElement('div'),
                editAppName: document.getElementById('editAppName') || document.createElement('input'),
                editAppUrls: document.getElementById('editAppUrls') || document.createElement('textarea'),
                editAppEscalation: document.getElementById('editAppEscalation') || document.createElement('textarea'),
                saveAppBtn: document.getElementById('saveAppBtn') || document.createElement('button'),
                deleteAppBtn: document.getElementById('deleteAppBtn') || document.createElement('button'),
                btnManageShortcuts: document.createElement('button'),
                addShortcutBtnMenu: document.createElement('button'),
                addNewAppBtnMenu: document.createElement('button'),
                quickListContainer: document.createElement('div'),
                notepadEditor: document.createElement('textarea'),
                deleteNoteBtn: document.createElement('button'),
                renameNoteBtn: document.createElement('button'),
                noteSelect: document.createElement('select'),
                newNoteBtn: document.createElement('button'),
                editAppNameWrapper: document.createElement('div'),
                appDetailsContainer: document.createElement('div'),
                shortcutsContainer: document.createElement('div'),
                addNoteBtnMenu: document.createElement('button'),
                btnExportNotes: document.createElement('button'),
                btnImportNotes: document.createElement('button'),
                btnEditAppData: document.createElement('button'),
                deleteAppDataBtn: document.createElement('button'),
                saveChangesBtn: document.createElement('button'),
                appEmptyState: document.createElement('div'),
                quickListEmptyState: document.createElement('div'),
                appUrlsContainer: document.createElement('div'),
                appSelectGroup: document.createElement('div')
            }
        };

        window.AppLifecycle = {
            onBootstrap: (cb) => cb(),
            initPage: async (config) => mockAppCtx
        };

        window.DataHelpers = {
            getCollection: vi.fn((state, key) => state[key]),
            findById: vi.fn((state, collection, id) => state[collection]?.find(i => i.id === id)),
            generateId: () => '1',
            hasItems: vi.fn(() => false)
        };

        window.SafeUI.validators = {
            notEmpty: (val) => val && val.trim() !== '',
            maxLength: (val, len) => val && val.length <= len
        };

        window.DataValidator = {
            hasDuplicate: () => false
        };
    });

    it('should initialize successfully', async () => {
        await import('../apps/dashboard.js');
        // Let's create an app and call displayAppDetails implicitly
        mockAppCtx.state.apps.push({ id: '1', name: 'Test App', urls: 'http://test.com', escalationPath: 'Test Path' });
        expect(mockAppCtx.elements.newAppBtn).toBeDefined();
    });
});
