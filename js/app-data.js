/**
 * app-data.js
 * State persistence, backup/restore, and validation logic.
 * Depends on: app-core.js
 */

const BackupRestore = (() => {
    return {
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

        validateBackup: (data, requiredKeys = []) => {
            if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
                return false;
            }
            return requiredKeys.every(key => key in data.data);
        },

        validateItems: (items, requiredFields) => {
            if (!Array.isArray(items)) return false;
            if (requiredFields.length === 0) return true;

            return items.every(item => {
                if (!item || typeof item !== 'object') return false;
                return requiredFields.every(field => field in item);
            });
        },

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
        hasDuplicate: (items, field, value, excludeId = null) => {
            if (!Array.isArray(items)) return false;
            const normalizedValue = String(value).toLowerCase().trim();

            return items.some(item => {
                if (excludeId && item.id === excludeId) return false;
                const itemValue = String(item[field]).toLowerCase().trim();
                return itemValue === normalizedValue;
            });
        },

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

                if (errors.length > 10) {
                    errors.splice(10, errors.length - 10, `... and ${errors.length - 10} more errors.`);
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

        findItemById: (rootItems, id) => {
            if (id === 'root') return { id: 'root', name: 'Root', children: rootItems, type: 'folder' };
            const result = TreeUtils.findInTree(rootItems, i => i.id === id);
            return result ? result.item : null;
        },

        findParentOfItem: (rootItems, childId) => {
            if (childId === 'root') return null;
            const result = TreeUtils.findInTree(rootItems, i => i.id === childId);
            return result ? (result.parent || { id: 'root', children: rootItems }) : null;
        },

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