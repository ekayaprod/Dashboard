import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('js/apps/passwords.js - Resilience', () => {
    let dom;

    beforeAll(() => {
        // Mock DOM
        document.body.innerHTML = `
            <div id="quick-actions-container"></div>
            <button id="btn-add-quick-copy"></button>
            <button id="btn-add-preset"></button>
            <button id="btn-quick-generate-temp"></button>
            <div id="tab-content-passphrase"></div>
            <input id="passNumWords" value="4" />
            <input id="passSeparator" />
            <select id="seasonal-bank-select"><option value="standard">Standard</option></select>
            <input id="passNumDigits" value="0" />
            <input id="passNumSymbols" value="0" />
            <select id="passNumPlacement"><option value="end">End</option></select>
            <select id="passSymPlacement"><option value="end">End</option></select>
            <input id="passMinLength" value="10" />
            <input id="passMaxLength" value="20" />
            <input id="passPadToMin" type="checkbox" />
            <select id="passStructure"><option value="-1">Random</option></select>
            <button id="btn-generate"></button>
            <div id="results-list"></div>
            <button id="btn-settings"></button>
            <div id="toast"></div>
            <div id="modal-overlay"></div>
            <div id="modal-content"></div>
            <div class="accordion">
                <button id="custom-gen-header"></button>
                <button id="accordion-toggle"></button>
                <div id="custom-generator-config"></div>
            </div>
            <div id="active-season-display"></div>
        `;

        // Mock AppLifecycle
        window.AppLifecycle = {
            onBootstrap: (cb) => { window._initPage = cb; }, // Capture the init function
            initPage: async (config) => {
                // Return mock context
                return {
                    elements: window.DOMHelpers.cacheElements(config.requiredElements).elements,
                    state: config.defaultState,
                    saveState: vi.fn()
                };
            },
            showStartupError: vi.fn()
        };

        // Mock SafeUI
        window.SafeUI = {
            fetchJSON: vi.fn().mockResolvedValue({ wordBank: { "LongWord": ["test"] } }),
            getRandomInt: (max) => 0,
            capitalize: (s) => s,
            escapeHTML: (s) => s,
            generateId: () => '123',
            showToast: vi.fn(),
            validators: { notEmpty: () => true, maxLength: () => true },
            SVGIcons: { plus: '+', copy: 'c', settings: 's' }
        };

        // Mock ListRenderer
        window.ListRenderer = { renderList: vi.fn() };

        // Mock DOMHelpers
        window.DOMHelpers = {
             cacheElements: (ids) => {
                 const elements = {};
                 ids.forEach(id => {
                     // Handle camelCase conversion for hyphenated IDs
                     const key = id.replace(/-(\w)/g, (m, c) => c.toUpperCase());
                     elements[key] = document.getElementById(id);
                 });
                 return { elements, allFound: true };
             }
        };

        // Mock QuickListManager
        window.QuickListManager = { init: vi.fn() };

        // Mock SharedSettingsModal
        window.SharedSettingsModal = { init: vi.fn() };

        // Mock DataValidator
        window.DataValidator = { hasDuplicate: () => false };

        // Mock UIPatterns
        window.UIPatterns = { copyToClipboard: vi.fn(), confirmDelete: vi.fn() };
    });

    it('should log a warning when localStorage fails during accordion toggle', async () => {
        // Load the script
        const scriptPath = path.resolve(__dirname, '../apps/passwords.js');
        const scriptContent = fs.readFileSync(scriptPath, 'utf8');
        new Function(scriptContent)();

        // Run initialization
        await window._initPage();

        // Spy on console.warn
        const warnSpy = vi.spyOn(console, 'warn');

        // Mock localStorage.setItem to throw
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceeded');
        });

        // Trigger click
        const toggleBtn = document.getElementById('accordion-toggle');
        toggleBtn.click();

        // Assert
        expect(setItemSpy).toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('accordion state'), expect.any(Error));

        warnSpy.mockRestore();
        setItemSpy.mockRestore();
    });
});
