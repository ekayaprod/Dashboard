/**
 * app-data.js
 * State persistence, backup/restore, and validation logic.
 * Depends on: app-core.js
 */

const BackupRestore = (() => {
    return {
        /**
         * Creates a JSON backup of the current application state and triggers a download.
         *
         * @param {Object} state - The current application state object.
         * @param {string} [appName='app'] - The name of the application (used for filename).
         */
        createBackup: (state, appName = 'app') => {
            try {
                const backupData = {
                    appName: appName,
                    timestamp: new Date().toISOString(),
                    data: state
                };
                
                const dataStr = JSON.stringify(backupData, null, 2);
                const filename = `${appName}-backup-${new Date().toISOString().split('T')[0]}.json`;

                SafeUI.downloadJSON(dataStr, filename, 'application/json');
                SafeUI.showToast('Backup created successfully.');

            } catch (err) {
                console.error("Backup failed:", err);
                SafeUI.showModal('Backup Error', `<p>Failed to create backup: ${err.message}</p>`, [{ label: 'OK' }]);
            }
        },

        /**
         * Opens a file picker to upload a JSON backup file and restores it.
         *
         * @param {Function} onRestore - Callback function invoked with the parsed data upon success.
         */
        restoreBackup: (onRestore) => {
            SafeUI.openFilePicker((file) => {
                SafeUI.readJSONFile(file)
                    .then(parsedData => {
                        onRestore(parsedData);
                    })
                    .catch(err => {
                        SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                    });
            });
        },

        /**
         * Validates the structure of a backup object.
         *
         * @param {Object} data - The backup data object (expected to have `data` property).
         * @param {string[]} [requiredKeys=[]] - List of keys that must exist in `data.data`.
         * @returns {boolean} True if the backup is valid, false otherwise.
         */
        validateBackup: (data, requiredKeys = []) => {
            if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
                return false;
            }
            return requiredKeys.every(key => key in data.data);
        },

        /**
         * Validates an array of items to ensure they contain required fields.
         *
         * @param {Object[]} items - The array of items to validate.
         * @param {string[]} requiredFields - List of fields that each item must have.
         * @returns {boolean} True if all items are valid, false otherwise.
         */
        validateItems: (items, requiredFields) => {
            if (!Array.isArray(items)) return false;
            if (requiredFields.length === 0) return true;

            return items.every(item => {
                if (!item || typeof item !== 'object') return false;
                return requiredFields.every(field => field in item);
            });
        },

        /**
         * Orchestrates the restore process, including validation and confirmation.
         *
         * @param {Object} config - Configuration object.
         * @param {string} config.appName - Expected application name in the backup.
         * @param {Object} config.itemValidators - Map of data keys to required field arrays.
         * @param {Function} config.onRestore - Callback invoked with validated data ready for restore.
         * @throws {Error} If validation fails or app name mismatches.
         */
        handleRestoreUpload: (config) => {
            BackupRestore.restoreBackup((restoredData) => {
                try {
                    const dataToValidate = restoredData.data ? restoredData.data : restoredData;
                    const isNewBackup = !!restoredData.data;
                    const appName = restoredData.appName;

                    const isCorrectApp = appName === config.appName;

                    if (isNewBackup && !isCorrectApp) {
                        throw new Error(`This file is not a valid '${config.appName}' backup.`);
                    }

                    const requiredDataKeys = Object.keys(config.itemValidators);
                    if (isNewBackup && !BackupRestore.validateBackup(restoredData, requiredDataKeys)) {
                        throw new Error('Backup file is invalid or missing required data keys.');
                    }

                    for (const [key, fields] of Object.entries(config.itemValidators)) {
                        if (dataToValidate[key] && !BackupRestore.validateItems(dataToValidate[key], fields)) {
                            throw new Error(`Backup data for '${key}' contains corrupt items.`);
                        }
                    }

                    config.onRestore(dataToValidate);

                } catch (err) {
                    console.error("Restore failed:", err);
                    SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                }
            });
        },

        /**
         * Sets up event listeners for backup and restore buttons.
         *
         * @param {Object} config - Configuration object.
         * @param {Object} config.state - The current application state.
         * @param {string} config.appName - The application name.
         * @param {HTMLElement} [config.backupBtn] - The button element to trigger backup.
         * @param {HTMLElement} [config.restoreBtn] - The button element to trigger restore.
         * @param {Object} config.itemValidators - Validators for restore verification.
         * @param {string} [config.restoreConfirmMessage] - Custom confirmation message.
         * @param {Function} config.onRestoreCallback - Callback to execute the actual state update.
         */
        setupBackupRestoreHandlers: (config) => {
            const {
                state,
                appName,
                backupBtn,
                restoreBtn,
                itemValidators,
                restoreConfirmMessage,
                onRestoreCallback
            } = config;

            if (backupBtn) {
                backupBtn.addEventListener('click', () => {
                    BackupRestore.createBackup(state, appName);
                });
            }

            if (restoreBtn) {
                restoreBtn.addEventListener('click', () => {
                    BackupRestore.handleRestoreUpload({
                        appName: appName,
                        itemValidators: itemValidators,
                        onRestore: (dataToRestore) => {
                            SafeUI.showModal("Confirm Restore (JSON)",
                                `<p>${SafeUI.escapeHTML(restoreConfirmMessage || 'Overwrite all data?')}</p>`,
                                [
                                    { label: 'Cancel' },
                                    {
                                        label: 'Restore',
                                        class: 'button-danger',
                                        callback: () => {
                                            onRestoreCallback(dataToRestore);
                                        }
                                    }
                                ]
                            );
                        }
                    });
                });
            }
        }
    };
})();

const DataValidator = (() => {
    return {
        /**
         * Checks if a value already exists in a specific field within an array of items.
         * Case-insensitive.
         *
         * @param {Object[]} items - The array of items to check.
         * @param {string} field - The property name to check against.
         * @param {string|number} value - The value to look for.
         * @param {string|number|null} [excludeId=null] - An ID to exclude from the check (useful for updates).
         * @returns {boolean} True if a duplicate is found, false otherwise.
         */
        hasDuplicate: (items, field, value, excludeId = null) => {
            if (!Array.isArray(items)) return false;
            const normalizedValue = String(value).toLowerCase().trim();

            return items.some(item => {
                if (excludeId && item.id === excludeId) return false;
                const itemValue = String(item[field]).toLowerCase().trim();
                return itemValue === normalizedValue;
            });
        },

        /**
         * Validates a set of fields against a schema of rules.
         *
         * @param {Object} fields - Key-value pairs of field names and their values.
         * @param {Object} rules - Schema defining validation rules for each field.
         * @param {boolean} [rules.fieldName.required] - If true, value must not be empty.
         * @param {number} [rules.fieldName.maxLength] - Maximum character length.
         * @param {number} [rules.fieldName.minLength] - Minimum character length.
         * @param {RegExp} [rules.fieldName.pattern] - Regex pattern the value must match.
         * @param {Function} [rules.fieldName.custom] - Custom validation function (value => boolean).
         * @param {string} [rules.fieldName.customMessage] - Error message for custom validation failure.
         * @returns {{valid: boolean, errors: string[]}} Result object containing validity status and error messages.
         */
        validateFields: (fields, rules) => {
            const errors = [];

            for (const [fieldName, value] of Object.entries(fields)) {
                const fieldRules = rules[fieldName];
                if (!fieldRules) continue;

                // Optimization: Use CoreValidators via SafeUI for standard checks
                if (fieldRules.required && !SafeUI.validators.notEmpty(value)) {
                    errors.push(`${fieldName} is required`);
                    continue;
                }

                if (fieldRules.maxLength && !SafeUI.validators.maxLength(value, fieldRules.maxLength)) {
                    errors.push(`${fieldName} must be ${fieldRules.maxLength} characters or less`);
                }

                const trimmedValue = String(value).trim();

                if (fieldRules.minLength && trimmedValue.length < fieldRules.minLength) {
                    errors.push(`${fieldName} must be at least ${fieldRules.minLength} characters`);
                }

                if (fieldRules.pattern && trimmedValue && !fieldRules.pattern.test(trimmedValue)) {
                    errors.push(`${fieldName} format is invalid`);
                }

                if (fieldRules.custom && !fieldRules.custom(trimmedValue)) {
                    errors.push(fieldRules.customMessage || `${fieldName} is invalid`);
                }
            }

            return {
                valid: errors.length === 0,
                errors
            };
        }
    };
})();

const DataConverter = (() => {
    const MAX_DISPLAY_ERRORS = 10;

    const _parseCsvLine = (line) => {
        const values = [];
        let currentVal = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') {
                        currentVal += '"';
                        i++;
                    } else {
                        inQuotes = false;
                    }
                } else {
                    currentVal += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    currentVal = currentVal.replace(/""/g, '"');
                    values.push(currentVal);
                    currentVal = '';
                } else {
                    currentVal += char;
                }
            }
        }

        currentVal = currentVal.replace(/""/g, '"');
        values.push(currentVal);
        return values;
    };

    return {
        /**
         * Converts an array of objects to a CSV string.
         * Handles quoting and escaping of special characters.
         *
         * @param {Object[]} data - The array of data objects.
         * @param {string[]} headers - The list of keys to export as columns.
         * @returns {string} The formatted CSV string.
         *
         * @example
         * const data = [
         *   { name: "Alice", role: "Admin" },
         *   { name: "Bob", role: "User, Guest" } // Contains comma
         * ];
         * const csv = DataConverter.toCSV(data, ["name", "role"]);
         * // Returns:
         * // name,role
         * // Alice,Admin
         * // Bob,"User, Guest"
         */
        toCSV: (data, headers) => {
            if (!Array.isArray(data) || !Array.isArray(headers) || headers.length === 0) {
                throw new Error("Invalid data or headers for CSV conversion.");
            }

            const escapeCell = (cell) => {
                const str = String(cell == null ? '' : cell);
                if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            const headerRow = headers.join(',');
            const rows = data.map(obj => {
                return headers.map(header => escapeCell(obj[header])).join(',');
            });

            return [headerRow, ...rows].join('\n');
        },

        /**
         * Parses a CSV file into an array of objects.
         * Handles quoted values and validates headers.
         *
         * @param {File} file - The CSV file object to parse.
         * @param {string[]} requiredHeaders - List of column headers that must be present.
         * @returns {Promise<{data: Object[], errors: string[]}>} Promise resolving to data and errors.
         * @throws {Error} If file reading fails or validation errors exceed threshold.
         */
        fromCSV: async (file, requiredHeaders) => {
            const text = await SafeUI.readTextFile(file);
            const lines = [];
                let currentLine = '';
                let inQuotes = false;

                const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

                for (let i = 0; i < normalizedText.length; i++) {
                    const char = normalizedText[i];

                    if (char === '"') {
                        inQuotes = !inQuotes;
                    }

                    if (char === '\n' && !inQuotes) {
                        if (currentLine.trim() || lines.length > 0) {
                            lines.push(currentLine);
                        }
                        currentLine = '';
                    } else {
                        currentLine += char;
                    }
                }

                if (currentLine.trim() || lines.length > 0) {
                    lines.push(currentLine);
                }

                if (lines.length === 0) {
                    return { data: [], errors: [] };
                }

                const headerLine = lines.shift();
                const headers = _parseCsvLine(headerLine).map(h => h.trim());

                if (headers.length === 0 || (headers.length === 1 && headers[0] === '')) {
                     throw new Error("CSV file is empty or has invalid headers.");
                }

                const errors = [];

                for (const reqHeader of requiredHeaders) {
                    if (!headers.includes(reqHeader)) {
                        errors.push(`Missing required CSV header: "${reqHeader}"`);
                    }
                }
                if (errors.length > 0) {
                    throw new Error(`CSV Import Failed: ${errors.join(', ')}`);
                }

                const data = lines.filter(line => line.trim().length > 0).map((line, lineIndex) => {
                    const obj = {};
                    const values = _parseCsvLine(line);

                    if (values.length > headers.length) {
                        errors.push(`Row ${lineIndex + 2}: Too many columns. Expected ${headers.length}, got ${values.length}. Truncating.`);
                    }

                    headers.forEach((header, i) => {
                        if (requiredHeaders.includes(header)) {
                            obj[header] = values[i] || '';
                        }
                    });

                    return obj;
                });

                if (errors.length > MAX_DISPLAY_ERRORS) {
                    errors.splice(MAX_DISPLAY_ERRORS, errors.length - MAX_DISPLAY_ERRORS, `... and ${errors.length - MAX_DISPLAY_ERRORS} more errors.`);
                }

                return { data, errors };
        }
    };
})();

const CsvManager = (() => {
    const _getTimestamp = () => {
        const d = new Date();
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        const s = String(d.getSeconds()).padStart(2, '0');
        return `${Y}${M}${D}_${h}${m}${s}`;
    };

    return {
        /**
         * Attaches a click listener to the export button to generate and download a CSV file.
         *
         * @param {Object} config - Configuration object.
         * @param {HTMLElement} config.exportBtn - The button to trigger export.
         * @param {Function} config.dataGetter - Function returning the array of data to export.
         * @param {string[]} config.headers - List of keys to include in the CSV.
         * @param {string} config.filename - The base filename for the download.
         */
        setupExport: (config) => {
            if (!config.exportBtn) return;

            config.exportBtn.addEventListener('click', () => {
                try {
                    const data = config.dataGetter();

                    if (!Array.isArray(data)) {
                        throw new Error("Data getter did not return an array.");
                    }

                    const csvString = DataConverter.toCSV(data, config.headers);

                    const baseFilename = config.filename.replace(/\.csv$/, '');
                    const timestamp = _getTimestamp();
                    const finalFilename = `${baseFilename}_${timestamp}.csv`;

                    SafeUI.downloadJSON(csvString, finalFilename, 'text/csv');

                } catch (err) {
                    console.error("Export failed:", err);
                    SafeUI.showModal("Export Error", `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                }
            });
        },

        /**
         * Attaches a click listener to the import button to handle CSV file upload and processing.
         *
         * @param {Object} config - Configuration object.
         * @param {HTMLElement} config.importBtn - The button to trigger import.
         * @param {string[]} config.headers - Expected headers in the CSV file.
         * @param {Function} config.onValidate - Function to validate each row (row, index, currentData).
         * @param {Function} config.onConfirm - Function called with valid data to finalize import.
         * @param {Function} [config.stateItemsGetter] - Optional function to get current items for validation context.
         */
        setupImport: (config) => {
            if (!config.importBtn) return;

            config.importBtn.addEventListener('click', () => {
                SafeUI.openFilePicker(async (file) => {
                    try {
                        const { data, errors: parseErrors } = await DataConverter.fromCSV(file, config.headers);

                        const validatedData = [];
                        const validationErrors = [...parseErrors];

                        if (typeof config.onValidate !== 'function') {
                            throw new Error("Import validation is not configured.");
                        }

                        data.forEach((row, index) => {
                            const result = config.onValidate(row, index, config.stateItemsGetter ? config.stateItemsGetter() : undefined);
                            if (result.error) {
                                validationErrors.push(result.error);
                            } else {
                                validatedData.push(result.entry);
                            }
                        });

                        if (validatedData.length === 0 && validationErrors.length === 0) {
                            SafeUI.showModal("Import Failed", "<p>No valid data rows found in the CSV file.</p>", [{ label: 'OK' }]);
                            return;
                        }

                        if (typeof config.onConfirm !== 'function') {
                            throw new Error("Import confirmation is not configured.");
                        }

                        config.onConfirm(validatedData, validationErrors);

                    } catch (err) {
                        console.error("Import failed:", err);
                        SafeUI.showModal("Import Error", `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                    }
                }, '.csv');
            });
        }
    };
})();

const TreeUtils = (() => {
    return {
        /**
         * Recursively searches for an item in a tree structure.
         *
         * @param {Object[]} items - The array of tree nodes (items/folders).
         * @param {Function} predicate - A function that returns true for the target item.
         * @param {Object|null} [parent=null] - Internal use: the parent of the current items.
         * @returns {{item: Object, parent: Object|null}|null} The found item and its parent, or null.
         *
         * @example
         * const tree = [
         *   { id: 1, name: "Root", type: "folder", children: [{ id: 2, name: "Child" }] }
         * ];
         *
         * const result = TreeUtils.findInTree(tree, item => item.id === 2);
         * // Returns { item: { id: 2, name: "Child" }, parent: { id: 1, ... } }
         */
        findInTree: (items, predicate, parent = null) => {
            if (!Array.isArray(items)) return null;
            for (const item of items) {
                if (predicate(item)) return { item, parent };
                if (item.type === 'folder' && item.children) {
                    const result = TreeUtils.findInTree(item.children, predicate, item);
                    if (result) return result;
                }
            }
            return null;
        },

        /**
         * Finds a specific item by its ID within the tree.
         *
         * @param {Object[]} rootItems - The root array of the tree.
         * @param {string} id - The ID of the item to find.
         * @returns {Object|null} The found item or null if not found.
         */
        findItemById: (rootItems, id) => {
            if (id === 'root') return { id: 'root', name: 'Root', children: rootItems, type: 'folder' };
            const result = TreeUtils.findInTree(rootItems, i => i.id === id);
            return result ? result.item : null;
        },

        /**
         * Finds the parent folder of a specific item.
         *
         * @param {Object[]} rootItems - The root array of the tree.
         * @param {string} childId - The ID of the child item.
         * @returns {Object|null} The parent folder object or null.
         */
        findParentOfItem: (rootItems, childId) => {
            if (childId === 'root') return null;
            const result = TreeUtils.findInTree(rootItems, i => i.id === childId);
            return result ? (result.parent || { id: 'root', children: rootItems }) : null;
        },

        /**
         * Flattens the tree to return a list of all folder items.
         * Useful for populating dropdowns or move-to dialogues.
         *
         * @param {Object[]} items - The tree items to traverse.
         * @param {number} [level=0] - Internal recursion level tracker.
         * @returns {Object[]} Array of folder objects with `level` property for indentation.
         */
        getAllFolders: (items, level = 0) => {
            let folders = [];
            if (level === 0) folders.push({ id: 'root', name: 'Root', level: 0 });

            if (!Array.isArray(items)) return folders;

            items.forEach(item => {
                if (item.type === 'folder') {
                    folders.push({ id: item.id, name: item.name, level: level + 1 });
                    if (item.children) {
                        folders = folders.concat(TreeUtils.getAllFolders(item.children, level + 1));
                    }
                }
            });
            return folders;
        },

        /**
         * Generates the breadcrumb path from root to a specific folder.
         *
         * @param {Object[]} rootItems - The root array of the tree.
         * @param {string} folderId - The target folder ID.
         * @returns {Object[]} Array of objects representing the path (each has id and name).
         */
        getBreadcrumbPath: (rootItems, folderId) => {
            if (folderId === 'root') return [{ id: 'root', name: 'Root' }];
            const path = [];
            const visitedIds = new Set();
            const stack = rootItems.map(item => [item, []]);
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
    };
})();

window.BackupRestore = BackupRestore;
window.DataValidator = DataValidator;
window.DataConverter = DataConverter;
window.CsvManager = CsvManager;
window.TreeUtils = TreeUtils;