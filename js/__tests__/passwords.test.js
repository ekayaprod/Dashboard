import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('js/apps/passwords.js', () => {
    let dom;
    let renderListMock;

    const setupMocks = () => {
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
            <span id="seasonal-range-inline"></span>
        `;

        window.AppLifecycle = {
            onBootstrap: (cb) => { window._initPage = cb; },
            initPage: async (config) => {
                return {
                    elements: window.DOMHelpers.cacheElements(config.requiredElements).elements,
                    state: config.defaultState,
                    saveState: vi.fn()
                };
            },
            showStartupError: vi.fn()
        };

        window.SafeUI = {
            fetchJSON: vi.fn().mockResolvedValue({ wordBank: { "LongWord": ["test"], "Object": ["obj"] } }),
            getRandomInt: (max) => 0, // Deterministic for testing
            capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1),
            escapeHTML: (s) => s,
            generateId: () => '123',
            showToast: vi.fn(),
            validators: { notEmpty: () => true, maxLength: () => true },
            SVGIcons: { plus: '+', copy: 'c', settings: 's' }
        };

        renderListMock = vi.fn().mockImplementation(() => console.log('ListRenderer.renderList called'));
        window.ListRenderer = {
            renderList: renderListMock
        };

        window.DOMHelpers = {
             cacheElements: (ids) => {
                 const elements = {};
                 ids.forEach(id => {
                     const key = id.replace(/-(\w)/g, (m, c) => c.toUpperCase());
                     elements[key] = document.getElementById(id);
                 });
                 return { elements, allFound: true };
             }
        };

        window.QuickListManager = { init: vi.fn() };
        window.SharedSettingsModal = { init: vi.fn() };
        window.DataValidator = { hasDuplicate: () => false };
        window.UIPatterns = { copyToClipboard: vi.fn(), confirmDelete: vi.fn() };
    };

    beforeAll(() => {
        setupMocks();
        const scriptPath = path.resolve(__dirname, '../apps/passwords.js');
        let scriptContent = fs.readFileSync(scriptPath, 'utf8');
        // Expose helpers
        scriptContent += '; window.PasswordLogic = PasswordLogic; window.PasswordUI = PasswordUI;';
        new Function(scriptContent)();
    });

    beforeEach(() => {
        setupMocks();
    });

    describe('PasswordLogic', () => {
        it('should be exposed', () => {
            expect(window.PasswordLogic).toBeDefined();
        });

        describe('getCurrentSeason', () => {
            it('should return a valid season', () => {
                const season = window.PasswordLogic.getCurrentSeason();
                expect(['spring', 'summer', 'autumn', 'winter', 'none']).toContain(season);
            });
        });

        describe('getAvailableStructures', () => {
            it('should return structures based on available categories', () => {
                const activeWordBank = { "LongWord": ["word"] };
                const seasonKey = 'standard';
                const structures = window.PasswordLogic.getAvailableStructures(activeWordBank, seasonKey);

                // Standard season has "1" word structure using "LongWord"
                expect(structures["1"]).toBeDefined();
                expect(structures["1"].length).toBeGreaterThan(0);

                // Should not have structures requiring missing categories (e.g. Adjective)
                // "2" word structure requires Adjective/Animal or Color/Object
                // Our mock bank only has LongWord
                expect(structures["2"]).toEqual([]);
            });
        });

        describe('generatePassphrase', () => {
            const context = {
                wordBank: { "LongWord": ["Testing"], "Object": ["Object"] },
                symbolRules: { "end": ["!"] },
                structures: {
                    "1": [{ categories: ["LongWord"] }]
                }
            };

            it('should generate a passphrase', () => {
                const config = {
                    passNumWords: 1,
                    passNumDigits: 0,
                    passNumSymbols: 0,
                    passSeparator: '-',
                    minLength: 5,
                    maxLength: 20
                };
                // Mock getRandomInt to pick first item (index 0)
                window.SafeUI.getRandomInt = () => 0;

                const result = window.PasswordLogic.generatePassphrase(config, context);
                expect(result).toBe("testing");
            });

            it('should handle length constraints', () => {
                const config = {
                    passNumWords: 1,
                    passNumDigits: 0,
                    passNumSymbols: 0,
                    passSeparator: '',
                    minLength: 50, // Impossible
                    maxLength: 60
                };
                const result = window.PasswordLogic.generatePassphrase(config, context);
                // Should retry and fail
                expect(result).toContain("Retry limit hit");
            });

            it('should add digits and symbols', () => {
                const config = {
                    passNumWords: 1,
                    passNumDigits: 2, // 00
                    passNumSymbols: 1, // !
                    passSymPlacement: 'suffix',
                    passSeparator: '',
                    minLength: 5,
                    maxLength: 20
                };
                // Mock random to be consistent
                // Word: Testing (7 chars)
                // Digits: 0, 0
                // Symbols: ! (from symbolRules['end'])
                // Placement: Suffix -> Testing00!

                window.SafeUI.getRandomInt = () => 0;

                const result = window.PasswordLogic.generatePassphrase(config, context);
                // Depending on placement logic (start vs end for digits), might vary.
                // With random=0, passNumPlacement defaults to 'start' or 'end' or random.
                // Logic says: if (C.passNumPlacement === 'start') ... else ... (SafeUI.getRandomInt(2) === 0)
                // If random returns 0, it places at start if random choice.

                // Let's just check it contains the parts
                expect(result).toContain("Testing");
                expect(result).toContain("00");
                expect(result).toContain("!");
            });
        });
    });

    describe('PasswordUI', () => {
        it('should be exposed', () => {
            expect(window.PasswordUI).toBeDefined();
        });

        it('updateStructureOptions should populate select element', () => {
            const domElements = {
                passNumWords: { value: "1" },
                passStructure: document.createElement('select')
            };
            const availableStructures = {
                "1": [{ categories: ["A"], label: "Test" }]
            };

            window.PasswordUI.updateStructureOptions(domElements, availableStructures);

            expect(domElements.passStructure.children.length).toBe(2); // Random + 1 option
            expect(domElements.passStructure.children[1].textContent).toContain("Test");
        });
    });

    describe('Integration', () => {
        it('should initialize correctly', async () => {
            await window._initPage();
            // Wait for async IIFE
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(renderListMock).toHaveBeenCalled();
        });

        it('should log a warning when localStorage fails during accordion toggle', async () => {
            await window._initPage();

            const warnSpy = vi.spyOn(console, 'warn');
            const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceeded');
            });

            // Trigger click
            const toggleBtn = document.getElementById('accordion-toggle');
            toggleBtn.click();

            expect(setItemSpy).toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('accordion state'), expect.any(Error));

            warnSpy.mockRestore();
            setItemSpy.mockRestore();
        });
    });
});
