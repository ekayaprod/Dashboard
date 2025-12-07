// ============================================================================
// PAGE-SPECIFIC LOGIC: Passwords (passwords.html)
// ============================================================================

/**
 * @typedef {Object} PasswordConfiguration
 * @property {string} mode - 'generated' or 'passphrase'
 * @property {number} length
 * @property {boolean} includeSpecial
 * @property {boolean} includeNumbers
 * @property {string} wordbank
 * @property {number} wordCount
 * @property {string} separator
 * @property {boolean} capitalize
 * @property {boolean} appendNumber
 * @property {string} [seasonalBank]
 */

/**
 * @typedef {Object} PasswordHistoryItem
 * @property {string} value
 * @property {number} timestamp
 */

/**
 * @typedef {Object} PasswordState
 * @property {PasswordConfiguration} config
 * @property {PasswordHistoryItem[]} history
 * @property {string} [version]
 */

AppLifecycle.onBootstrap(initializePage);

function initializePage() {
    const APP_CONFIG = {
        NAME: 'passwords',
        VERSION: '2.1.2',
        DATA_KEY: 'passwords_config_v1'
    };

    let DOMElements;
    let state;
    let saveState;
    let wordbanks = {};

    function generateRandomPassword() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
        const length = parseInt(state.config.length, 10);
        let result = "";
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const values = new Uint32Array(length);
            crypto.getRandomValues(values);
            for (let i = 0; i < length; i++) {
                result += chars[values[i] % chars.length];
            }
        } else {
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        return result;
    }

    function getWord(list) {
        if (!list || list.length === 0) return "Word";
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return list[array[0] % list.length];
        }
        return list[Math.floor(Math.random() * list.length)];
    }

    function generatePassphrase() {
        // Enforce strict configuration for "Temporary" mode to prevent logic errors
        const isTemporary = state.config.seasonalBank === 'none';

        let targetBank = isTemporary ? 'LongWord' : (state.config.seasonalBank || 'Noun');

        // Safety fallback if bank missing
        if (!wordbanks[targetBank] || wordbanks[targetBank].length === 0) {
             // Fallback logic if specific bank fails
             targetBank = 'Noun';
             if (!wordbanks['Noun']) return "Error: Wordbanks not loaded.";
        }

        const words = [];
        const count = isTemporary ? 1 : Math.max(1, parseInt(state.config.wordCount, 10));

        for (let i = 0; i < count; i++) {
            let word = getWord(wordbanks[targetBank]);
            if (state.config.capitalize) {
                word = word.charAt(0).toUpperCase() + word.slice(1);
            } else {
                word = word.toLowerCase();
            }
            words.push(word);
        }

        let passphrase = words.join(state.config.separator);

        if (state.config.appendNumber) {
            if (isTemporary) {
                // Temp passwords usually need a specific digit format or just one digit.
                // Context implies "exactly one word... and one digit" for min length 12?
                // Let's stick to standard behavior: append a random digit.
                passphrase += Math.floor(Math.random() * 10);
            } else {
                passphrase += Math.floor(Math.random() * 10);
            }
        }

        return passphrase;
    }

    async function loadWordbanks() {
        try {
            // Load base wordbank
            const baseResponse = await fetch('wordbanks/wordbank-base.json');
            if (!baseResponse.ok) throw new Error('Failed to load base wordbank');
            const baseData = await baseResponse.json();

            // Merge base categories
            Object.assign(wordbanks, baseData);

            // Determine season
            const season = DateUtils.getSeason(new Date());

            // Load seasonal wordbank
            const seasonResponse = await fetch(`wordbanks/wordbank-${season}.json`);
            if (seasonResponse.ok) {
                const seasonData = await seasonResponse.json();
                // Assumes seasonal file has a "Season" array or similar structure
                // Merging it under the generic 'Seasonal' key or specific season key
                wordbanks['Seasonal'] = seasonData.words || [];
            }

            // Update UI with loaded counts or status if needed
            console.log("Wordbanks loaded:", Object.keys(wordbanks));

        } catch (e) {
            console.error("Wordbank load error:", e);
            AppLifecycle.showStartupError("Wordbank Error", "Failed to load word lists. Passphrases may not generate.");
        }
    }

    function updateOutput() {
        let password = "";
        if (state.config.mode === 'passphrase') {
            password = generatePassphrase();
        } else {
            password = generateRandomPassword();
        }

        DOMElements.passwordDisplay.textContent = password;
        updateHistory(password);
    }

    function updateHistory(password) {
        // Add to beginning
        state.history.unshift({ value: password, timestamp: Date.now() });
        // Keep last 10
        if (state.history.length > 10) state.history.pop();

        saveState();
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('password-history-list');
        if (!container) return;

        container.innerHTML = '';
        state.history.forEach(item => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.cssText = "display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border-color); font-family:monospace;";

            const span = document.createElement('span');
            span.textContent = item.value;

            const btn = document.createElement('button');
            btn.className = 'btn-icon';
            btn.innerHTML = SafeUI.SVGIcons.copy;
            btn.title = "Copy";
            btn.onclick = () => {
                SafeUI.copyToClipboard(item.value);
                SafeUI.showToast("Copied");
            };

            div.appendChild(span);
            div.appendChild(btn);
            container.appendChild(div);
        });
    }

    function attachListeners() {
        DOMElements.btnGenerate.addEventListener('click', updateOutput);

        DOMElements.btnCopy.addEventListener('click', () => {
            const text = DOMElements.passwordDisplay.textContent;
            if (text && text !== '...') {
                SafeUI.copyToClipboard(text);
                SafeUI.showToast("Copied to clipboard");
            }
        });

        // Toggle Mode
        const modeRadios = document.getElementsByName('mode');
        modeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.config.mode = e.target.value;
                toggleControls();
                saveState();
            });
        });

        // Inputs
        const bindInput = (id, key, type = 'value') => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                state.config[key] = type === 'checked' ? el.checked : el.value;
                saveState();
            });
        };

        bindInput('length', 'length');
        bindInput('word-count', 'wordCount');
        bindInput('separator', 'separator');
        bindInput('capitalize', 'capitalize', 'checked');
        bindInput('append-number', 'appendNumber', 'checked');

        // Special Logic for "Temporary" vs "Seasonal"
        // We'll use a dropdown for 'Bank Type' in the UI if it exists, or toggle logic
        const bankSelect = document.getElementById('bank-type');
        if (bankSelect) {
            bankSelect.addEventListener('change', () => {
                state.config.seasonalBank = bankSelect.value;
                saveState();
            });
        }
    }

    function toggleControls() {
        const isPassphrase = state.config.mode === 'passphrase';
        document.getElementById('passphrase-options').classList.toggle('hidden', !isPassphrase);
        document.getElementById('random-options').classList.toggle('hidden', isPassphrase);
    }

    function applyStateToUI() {
        // Mode
        const modeRadios = document.getElementsByName('mode');
        modeRadios.forEach(r => { if (r.value === state.config.mode) r.checked = true; });

        toggleControls();

        // Values
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

        setVal('length', state.config.length);
        setVal('word-count', state.config.wordCount);
        setVal('separator', state.config.separator);
        setCheck('capitalize', state.config.capitalize);
        setCheck('append-number', state.config.appendNumber);

        const bankSelect = document.getElementById('bank-type');
        if (bankSelect && state.config.seasonalBank) {
            bankSelect.value = state.config.seasonalBank;
        }

        renderHistory();
    }

    (async () => {
        // --- Dependency Check ---
        if (typeof SafeUI === 'undefined' || !SafeUI.isReady) {
            return;
        }

        const defaultState = {
            config: {
                mode: 'passphrase',
                length: 16,
                includeSpecial: true,
                includeNumbers: true,
                wordbank: 'Noun',
                wordCount: 3,
                separator: '-',
                capitalize: true,
                appendNumber: true,
                seasonalBank: 'Seasonal' // 'Seasonal', 'Noun', 'none' (for temp)
            },
            history: []
        };

        const ctx = await AppLifecycle.initPage({
            storageKey: APP_CONFIG.DATA_KEY,
            defaultState: defaultState,
            version: APP_CONFIG.VERSION,
            requiredElements: [
                'navbar-container', 'password-display', 'btn-generate', 'btn-copy',
                'passphrase-options', 'random-options'
            ]
        });

        if (!ctx) return;

        DOMElements = ctx.elements;
        state = ctx.state;
        saveState = ctx.saveState;

        await loadWordbanks();
        applyStateToUI();
        attachListeners();

        // Initial Generate
        updateOutput();
    })();
}
