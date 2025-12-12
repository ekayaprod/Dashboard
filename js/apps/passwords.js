// ============================================================================
// PAGE-SPECIFIC LOGIC: Passwords (passwords.html)
// ============================================================================

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'passwords',
        VERSION: '1.4.11',
        DATA_KEY: 'passwords_v1_data',
    };

    console.log(`AppLifecycle: Running passwords.html v${APP_CONFIG.VERSION}`);

    // ====================================================================
    // DEFAULT STATE & LOGIC
    // ====================================================================

    const SEASON_CONFIG = {
        rules: {
            startOffset: 12, // days before start
            endCutoff: 60    // days before end
        },
        seasons: {
            spring: { start: { m: 2, d: 20 }, end: { m: 5, d: 21 } }, // Mar 20 - Jun 21
            summer: { start: { m: 5, d: 21 }, end: { m: 8, d: 22 } }, // Jun 21 - Sep 22
            autumn: { start: { m: 8, d: 22 }, end: { m: 11, d: 21 } },// Sep 22 - Dec 21
            winter: { start: { m: 11, d: 21 }, end: { m: 2, d: 20 } } // Dec 21 - Mar 20
        }
    };

    const getCurrentSeason = () => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const makeDate = (m, d, year = currentYear) => new Date(year, m, d);

        for (const [season, range] of Object.entries(SEASON_CONFIG.seasons)) {
            let sDate = makeDate(range.start.m, range.start.d);
            let eDate = makeDate(range.end.m, range.end.d);

            if (range.start.m > range.end.m) {
                 if (now.getMonth() < range.start.m) {
                     sDate.setFullYear(currentYear - 1);
                 } else {
                     eDate.setFullYear(currentYear + 1);
                 }
            }

            sDate.setDate(sDate.getDate() - SEASON_CONFIG.rules.startOffset);
            eDate.setDate(eDate.getDate() - SEASON_CONFIG.rules.endCutoff);

            if (now >= sDate && now < eDate) {
                return season;
            }
        }
        return 'none';
    };

    // Enhanced Structure Definitions with Metadata
    const phraseStructureConfig = {
        "standard": {
            "1": [{ categories: ["LongWord"], label: "Long Word", description: "A single long, complex word." }],
            "2": [
                { categories: ["Adjective","Animal"], label: "Vivid Creature", description: "Creates a vivid, personified creature." },
                { categories: ["Color","Object"], label: "High Contrast", description: "High-contrast imagery that is easy to visualize." },
                { categories: ["Verb","Object"], label: "Dynamic Action", description: "Dynamic phrases that suggest a clear physical action." }
            ],
            "3": [{ categories: ["Adjective","Color","Animal"], label: "Standard 3-Word", description: "Descriptive three word phrase." }],
            "4": [{ categories: ["Adjective","Animal","Color","Verb"], label: "Standard 4-Word", description: "Complex four word phrase." }]
        },
        "winter": {
            "1": [{ categories: ["LongWord"], label: "Long Word", description: "A single long, complex word." }],
            "2": [
                { categories: ["Adjective","Object"], label: "Winter Gear", description: "Descriptive pairing focusing on winter gear and items." },
                { categories: ["Verb","Noun"], label: "Winter Action", description: "Actions related to winter weather phenomena." },
                { categories: ["Color","Animal"], label: "Snowy Nature", description: "Visual nature pairings common in winter settings." },
                { categories: ["Adjective","Noun"], label: "Atmospheric", description: "Atmospheric phrases describing the season." }
            ],
            "3": [{ categories: ["Adjective","Verb","Object"], label: "Winter 3-Word", description: "Seasonal three word phrase." }],
            "4": [{ categories: ["Adjective","Verb","Color","Noun"], label: "Winter 4-Word", description: "Seasonal four word phrase." }]
        },
        "spring": {
            "1": [{ categories: ["LongWord"], label: "Long Word", description: "A single long, complex word." }],
            "2": [
                { categories: ["Adjective","Animal"], label: "New Life", description: "Focuses on the 'young/new' aspect of spring animals." },
                { categories: ["Color","Object"], label: "Growth", description: "Vibrant, growth-oriented visual phrases." },
                { categories: ["Verb","Noun"], label: "Gardening", description: "Gardening and nature activities." },
                { categories: ["Adjective","Noun"], label: "Spring Weather", description: "Atmospheric descriptions of spring weather." }
            ],
            "3": [{ categories: ["Adjective","Verb","Object"], label: "Spring 3-Word", description: "Seasonal three word phrase." }],
            "4": [{ categories: ["Adjective","Verb","Color","Noun"], label: "Spring 4-Word", description: "Seasonal four word phrase." }]
        },
        "summer": {
            "1": [{ categories: ["LongWord"], label: "Long Word", description: "A single long, complex word." }],
            "2": [
                { categories: ["Verb","Object"], label: "Summer Fun", description: "Active summer fun and vacation activities." },
                { categories: ["Adjective","Noun"], label: "Heat Wave", description: "Weather-focused phrases describing the heat." },
                { categories: ["Color","Object"], label: "Beach Scene", description: "Visuals related to beach and outdoor scenes." },
                { categories: ["Adjective","Animal"], label: "Lazy Days", description: "Evokes the slow, relaxed pace of summer." }
            ],
            "3": [{ categories: ["Adjective","Verb","Object"], label: "Summer 3-Word", description: "Seasonal three word phrase." }],
            "4": [{ categories: ["Adjective","Verb","Color","Noun"], label: "Summer 4-Word", description: "Seasonal four word phrase." }]
        },
        "autumn": {
            "1": [{ categories: ["LongWord"], label: "Long Word", description: "A single long, complex word." }],
            "2": [
                { categories: ["Adjective","Object"], label: "Foliage", description: "Focuses on the changing colors of foliage." },
                { categories: ["Verb","Object"], label: "Harvest Chores", description: "Classic autumn chores and activities." },
                { categories: ["Color","Noun"], label: "Harvest Visuals", description: "Harvest-themed visual phrases." },
                { categories: ["Adjective","Animal"], label: "Wildlife Prep", description: "Animals preparing for winter." }
            ],
            "3": [{ categories: ["Adjective","Verb","Object"], label: "Autumn 3-Word", description: "Seasonal three word phrase." }],
            "4": [{ categories: ["Adjective","Verb","Color","Noun"], label: "Autumn 4-Word", description: "Seasonal four word phrase." }]
        }
    };

    const defaultSymbolRules = {"beforeNum":["$","#","*"],"afterNum":["%","+"],"junction":["=","@",".","-"],"end":["!","?"]};

    const defaultState = {
        symbolRules: defaultSymbolRules,
        quickCopyItems: [],
        generatorPresets: [],
        settings: {}
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
                'active-season-display', 'passStructure'
            ]
        });

        if (!ctx) return;

        let { elements: DOMElements, state, saveState } = ctx;

        // Cleanup stale data
        if (state.wordBank) { delete state.wordBank; saveState(); }
        if (state.customWordBanks) { delete state.customWordBanks; saveState(); }
        if (state.ui && state.ui.selectedBaseBank) { delete state.ui.selectedBaseBank; saveState(); }
        if (state.phraseStructures) { delete state.phraseStructures; saveState(); }

        let generatedPasswords = [];
        let memoryWordBank = null;
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
            try { localStorage.setItem(ACCORDION_STATE_KEY, isExpanded); } catch (err) { }
        };

        const initAccordion = () => {
            let expanded = true;
            try {
                const savedState = localStorage.getItem(ACCORDION_STATE_KEY);
                if (savedState !== null) expanded = savedState === 'true';
            } catch (err) { }

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
                DOMElements.accordionToggle.onclick = (e) => { e.stopPropagation(); toggleAccordion(null); };
            }
            if (DOMElements.customGenHeader) {
                DOMElements.customGenHeader.onclick = (e) => {
                    if (!e.target.closest('#accordion-toggle')) toggleAccordion(e);
                };
            }
        };

        // ====================================================================
        // GENERATION LOGIC
        // ====================================================================

        const getRand = (() => {
            let cryptoAvailable = window.crypto && window.crypto.getRandomValues;
            if (!cryptoAvailable) console.warn("Crypto API not available.");
            return (m) => {
                if (cryptoAvailable) {
                    try {
                        const r = new Uint32Array(1);
                        window.crypto.getRandomValues(r);
                        return r[0] % m;
                    } catch (e) { cryptoAvailable = false; }
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

            if (C.minLength > C.maxLength) return "[Min length > Max length]";
            if (!C.passNumWords && !C.passNumDigits && !C.passNumSymbols) return "[No content selected]";

            let resolvedSeason = C.seasonalBank;
            if (C.seasonalBank === 'auto') resolvedSeason = getCurrentSeason();

            let minEstimate = C.passNumDigits + C.passNumSymbols + (C.passNumWords * 4);
            if (C.passNumWords > 1) minEstimate += (C.passNumWords - 1) * C.passSeparator.length;
            if (minEstimate > C.maxLength) return "[Settings exceed Max Length]";

            C.passNumPlacement = C.passNumPlacement || 'random';
            C.passSymPlacement = C.passSymPlacement || 'any';

            while (retries < MAX_RETRIES) {
                retries++;
                let words = [];
                let structObj;

                // Structure Selection Logic
                // If a specific structure is requested via config (e.g., from UI dropdown), use it.
                // Otherwise, pick random from availableStructures[numWords]

                const availableForCount = P_structs[C.passNumWords];

                if (!availableForCount || availableForCount.length === 0) {
                     if (C.passNumWords === 0) {
                         structObj = { categories: [] };
                     } else {
                         return "[No valid word structure found]";
                     }
                } else {
                    // TODO: Implement specific structure selection from UI config
                    if (C.selectedStructureIndex !== undefined && C.selectedStructureIndex >= 0 && C.selectedStructureIndex < availableForCount.length) {
                        structObj = availableForCount[C.selectedStructureIndex];
                    } else {
                        structObj = R(availableForCount);
                    }
                }

                const struct = structObj.categories;

                words = struct.map(cat => {
                    if (!W[cat] || W[cat].length === 0) {
                        // Fallback logic
                        const fallbackCat = W['Object'] ? 'Object' : 'Word';
                        if (W[fallbackCat] && W[fallbackCat].length > 0) return R(W[fallbackCat]);
                        return "Word";
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
                    for (let j = 0; j < paddingNeeded; j++) { numberBlock.push(getRand(10)); }
                    preliminaryLength += paddingNeeded;
                }

                if (preliminaryLength > C.maxLength) continue;

                let symbolsToUse = { beforeNum: '', afterNum: '', junction: '', end: '' };
                let symbolLength = 0;

                if (C.passNumSymbols > 0) {
                    let availableTypes = ['end', 'junction'];
                    if (numberBlock.length > 0) { availableTypes.push('beforeNum', 'afterNum'); }

                    if (C.passSymPlacement === 'aroundNum') {
                        if (numberBlock.length > 0) availableTypes = ['beforeNum', 'afterNum'];
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
                    if (C.passNumPlacement === 'start') placeAtStart = true;
                    else if (C.passNumPlacement === 'end') placeAtStart = false;
                    else placeAtStart = (getRand(2) === 0);

                    finalPass = (placeAtStart && numberPart.length > 0)
                        ? (numberPart + symbolsToUse.junction + wordStr)
                        : (wordStr + symbolsToUse.junction + numberPart);
                    finalPass += symbolsToUse.end;
                }

                if (finalPass.length > C.maxLength) continue;
                if (!C.padToMin && finalPass.length < C.minLength) continue;
                return finalPass;
            }
            return "[Retry limit hit. Relax length settings.]";
        };

        // ====================================================================
        // DATA LOADING & ANALYSIS
        // ====================================================================

        const loadWordBank = async () => {
            if (!window.fetch) throw new Error("Browser does not support fetch API");
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await fetch('wordbanks/wordbank-base.json', { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) throw new Error(`Failed to fetch 'wordbanks/wordbank-base.json'`);
                const data = await response.json();
                if (!data.wordBank) throw new Error("Invalid base wordbank file structure.");

                memoryWordBank = data.wordBank;
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
            const rangeEl = document.getElementById('seasonal-range-inline');

            let activeKey = selected;
            if (activeKey === 'auto') activeKey = getCurrentSeason();
            if (activeKey === 'none') activeKey = 'standard';

            // Update Label "(Now: Summer)"
            if (displayEl) {
                if (selected === 'auto') {
                    if (activeKey === 'standard') {
                        displayEl.textContent = '(Now: Standard)';
                    } else {
                        const capitalSeason = activeKey.charAt(0).toUpperCase() + activeKey.slice(1);
                        displayEl.textContent = `(Now: ${capitalSeason})`;
                    }
                } else {
                    displayEl.textContent = '';
                }
            }

            // Update Inline Date Range
            if (rangeEl) {
                if (activeKey === 'standard') {
                    rangeEl.textContent = "Standard dictionary enabled.";
                } else if (SEASON_CONFIG.seasons[activeKey]) {
                     const range = SEASON_CONFIG.seasons[activeKey];
                     const formatDate = (m, d) => new Date(2000, m, d).toLocaleString('default', { month: 'short', day: 'numeric' });

                     const sDate = new Date(2000, range.start.m, range.start.d);
                     sDate.setDate(sDate.getDate() - SEASON_CONFIG.rules.startOffset);
                     const eDate = new Date(2000, range.end.m, range.end.d);
                     eDate.setDate(eDate.getDate() - SEASON_CONFIG.rules.endCutoff);
                     if (range.start.m > range.end.m) eDate.setFullYear(2001);

                     rangeEl.textContent = `Active: ${formatDate(sDate.getMonth(), sDate.getDate())} - ${formatDate(eDate.getMonth(), eDate.getDate())}`;
                }
            }
        };

        const updateStructureOptions = () => {
            const numWords = DOMElements.passNumWords.value;
            const select = DOMElements.passStructure;
            if (!select) return;

            const currentVal = parseInt(select.value, 10);
            select.innerHTML = ''; // Clear

            const randomOpt = document.createElement('option');
            randomOpt.value = "-1";
            randomOpt.textContent = "Random Chain";
            select.appendChild(randomOpt);

            // Get available structures for this count from the flattened availableStructures
            // created in analyzeWordBank
            const options = availableStructures[numWords];

            if (options && options.length > 0) {
                options.forEach((structObj, index) => {
                    // structObj matches the objects in phraseStructureConfig
                    // { categories: [...], label: "...", description: "..." }
                    const opt = document.createElement('option');
                    opt.value = index;
                    // Format: "Label (Cat1 + Cat2)"
                    const catStr = structObj.categories.join(' + ');
                    opt.textContent = `${structObj.label || 'Chain'} (${catStr})`;
                    opt.title = structObj.description || "";
                    select.appendChild(opt);
                });
            } else {
                 const opt = document.createElement('option');
                 opt.disabled = true;
                 opt.textContent = "(No structures available)";
                 select.appendChild(opt);
            }

            // Restore selection if possible, else Random
            if (currentVal >= 0 && currentVal < (options ? options.length : 0)) {
                select.value = currentVal;
            } else {
                select.value = "-1";
            }
        };

        const analyzeWordBank = async () => {
            const selectedSeason = DOMElements.seasonalBankSelect.value;
            updateSeasonDisplay();

            const loaded = await loadWordBank();
            if (!loaded) return;

            // Start with Base Bank (Standard)
            activeWordBank = JSON.parse(JSON.stringify(memoryWordBank));

            let activeSeasonKey = selectedSeason;
            if (activeSeasonKey === 'auto') activeSeasonKey = getCurrentSeason();
            if (activeSeasonKey === 'none') activeSeasonKey = 'standard';

            // Load Seasonal Data if applicable
            if (activeSeasonKey !== 'standard') {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    const response = await fetch(`wordbanks/wordbank-${activeSeasonKey}.json`, { signal: controller.signal });
                    clearTimeout(timeoutId);

                    if (!response.ok) throw new Error(`File not found or failed to load (Status: ${response.status})`);
                    const seasonalBankData = await response.json();

                    // STRICT SWITCHING: Replace activeWordBank entirely with seasonal data
                    activeWordBank = seasonalBankData.wordBank;

                } catch (err) {
                    console.error(err);
                    SafeUI.showToast(`Error loading ${activeSeasonKey} wordbank. Using base words only.`);
                    activeSeasonKey = 'standard';
                }
            }

            // Filter structures based on availability of categories in the active bank
            const availableCategories = Object.keys(activeWordBank).filter(cat => activeWordBank[cat] && activeWordBank[cat].length > 0);

            // Get the structure config for the active season (or standard)
            const seasonConfig = phraseStructureConfig[activeSeasonKey] || phraseStructureConfig['standard'];

            availableStructures = {};
            // Structure: { "2": [ {categories:[], ...}, ... ], "3": ... }
            // We need to map this to the format expected by generatePassphrase which is { seasonal: { "2": [ catList, catList ] }, standard: ... }
            // Actually, I should update generatePassphrase to use a simpler structure lookup, but to minimize changes I will map it.
            // Wait, generatePassphrase currently looks at P_structs.seasonal or P_structs.standard.
            // I should simplify generatePassphrase to just look at P_structs[numWords].

            // Let's populate availableStructures in a flattened way:
            // availableStructures = { "1": [[...]], "2": [[...], [...]] }

            for (const numWords in seasonConfig) {
                 const validOptions = seasonConfig[numWords].filter(item =>
                     item.categories.every(cat => availableCategories.includes(cat))
                 );
                 availableStructures[numWords] = validOptions; // Store the full objects with metadata
            }

            // Trigger UI update for Structure dropdown if it exists (Step 4 task, but good to have hook)
            if (typeof updateStructureOptions === 'function') {
                updateStructureOptions();
            }
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
                    if (pass.startsWith('[')) text.className = 'error';
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'copy-btn btn-icon';
                    copyBtn.title = 'Copy';
                    copyBtn.innerHTML = SafeUI.SVGIcons.copy;
                    copyBtn.disabled = pass.startsWith('[');
                    copyBtn.onclick = async () => { await UIPatterns.copyToClipboard(pass, "Copied!"); };
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
                selectedStructureIndex: parseInt(DOMElements.passStructure.value, 10),
                passSeparator: DOMElements.passSeparator.value,
                passNumDigits: parseInt(DOMElements.passNumDigits.value, 10),
                passNumSymbols: parseInt(DOMElements.passNumSymbols.value, 10),
                passNumPlacement: DOMElements.passNumPlacement.value,
                passSymPlacement: DOMElements.passSymPlacement.value,
                minLength: parseInt(DOMElements.passMinLength.value, 10),
                maxLength: parseInt(DOMElements.passMaxLength.value, 10),
                padToMin: DOMElements.passPadToMin.checked,
                seasonalBank: DOMElements.seasonalBankSelect.value
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

            // Note: Structure index might be invalid if theme changes, updateStructureOptions handles valid range checks
            if (C.selectedStructureIndex !== undefined) DOMElements.passStructure.value = C.selectedStructureIndex;
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
                        await UIPatterns.copyToClipboard(item.value, `Copied: ${item.name}`);
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
                            const newItem = { id: SafeUI.generateId(), name: name, value: value };
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
                        const newPreset = { id: SafeUI.generateId(), name: name, config: config };
                        state.generatorPresets.push(newPreset);
                        saveState();
                        initQuickActions();
                        SafeUI.showToast('Preset saved!');
                    }
                }
            ]);
        };

        function setupSettingsModal() {
            // Simplified settings modal without import
            const customSettingsHtml = '';

            const onModalOpen = () => {
                // No custom actions
            };

            const onRestore = (dataToRestore) => {
                state.phraseStructures = dataToRestore.phraseStructures || defaultPhraseStructures;
                state.symbolRules = dataToRestore.symbolRules || defaultSymbolRules;
                state.quickCopyItems = dataToRestore.quickCopyItems || [];
                state.generatorPresets = dataToRestore.generatorPresets || [];
                saveState();
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
                    phraseStructures: [],
                    symbolRules: [],
                    quickCopyItems: ['id', 'name', 'value'],
                    generatorPresets: ['id', 'name', 'config']
                }
            });
        }

        function attachEventListeners() {
            DOMElements.btnAddQuickCopy.addEventListener('click', handleAddQuickCopy);
            DOMElements.btnAddPreset.addEventListener('click', handleAddPreset);

            DOMElements.btnQuickGenerateTemp.addEventListener('click', () => {
                // FIXED: Use active seasonal bank (pass 'active' or don't override seasonalBank), just force structure
                // To force a LongWord, we can rely on 1-word structure which is usually LongWord in our configs.
                const currentSeason = DOMElements.seasonalBankSelect.value;
                handleGenerate({
                    type: 'passphrase',
                    config: {
                        passNumWords: 1,
                        passSeparator: "",
                        passNumDigits: 1,
                        passNumSymbols: 0,
                        minLength: 12,
                        maxLength: 16,
                        padToMin: true,
                        seasonalBank: currentSeason, // Respect current theme
                        passNumPlacement: 'end',
                        selectedStructureIndex: 0 // Force index 0 (LongWord) for 1-word
                    }
                });
            });

            DOMElements.btnGenerate.addEventListener('click', () => handleGenerate(null));

            setupSettingsModal();

            DOMElements.passNumWords.addEventListener('change', () => {
                updateStructureOptions();
            });

            DOMElements.seasonalBankSelect.addEventListener('change', async () => {
                await analyzeWordBank();
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
