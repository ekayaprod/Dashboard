// ============================================================================
// PAGE-SPECIFIC LOGIC: Passwords (passwords.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'passwords',
        VERSION: '1.4.10',
        DATA_KEY: 'passwords_v1_data',
    };

    console.log(`AppLifecycle: Running passwords.html v${APP_CONFIG.VERSION}`);

    // ====================================================================
    // DEFAULT STATE & LOGIC
    // ====================================================================

    const defaultPhraseStructures = {
        "standard": {
            "1": [["LongWord"]],
            "2": [["Adjective","Animal"],["Color","Object"]],
            "3": [["Adjective","Color","Animal"]],
            "4": [["Adjective","Animal","Color","Verb"]]
        },
        "seasonal": {
            "1": [["Noun"]],
            "2": [["Adjective","Noun"]],
            "3": [["Adjective","Verb","Object"]],
            "4": [["Adjective","Verb","Color","Noun"]]
        }
    };

    const defaultSymbolRules = {"beforeNum":["$","#","*"],"afterNum":["%","+"],"junction":["=","@",".","-"],"end":["!","?"]};

    const defaultState = {
        phraseStructures: defaultPhraseStructures,
        symbolRules: defaultSymbolRules,
        quickCopyItems: [],
        generatorPresets: [],
        customWordBanks: [],
        settings: {},
        ui: {
            selectedBaseBank: 'default'
        }
    };

    (async () => {
        try {
        const ctx = await AppLifecycle.initPage({
            storageKey: APP_CONFIG.DATA_KEY,
            defaultState: defaultState,
            version: APP_CONFIG.VERSION,
            requiredElements: [
                'quick-actions-container', 'btn-add-quick-copy', 'btn-add-preset',
                'btn-quick-generate-temp',
                'tab-content-passphrase',
                'passNumWords', 'passSeparator', 'seasonal-bank-select',
                'passNumDigits', 'passNumSymbols', 'passNumPlacement', 'passSymPlacement',
                'passMinLength', 'passMaxLength', 'passPadToMin',
                'btn-generate',
                'results-list',
                'btn-settings',
                'toast', 'modal-overlay', 'modal-content',
                'custom-gen-header', 'accordion-toggle', 'custom-generator-config',
                'seasonal-info-btn',
                'base-bank-select', 'active-season-display'
            ]
        });

        if (!ctx) return;

        let { elements: DOMElements, state, saveState } = ctx;

        // --- Migration: Remove stale wordBank from storage ---
        if (state.wordBank) {
            console.log('[Passwords] Removing stale persistent wordBank to ensure freshness.');
            delete state.wordBank;
            saveState();
        }

        let generatedPasswords = [];

        let memoryWordBank = null; // Fresh non-persistent cache
        let activeWordBank = {};
        let availableStructures = {};

        const showError = (title, err) => {
            console.error(title, err);
            if (AppLifecycle.showStartupError) {
                AppLifecycle.showStartupError(title, err.message || err);
            } else {
                SafeUI.showModal(title, `<p>${SafeUI.escapeHTML(err.message || err)}</p>`, [{label: 'OK'}]);
            }
        };

        const ACCORDION_STATE_KEY = 'password_generator_accordion_expanded';

        const toggleAccordion = (e) => {
            if (e) {
                if (e.target.closest('button') && e.currentTarget.id === 'custom-gen-header' && e.target.id !== 'accordion-toggle') {
                    e.stopPropagation();
                    return;
                }
            }

            const header = document.getElementById('custom-gen-header');
            const accordion = header ? header.closest('.accordion') : null;

            if (!accordion) return;

            const isExpanded = accordion.classList.toggle('expanded');

            if (header) header.setAttribute('aria-expanded', isExpanded);

            try {
                localStorage.setItem(ACCORDION_STATE_KEY, isExpanded);
            } catch (err) {
                console.warn("Could not save accordion state to localStorage.", err);
            }
        };

        const initAccordion = () => {
            let expanded = true;
            try {
                const savedState = localStorage.getItem(ACCORDION_STATE_KEY);
                if (savedState !== null) {
                    expanded = savedState === 'true';
                }
            } catch (err) {
                console.warn("Could not read accordion state from localStorage.", err);
            }

            const accordion = DOMElements.customGenHeader.closest('.accordion');
            if (accordion) {
                if (expanded) {
                    accordion.classList.add('expanded');
                    DOMElements.customGenHeader.setAttribute('aria-expanded', 'true');
                } else {
                    accordion.classList.remove('expanded');
                    DOMElements.customGenHeader.setAttribute('aria-expanded', 'false');
                }
            }

            if (DOMElements.accordionToggle) {
                DOMElements.accordionToggle.onclick = (e) => {
                    e.stopPropagation();
                    toggleAccordion(null);
                };
            }

            if (DOMElements.customGenHeader) {
                DOMElements.customGenHeader.onclick = (e) => {
                    if (!e.target.closest('#accordion-toggle')) {
                        toggleAccordion(e);
                    }
                };
            }
        };

        // ====================================================================
        // GENERATION LOGIC
        // ====================================================================

        const getRand = (() => {
            let cryptoAvailable = window.crypto && window.crypto.getRandomValues;
            if (!cryptoAvailable) {
                console.warn("Crypto API not available. Falling back to Math.random(). This is not secure for password generation.");
            }

            return (m) => {
                if (cryptoAvailable) {
                    try {
                        const r = new Uint32Array(1);
                        window.crypto.getRandomValues(r);
                        return r[0] % m;
                    } catch (e) {
                        console.error("Crypto API failed, falling back to Math.random() for this call.", e);
                        cryptoAvailable = false;
                    }
                }
                return Math.floor(Math.random() * m);
            };
        })();

        const R = (a) => a[getRand(a.length)];
        const Cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

        const generatePassphrase = (config) => {
            const C = { ...config };

            C.passNumWords = Math.max(0, C.passNumWords || 0);
            C.passNumDigits = Math.max(0, C.passNumDigits || 0);
            C.passNumSymbols = Math.max(0, C.passNumSymbols || 0);
            C.minLength = Math.max(0, C.minLength || 0);
            C.maxLength = Math.max(1, C.maxLength || 1);

            const P_structs = availableStructures;
            const W = activeWordBank;
            const SYMBOL_RULES = state.symbolRules;
            const MAX_RETRIES = 500;
            let retries = 0;

            if (C.minLength > C.maxLength) {
                return "[Min length > Max length]";
            }
            if (!C.passNumWords && !C.passNumDigits && !C.passNumSymbols) {
                return "[No content selected]";
            }

            let resolvedSeason = C.seasonalBank;
            if (C.seasonalBank === 'auto') {
                resolvedSeason = DateUtils.getSeason(new Date());
            }

            let minEstimate = C.passNumDigits + C.passNumSymbols + (C.passNumWords * 4);
            if (C.passNumWords > 1) minEstimate += (C.passNumWords - 1) * C.passSeparator.length;
            if (minEstimate > C.maxLength) return "[Settings exceed Max Length]";

            // Normalize placement configs if undefined (backward compatibility)
            C.passNumPlacement = C.passNumPlacement || 'random';
            C.passSymPlacement = C.passSymPlacement || 'any';

            while (retries < MAX_RETRIES) {
                retries++;
                let words = [];
                let struct;

                if (resolvedSeason && resolvedSeason !== 'none' && P_structs.seasonal && P_structs.seasonal[C.passNumWords] && P_structs.seasonal[C.passNumWords].length > 0) {
                    struct = R(P_structs.seasonal[C.passNumWords]);
                } else if (P_structs.standard && P_structs.standard[C.passNumWords] && P_structs.standard[C.passNumWords].length > 0) {
                    struct = R(P_structs.standard[C.passNumWords]);
                }

                if (!struct || struct.length === 0) {
                    if (C.passNumWords === 0) {
                            struct = [];
                    }
                }

                if (!struct && C.passNumWords > 0) return "[No valid word structure found]";

                words = struct.map(cat => {
                    if (!W[cat] || W[cat].length === 0) {
                        const fallbackCat = W['Object'] ? 'Object' : 'Word';
                        if (fallbackCat === 'Word') return 'Word';
                        return R(W[fallbackCat]);
                    }
                    return R(W[cat]);
                });

                if (words.some(w => !w || w.length === 0)) continue;

                let wordStr;
                if (C.passSeparator === '') {
                    words = words.map(Cap);
                    wordStr = words.join('');
                } else {
                    words = words.map(w => w.toLowerCase());
                    wordStr = words.join(C.passSeparator);
                }

                let numberBlock = [];
                for (let j = 0; j < C.passNumDigits; j++) { numberBlock.push(getRand(10)); }

                let preliminaryLength = wordStr.length + numberBlock.length + C.passNumSymbols;

                if (C.padToMin && preliminaryLength < C.minLength) {
                    const paddingNeeded = C.minLength - preliminaryLength;
                    for (let j = 0; j < paddingNeeded; j++) {
                        numberBlock.push(getRand(10));
                    }
                    preliminaryLength += paddingNeeded;
                }

                if (preliminaryLength > C.maxLength) continue;

                let symbolsToUse = { beforeNum: '', afterNum: '', junction: '', end: '' };
                let symbolLength = 0;

                if (C.passNumSymbols > 0) {
                    let availableTypes = ['end', 'junction'];
                    if (numberBlock.length > 0) { availableTypes.push('beforeNum', 'afterNum'); }

                    // Apply Symbol Placement filter
                    if (C.passSymPlacement === 'aroundNum') {
                        // Only allow beforeNum/afterNum if numbers exist
                        if (numberBlock.length > 0) {
                            availableTypes = ['beforeNum', 'afterNum'];
                        }
                        // If no numbers, we fall back to random logic or could default to 'end'.
                        // Defaulting to keeping 'end', 'junction' effectively ignores the 'aroundNum' constraint if no nums, which is reasonable.
                        // But let's try to honor it strictly if possible, or just fallback to all if nums missing.
                    } else if (C.passSymPlacement === 'suffix') {
                        availableTypes = ['end'];
                    }

                    for (let k = availableTypes.length - 1; k > 0; k--) {
                        const l = getRand(k + 1);
                        [availableTypes[k], availableTypes[l]] = [availableTypes[l], availableTypes[k]];
                    }
                    for (let j = 0; j < C.passNumSymbols; j++) {
                        if (availableTypes.length === 0) break;
                        let type = availableTypes.shift();
                        if (type && SYMBOL_RULES[type] && SYMBOL_RULES[type].length > 0) {
                            const symbol = R(SYMBOL_RULES[type]);
                            symbolsToUse[type] = symbol;
                            symbolLength += symbol.length;
                        }
                    }
                }

                let numberPart = symbolsToUse.beforeNum + numberBlock.join('') + symbolsToUse.afterNum;

                let finalPass;
                if (wordStr.length === 0) {
                    finalPass = numberPart + symbolsToUse.end;
                } else {
                    let placeAtStart = false;
                    if (C.passNumPlacement === 'start') {
                        placeAtStart = true;
                    } else if (C.passNumPlacement === 'end') {
                        placeAtStart = false;
                    } else {
                        placeAtStart = (getRand(2) === 0);
                    }

                    finalPass = (placeAtStart && numberPart.length > 0)
                        ? (numberPart + symbolsToUse.junction + wordStr)
                        : (wordStr + symbolsToUse.junction + numberPart);
                    finalPass += symbolsToUse.end;
                }

                if (finalPass.length > C.maxLength) {
                    continue;
                }
                if (!C.padToMin && finalPass.length < C.minLength) {
                    continue;
                }

                return finalPass;
            }

            console.warn(`Failed to generate password with constraints after ${MAX_RETRIES} retries.`);
            return "[Retry limit hit. Relax length settings.]";
        };

        // ====================================================================
        // DATA LOADING & ANALYSIS
        // ====================================================================

        const loadWordBank = async () => {
            const selection = DOMElements.baseBankSelect.value || 'default';

            // Check if selection changed or not loaded
            if (memoryWordBank && memoryWordBank._sourceId === selection) {
                return true;
            }

            // Load from Custom Wordbanks if selected
            if (selection !== 'default') {
                const customBank = state.customWordBanks.find(b => b.id === selection);
                if (customBank) {
                    memoryWordBank = JSON.parse(JSON.stringify(customBank.data));
                    memoryWordBank._sourceId = selection;
                    return true;
                }
                // Fallback to default if not found
                console.warn(`Wordbank '${selection}' not found, falling back to default.`);
            }

            if (!window.fetch) {
                throw new Error("Browser does not support fetch API");
            }

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch('wordbanks/wordbank-base.json', { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`Failed to fetch 'wordbanks/wordbank-base.json': ${response.statusText}`);
                }
                const data = await response.json();

                if (!data.wordBank) {
                    throw new Error("Invalid base wordbank file structure.");
                }

                memoryWordBank = data.wordBank;
                memoryWordBank._sourceId = 'default';
                return true;
            } catch (err) {
                console.error("Failed to load wordbank:", err);
                AppLifecycle.showStartupError("Wordbank Load Error", `Failed to load base wordbank: ${err.message}`);
                return false;
            }
        };

        const updateSeasonDisplay = () => {
            const selected = DOMElements.seasonalBankSelect.value;
            const displayEl = document.getElementById('active-season-display');
            if (!displayEl) return;

            if (selected === 'auto') {
                const currentSeason = DateUtils.getSeason(new Date());
                const capitalSeason = currentSeason.charAt(0).toUpperCase() + currentSeason.slice(1);
                displayEl.textContent = `(Now: ${capitalSeason})`;
            } else {
                displayEl.textContent = '';
            }
        };

        const analyzeWordBank = async () => {
            const selectedSeason = DOMElements.seasonalBankSelect.value;
            updateSeasonDisplay();

            // Always reload if needed (loadWordBank handles caching logic based on selection)
            const loaded = await loadWordBank();
            if (!loaded) return;

            activeWordBank = JSON.parse(JSON.stringify(memoryWordBank));
            // Remove internal metadata
            delete activeWordBank._sourceId;

            let seasonToLoad = selectedSeason;
            if (seasonToLoad === 'auto') {
                seasonToLoad = DateUtils.getSeason(new Date());
            }

            if (seasonToLoad !== 'none' && seasonToLoad !== 'auto') {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    const response = await fetch(`wordbanks/wordbank-${seasonToLoad}.json`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!response.ok) throw new Error(`File not found or failed to load (Status: ${response.status})`);
                    const seasonalBank = await response.json();

                    for (const category in seasonalBank) {
                        if (activeWordBank[category]) {
                            activeWordBank[category] = [...activeWordBank[category], ...seasonalBank[category]];
                        } else {
                            activeWordBank[category] = seasonalBank[category];
                        }
                    }
                } catch (err) {
                    console.error(err);
                    SafeUI.showToast(`Error loading ${seasonToLoad} wordbank. Using base words only.`);
                }
            }

            const availableCategories = Object.keys(activeWordBank).filter(cat => activeWordBank[cat] && activeWordBank[cat].length > 0);

            availableStructures = {};
            const baseStructures = state.phraseStructures;

            const filterStructures = (structureSet) => {
                const filtered = {};
                if (!structureSet) return filtered;
                for (const num in structureSet) {
                    filtered[num] = structureSet[num].filter(chain =>
                        chain.every(category => availableCategories.includes(category))
                    );
                }
                return filtered;
            };

            availableStructures.standard = filterStructures(baseStructures.standard);
            availableStructures.seasonal = filterStructures(baseStructures.seasonal);
        };

        // ====================================================================
        // UI & EVENT HANDLERS
        // ====================================================================

        const renderResults = () => {
            ListRenderer.renderList({
                container: DOMElements.resultsList,
                items: generatedPasswords,
                emptyMessage: 'Click "Generate" or a button above.',
                createItemElement: (pass) => {
                    const li = document.createElement('li');
li.className = 'result-item';

                    const text = document.createElement('span');
                    text.textContent = pass;

                    const isError = pass.startsWith('[');
                    if (isError) {
                        text.className = 'error';
                    }

                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'copy-btn btn-icon';
                    copyBtn.title = 'Copy';
                    copyBtn.innerHTML = SafeUI.SVGIcons.copy;
                    copyBtn.disabled = isError;
                    copyBtn.onclick = async () => {
                        const success = await SafeUI.copyToClipboard(pass);
                        SafeUI.showToast(success ? "Copied!" : "Failed to copy.");
                    };

                    li.appendChild(text);
                    li.appendChild(copyBtn);
                    return li;
                }
            });
        };

        const disableAllControls = () => {
            const controlsToDisable = [
                'btnAddQuickCopy', 'btnAddPreset', 'btnQuickGenerateTemp',
                'passNumWords', 'passSeparator', 'seasonalBankSelect',
                'passNumDigits', 'passNumSymbols', 'passNumPlacement', 'passSymPlacement',
                'passMinLength', 'passMaxLength', 'passPadToMin',
                'btnGenerate',
            ];

            controlsToDisable.forEach(key => {
                const el = DOMElements[key];
                if (el) {
                    el.disabled = true;
                    if (el.classList.contains('btn')) {
                        el.style.opacity = '0.7';
                        el.style.cursor = 'not-allowed';
                    }
                }
            });

            ListRenderer.renderList({
                container: DOMElements.resultsList,
                items: [],
                emptyMessage: 'Password generator is disabled.',
            });
        };

        const getConfigFromUI = () => {
            const config = {
                passNumWords: parseInt(DOMElements.passNumWords.value, 10),
                passSeparator: DOMElements.passSeparator.value,
                passNumDigits: parseInt(DOMElements.passNumDigits.value, 10),
                passNumSymbols: parseInt(DOMElements.passNumSymbols.value, 10),
                passNumPlacement: DOMElements.passNumPlacement.value,
                passSymPlacement: DOMElements.passSymPlacement.value,
                minLength: parseInt(DOMElements.passMinLength.value, 10),
                maxLength: parseInt(DOMElements.passMaxLength.value, 10),
                padToMin: DOMElements.passPadToMin.checked,
                seasonalBank: DOMElements.seasonalBankSelect.value,
                baseBank: DOMElements.baseBankSelect.value // Save choice in preset
            };
            return { type: 'passphrase', config: config };
        };

        const setConfigToUI = (config) => {
            const C = config;
            DOMElements.passNumWords.value = C.passNumWords;
            DOMElements.passSeparator.value = C.passSeparator;
            DOMElements.passNumDigits.value = C.passNumDigits;
            DOMElements.passNumSymbols.value = C.passNumSymbols;
            if (C.passNumPlacement) DOMElements.passNumPlacement.value = C.passNumPlacement;
            if (C.passSymPlacement) DOMElements.passSymPlacement.value = C.passSymPlacement;
            DOMElements.passMinLength.value = C.minLength;
            DOMElements.passMaxLength.value = C.maxLength;
            DOMElements.passPadToMin.checked = C.padToMin;
            DOMElements.seasonalBankSelect.value = C.seasonalBank;
            if (C.baseBank && DOMElements.baseBankSelect.querySelector(`option[value="${C.baseBank}"]`)) {
                DOMElements.baseBankSelect.value = C.baseBank;
            } else {
                DOMElements.baseBankSelect.value = 'default';
            }
        };

        const handleGenerate = async (configObj) => {
            const { type, config } = configObj || getConfigFromUI();

            generatedPasswords = [];
            for (let i = 0; i < 5; i++) {
                generatedPasswords.push(generatePassphrase(config));
            }

            renderResults();

            const accordion = DOMElements.customGenHeader.closest('.accordion');
            if (accordion && accordion.classList.contains('expanded')) {
                toggleAccordion(null);
            }
        };

        const initQuickActions = () => {
            const presets = state.generatorPresets || [];
            const quickCopy = state.quickCopyItems || [];

            const combinedItems = [
                ...presets.map(p => ({ ...p, type: 'preset' })),
                ...quickCopy.map(q => ({ ...q, type: 'quickcopy' }))
            ];

            window.QuickListManager.init({
                container: DOMElements.quickActionsContainer,
                items: combinedItems,
                emptyMessage: "No quick actions. Save a preset or add a quick-copy password.",

                getItemName: (item) => item.name,

                onItemClick: async (item) => {
                    if (item.type === 'preset') {
                        setConfigToUI(item.config);
                        await analyzeWordBank();
                        const content = DOMElements.customGeneratorConfig;
                        if (content && content.classList.contains('collapsed')) {
                            toggleAccordion(null);
                        }
                        handleGenerate({ type: 'passphrase', config: item.config });
                        SafeUI.showToast(`Generated using preset: ${item.name}`);
                    } else if (item.type === 'quickcopy') {
                        const success = await SafeUI.copyToClipboard(item.value);
                        SafeUI.showToast(success ? `Copied: ${item.name}` : "Failed to copy.");
                    }
                },

                onDeleteClick: (item, renderCallback) => {
                    const collectionName = item.type === 'preset' ? 'Preset' : 'Password';
                    const stateKey = item.type === 'preset' ? 'generatorPresets' : 'quickCopyItems';

                    UIPatterns.confirmDelete(collectionName, item.name, () => {
                        const collection = state[stateKey];
                        const index = collection.findIndex(i => i.id === item.id);
                        if (index > -1) {
                            collection.splice(index, 1);
                            saveState();
                            renderCallback();
                        }
                    });
                },
            });
        };

        const handleAddQuickCopy = () => {
            SafeUI.showModal('Add Quick Copy Password',
                `<div class="form-group">
                    <label for="qc-name">Name (e.g., "Guest WiFi")</label>
                    <input id="qc-name" class="form-control" placeholder="Name">
                    </div>
                    <div class="form-group">
                    <label for="qc-value">Password Value</label>
                    <input id="qc-value" class="form-control" placeholder="The password to copy">
                    </div>`,
                [
                    { label: 'Cancel' },
                    {
                        label: 'Save',
                        class: 'btn-primary',
                        callback: () => {
                            const name = document.getElementById('qc-name').value.trim();
                            const value = document.getElementById('qc-value').value;

                            if (!SafeUI.validators.notEmpty(name) || !SafeUI.validators.maxLength(name, 50)) {
                                SafeUI.showValidationError('Invalid Name', 'Name must be 1-50 characters.', 'qc-name');
                                return false;
                            }
                            if (!SafeUI.validators.notEmpty(value)) {
                                SafeUI.showValidationError('Invalid Password', 'Password value cannot be empty.', 'qc-value');
                                return false;
                            }
                            if (DataValidator.hasDuplicate(state.quickCopyItems, 'name', name)) {
                                SafeUI.showValidationError('Duplicate Name', 'A password with this name already exists.', 'qc-name');
                                return false;
                            }

                            const newItem = {
                                id: SafeUI.generateId(),
                                name: name,
                                value: value
                            };

                            state.quickCopyItems.push(newItem);
                            saveState();
                            initQuickActions();
                            SafeUI.showToast('Password saved!');
                        }
                    }
                ]
            );
        };

        const handleAddPreset = () => {
            const { type, config } = getConfigFromUI();

            SafeUI.showModal('Save Generator Preset', '<input id="preset-name" class="form-control" placeholder="e.g., 4-Word TitleCase">', [
                { label: 'Cancel' },
                {
                    label: 'Save',
                    class: 'btn-primary',
                    callback: () => {
                        const name = document.getElementById('preset-name').value.trim();
                        if (!SafeUI.validators.notEmpty(name) || !SafeUI.validators.maxLength(name, 50)) {
                            SafeUI.showValidationError('Invalid Name', 'Name must be 1-50 characters.', 'preset-name');
                            return false;
                        }
                        if (DataValidator.hasDuplicate(state.generatorPresets, 'name', name)) {
                            SafeUI.showValidationError('Duplicate Name', 'A preset with this name already exists.', 'preset-name');
                            return false;
                        }

                        const newPreset = {
                            id: SafeUI.generateId(),
                            name: name,
                            config: config
                        };

                        state.generatorPresets.push(newPreset);
                        saveState();
                        initQuickActions();
                        SafeUI.showToast('Preset saved!');
                    }
                }
            ]);
        };

        const handleImportWordbank = () => {
            SafeUI.openFilePicker(async (file) => {
                SafeUI.readJSONFile(file, async (importedData) => {
                    try {
                        if (!importedData || (!importedData.wordBank)) {
                            throw new Error("Invalid wordbank file. Must contain a 'wordBank' object.");
                        }

                        // Ask for name
                        SafeUI.showModal("Import Dictionary",
                            `<p>Give a name to this custom dictionary:</p>
                             <input id="new-bank-name" class="form-control" placeholder="My Custom Words">`,
                            [
                                { label: 'Cancel' },
                                {
                                    label: 'Import',
                                    class: 'btn-primary',
                                    callback: async () => {
                                        const name = document.getElementById('new-bank-name').value.trim();
                                        if (!name) return SafeUI.showValidationError("Invalid Name", "Name required", "new-bank-name");

                                        const newBank = {
                                            id: SafeUI.generateId(),
                                            name: name,
                                            data: importedData.wordBank
                                        };

                                        state.customWordBanks.push(newBank);
                                        saveState();

                                        // Update UI
                                        updateBaseBankSelect();
                                        DOMElements.baseBankSelect.value = newBank.id;
                                        await analyzeWordBank();

                                        SafeUI.showToast("Dictionary imported.");
                                        SafeUI.hideModal(); // Close import modal
                                        // Note: Settings modal is closed by this action, which is fine.
                                    }
                                }
                            ]
                        );
                    } catch (err) {
                        showError("Import Error", err);
                    }
                }, (errorMsg) => {
                    showError('Import Error', new Error(errorMsg));
                });
            }, '.json');
        };

        const renderManageBanks = () => {
            const list = document.getElementById('manage-banks-list');
            if (!list) return;

            list.innerHTML = '';
            if (state.customWordBanks.length === 0) {
                list.innerHTML = '<p class="form-help">No custom dictionaries imported.</p>';
                return;
            }

            state.customWordBanks.forEach(bank => {
                const div = document.createElement('div');
                div.className = 'shortcut-item';
                div.style.marginBottom = '4px';
                div.innerHTML = `
                    <span style="flex-grow:1; overflow:hidden; text-overflow:ellipsis;">${SafeUI.escapeHTML(bank.name)}</span>
                    <button class="icon-btn delete-bank-btn" data-id="${bank.id}" title="Delete">${SafeUI.SVGIcons.trash}</button>
                `;
                div.querySelector('.delete-bank-btn').onclick = (e) => {
                    e.stopPropagation();
                    UIPatterns.confirmDelete("Dictionary", bank.name, () => {
                        state.customWordBanks = state.customWordBanks.filter(b => b.id !== bank.id);
                        if (state.ui.selectedBaseBank === bank.id) {
                            state.ui.selectedBaseBank = 'default';
                        }
                        saveState();
                        renderManageBanks();
                        updateBaseBankSelect();
                    });
                };
                list.appendChild(div);
            });
        };

        function setupSettingsModal() {
            const customSettingsHtml = `
                <div class="form-group">
                    <label>Manage Dictionaries</label>
                    <div id="manage-banks-list" style="margin-bottom: 0.5rem; max-height: 150px; overflow-y: auto;"></div>
                    <button id="modal-import-wordbank-btn" class="btn">Import New Dictionary (JSON)</button>
                </div>
            `;

            const onModalOpen = () => {
                document.getElementById('modal-import-wordbank-btn').addEventListener('click', handleImportWordbank);
                renderManageBanks();
            };

            const onRestore = (dataToRestore) => {
                // Wordbank is no longer restored from persistence as it is not saved.
                state.phraseStructures = dataToRestore.phraseStructures || defaultPhraseStructures;
                state.symbolRules = dataToRestore.symbolRules || defaultSymbolRules;
                state.quickCopyItems = dataToRestore.quickCopyItems || [];
                state.generatorPresets = dataToRestore.generatorPresets || [];

                saveState();

                // Re-init actions (wordbank load is separate)
                analyzeWordBank();
                initQuickActions();
            };

            window.SharedSettingsModal.init({
                buttonId: 'btn-settings',
                appName: APP_CONFIG.NAME,
                state: state,
                customSettingsHtml: customSettingsHtml,
                onModalOpen: onModalOpen,
                onRestoreCallback: onRestore,
                itemValidators: {
                    // Removed wordBank validator
                    phraseStructures: [],
                    symbolRules: [],
                    quickCopyItems: ['id', 'name', 'value'],
                    generatorPresets: ['id', 'name', 'config'],
                    customWordBanks: ['id', 'name', 'data']
                }
            });
        }

        function updateBaseBankSelect() {
            const select = DOMElements.baseBankSelect;
            if (!select) return;

            const currentVal = select.value;
            select.innerHTML = '<option value="default">Default (Repository)</option>';

            if (state.customWordBanks) {
                state.customWordBanks.forEach(bank => {
                    const opt = document.createElement('option');
                    opt.value = bank.id;
                    opt.textContent = bank.name;
                    select.appendChild(opt);
                });
            }

            if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
                select.value = currentVal;
            } else {
                select.value = 'default';
            }
        }

        function attachEventListeners() {
            DOMElements.btnAddQuickCopy.addEventListener('click', handleAddQuickCopy);
            DOMElements.btnAddPreset.addEventListener('click', handleAddPreset);

            DOMElements.btnQuickGenerateTemp.addEventListener('click', () => {
                handleGenerate({
                    type: 'passphrase',
                    config: {
                        passNumWords: 1, passSeparator: "", passNumDigits: 1,
                        passNumSymbols: 0, minLength: 12, maxLength: 16,
                        padToMin: true, seasonalBank: "none", passNumPlacement: 'end', baseBank: 'default'
                    }
                });
            });

            DOMElements.btnGenerate.addEventListener('click', () => handleGenerate(null));

            setupSettingsModal();
            updateBaseBankSelect();

            DOMElements.seasonalBankSelect.addEventListener('change', async () => {
                await analyzeWordBank();
            });

            DOMElements.baseBankSelect.addEventListener('change', async () => {
                await analyzeWordBank();
            });

            DOMElements.seasonalInfoBtn.addEventListener('click', () => {
                const infoHtml = `
                    <ul style="list-style-type: none; padding-left: 0; margin: 0; font-size: 0.9rem; text-align: left;">
                        <li style="margin-bottom: 0.5rem;"><strong>Auto:</strong> Automatically selects the current season.</li>
                        <li style="margin-bottom: 0.5rem;"><strong>Winter:</strong> Months 12, 1, 2 (Dec-Feb)</li>
                        <li style="margin-bottom: 0.5rem;"><strong>Spring:</strong> Months 3, 4, 5 (Mar-May)</li>
                        <li style="margin-bottom: 0.5rem;"><strong>Summer:</strong> Months 6, 7, 8 (Jun-Aug)</li>
                        <li><strong>Autumn:</strong> Months 9, 10, 11 (Sep-Nov)</li>
                    </ul>
                `;
                SafeUI.showModal('Seasonal Date Ranges', infoHtml, [{ label: 'OK' }]);
            });

            const generatorInputs = DOMElements.customGeneratorConfig.querySelectorAll('input, select');
            generatorInputs.forEach(input => {
                input.addEventListener('focus', () => {
                    const accordion = DOMElements.customGenHeader.closest('.accordion');
                    if (accordion && !accordion.classList.contains('expanded')) {
                        toggleAccordion(null);
                    }
                });
            });
        }

        async function init() {
            DOMElements.btnAddPreset.innerHTML = SafeUI.SVGIcons.plus + ' Save Preset';
            DOMElements.btnAddQuickCopy.innerHTML = SafeUI.SVGIcons.plus + ' Add Quick Copy';

            initAccordion();

            const loaded = await loadWordBank();
            if (!loaded) {
                disableAllControls();
                return;
            }

            await analyzeWordBank();

            attachEventListeners();
            initQuickActions();
            renderResults();
        }

        init();
        } catch (err) {
            console.error("Unhandled exception during initialization:", err);
            if (AppLifecycle.showStartupError) {
                AppLifecycle.showStartupError("Application Error", `Unexpected error: ${err.message}`);
            } else {
                const banner = document.getElementById('app-startup-error');
                if (banner) {
                    banner.innerHTML = `<strong>Application Error</strong><p style="margin:0.25rem 0 0 0;font-weight:normal;">Unexpected error: ${err.message}</p>`;
                    banner.classList.remove('hidden');
                }
            }
        }
    })();
}
