/**
 * app-data.js
 * (Was data-management.js)
 * * State persistence, backup/restore, and validation logic
 * Depends on: app-core.js
 */

const BackupRestore = {
    /**
     * Creates and triggers download of a JSON backup file
     */
    createBackup: (state, appName = 'app') => {
        try {
            const backupData = {
                appName: appName,
                version: state.version || 'unknown',
                timestamp: new Date().toISOString(),
                data: state
            };
            const dataStr = JSON.stringify(backupData, null, 2);
            const filename = `${appName}-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            SafeUI.downloadJSON(dataStr, filename, 'application/json');
            SafeUI.showToast('Backup created successfully.');
            
        } catch (err) {
            console.error("Backup failed:", err);
            SafeUI.showModal('Backup Error', `<p>Failed to create backup: ${err.message}</p>`, [{label: 'OK'}]);
        }
    },

    /**
     * Opens file picker and attempts to restore from JSON file
     */
    restoreBackup: (onRestore) => {
        SafeUI.openFilePicker((file) => {
            SafeUI.readJSONFile(
                file,
                (parsedData) => {
                    onRestore(parsedData);
                },
                (errorMsg) => {
                    SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(errorMsg)}</p>`, [{label: 'OK'}]);
                }
            );
        });
    },

    /**
     * Validates the high-level structure of a backup file
     */
    validateBackup: (data, requiredKeys = []) => {
        if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
            return false;
        }
        
        return requiredKeys.every(key => key in data.data);
    },

    /**
     * Validates an array of items, ensuring each item is an object with required fields
     */
    validateItems: (items, requiredFields) => {
        if (!Array.isArray(items)) return false;
        
        return items.every(item => {
            if (!item || typeof item !== 'object') return false;
            return requiredFields.every(field => field in item);
        });
    },

    /**
     * Handles the complete backup restore flow: file picking, reading, and validation.
     * This was added in Mode D refactoring.
     */
    setupBackupRestoreHandlers: (config) => {
        const {
            backupBtn,
            restoreBtn,
            state,
            appName,
            itemValidators,
            restoreConfirmMessage,
            onRestore
        } = config;

        if (!backupBtn || !restoreBtn) {
            console.error('Backup/Restore buttons not provided to setup');
            return;
        }

        // 1. Backup Button Handler
        backupBtn.addEventListener('click', () => {
            BackupRestore.createBackup(state, appName);
        });

        // 2. Restore Button Handler
        restoreBtn.addEventListener('click', () => {
            BackupRestore.handleRestoreUpload({
                appName: appName,
                itemValidators: itemValidators,
                onRestore: (dataToRestore) => {
                    // Show confirmation modal
                    SafeUI.showModal('Confirm Restore (JSON)',
                        `<p>${SafeUI.escapeHTML(restoreConfirmMessage)}</p>`,
                        [
                            { label: 'Cancel' },
                            {
                                label: 'Restore',
                                class: 'button-danger',
                                callback: async () => {
                                    try {
                                        // Call the page-specific restore logic
                                        onRestore(dataToRestore);
                                        // Save/render is handled by onRestore
                                        SafeUI.showToast('Restore successful.');
                                    } catch (err) {
                                        console.error('Restore failed during save:', err);
                                        SafeUI.showModal('Restore Error', `<p>Failed to apply restore: ${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                                    }
                                }
                            }
                        ]
                    );
                }
            });
        });
    },


    /**
     * Handles the complete backup restore flow: file picking, reading, and validation.
     */
    handleRestoreUpload: (config) => {
        BackupRestore.restoreBackup((restoredData) => {
            try {
                const dataToValidate = restoredData.data ? restoredData.data : restoredData;
                const isNewBackup = !!restoredData.data;
                const appName = restoredData.appName;
                
                const isLegacy = config.legacyAppName && appName === config.legacyAppName;
                const isCorrectApp = appName === config.appName;

                if (isNewBackup && !isCorrectApp && !isLegacy) {
                    throw new Error(`This file is not a valid '${config.appName}' backup.`);
                }

                const requiredDataKeys = Object.keys(config.itemValidators);
                if (isNewBackup && !BackupRestore.validateBackup(restoredData, requiredDataKeys)) {
                     throw new Error('Backup file is invalid or missing required data.');
                }

                for (const [key, fields] of Object.entries(config.itemValidators)) {
                    if (dataToValidate[key] && !BackupRestore.validateItems(dataToValidate[key], fields)) {
                        throw new Error(`Backup data for '${key}' contains corrupt items.`);
                    }
                }
                
                config.onRestore(dataToValidate, isLegacy);

            } catch(err) {
                console.error("Restore failed:", err);
                SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{label: 'OK'}]);
            }
        });
    }
};

const DataValidator = {
    /**
     * Check for duplicate values in array
     */
    hasDuplicate: (items, field, value, excludeId = null) => {
        if (!Array.isArray(items)) return false;
        const normalizedValue = String(value).toLowerCase().trim();
        
        return items.some(item => {
            if (excludeId && item.id === excludeId) return false;
            // Use optional chaining for safety
            const itemValue = String(item?.[field] || '').toLowerCase().trim();
            return itemValue === normalizedValue;
        });
    },

    /**
     * Validate form fields with common rules
     */
    validateFields: (fields, rules) => {
        const errors = [];
        
        for (const [fieldName, value] of Object.entries(fields)) {
            const fieldRules = rules[fieldName];
            if (!fieldRules) continue;
            
            const trimmedValue = String(value).trim();
            
            if (fieldRules.required && !trimmedValue) {
                errors.push(`${fieldName} is required`);
                continue;
            }
            
            if (fieldRules.maxLength && trimmedValue.length > fieldRules.maxLength) {
                errors.push(`${fieldName} must be ${fieldRules.maxLength} characters or less`);
            }
            
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

/**
 * DataConverter - Handles CSV parsing and generation
 */
const DataConverter = {
    /**
     * Converts an array of objects to a CSV string.
     */
    toCSV: (data, headers) => {
        if (!Array.isArray(data) || !Array.isArray(headers) || headers.length === 0) {
            throw new Error("Invalid data or headers for CSV conversion.");
        }

        const escapeCell = (cell) => {
            const str = String(cell == null ? '' : cell);
            if (str.includes('"') || str.includes(',') || str.includes('\n')) {
                // Escape existing quotes by doubling them
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
     * Converts a CSV file object to an array of objects.
     */
    // FIX: Issue #17 - Replace with robust state-machine parser
    fromCSV: (file, requiredHeaders) => {
        return new Promise((resolve, reject) => {
            SafeUI.readTextFile(file,
                (text) => {
                    const lines = [];
                    let currentLine = '';
                    let inQuotes = false;
                    
                    // First pass: properly split lines respecting quoted newlines
                    for (let i = 0; i < text.length; i++) {
                        const char = text[i];
                        const nextChar = text[i + 1];
                        
                        if (char === '"') {
                            if (inQuotes && nextChar === '"') {
                                // Escaped quote
                                currentLine += '""';
                                i++; // Skip next quote
                            } else {
                                // Toggle quote state
                                inQuotes = !inQuotes;
                                currentLine += char;
                            }
                        } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
                            // Line break outside quotes
                            if (currentLine.trim() || lines.length > 0) { // Keep lines if they are not just whitespace, unless it's first line
                                lines.push(currentLine);
                            }
                            currentLine = '';
                            if (char === '\r') i++; // Skip \n in \r\n
                        } else if (char !== '\r') {
                            // Regular character (skip standalone \r)
                            currentLine += char;
                        }
                    }
                    
                    // Add final line
                    if (currentLine.trim() || lines.length > 0) {
                        lines.push(currentLine);
                    }
                    
                    if (lines.length === 0) {
                        return resolve({ data: [], errors: [] });
                    }

                    const headerLine = lines.shift();
                    const headers = [];
                    let currentHeader = '';
                    inQuotes = false;
                    
                    // Parse headers
                    for (let i = 0; i < headerLine.length; i++) {
                        const char = headerLine[i];
                        const nextChar = headerLine[i + 1];
                        
                        if (char === '"') {
                            if (inQuotes && nextChar === '"') {
                                currentHeader += '"';
                                i++;
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            headers.push(currentHeader.trim());
                            currentHeader = '';
                        } else {
                            currentHeader += char;
                        }
                    }
                    headers.push(currentHeader.trim());

                    const errors = [];

                    // Validate required headers
                    for (const reqHeader of requiredHeaders) {
                        if (!headers.includes(reqHeader)) {
                            errors.push(`Missing required CSV header: "${reqHeader}"`);
                        }
                    }
                    if (errors.length > 0) {
                        return reject(new Error(`CSV Import Failed: ${errors.join(', ')}`));
                    }

                    // Parse data rows
                    const data = lines.filter(line => line.trim().length > 0).map((line, lineIndex) => {
                        const obj = {};
                        const values = [];
                        let currentVal = '';
                        inQuotes = false;

                        for (let i = 0; i < line.length; i++) {
                            const char = line[i];
                            const nextChar = line[i + 1];

                            if (char === '"') {
                                if (inQuotes && nextChar === '"') {
                                    currentVal += '"';
                                    i++;
                                } else {
                                    inQuotes = !inQuotes;
                                }
                            } else if (char === ',' && !inQuotes) {
                                // Unescape "" back to "
                                values.push(currentVal.replace(/""/g, '"'));
                                currentVal = '';
                            } else {
                                currentVal += char;
                            }
                        }
                        // Unescape "" back to " for the last value
                        values.push(currentVal.replace(/""/g, '"'));

                        if (values.length > headers.length) {
                            errors.push(`Row ${lineIndex + 2}: Too many columns. Expected ${headers.length}, got ${values.length}. Truncating.`);
                        }

                        headers.forEach((header, i) => {
                            obj[header] = values[i] || '';
                        });
                        
                        return obj;
                    });
                    
                    if (errors.length > 10) {
                        errors.splice(10, errors.length - 10, `... and ${errors.length - 10} more errors.`);
                    }
                    
                    resolve({ data, errors });
                },
                (errorMsg) => {
                    reject(new Error(errorMsg));
                }
            );
        });
    }
};

// NEW: Consolidated CSV Management
const CsvManager = {
    /**
     * Attaches export logic to a button.
     * @param {HTMLElement} exportBtn - The export button element.
     * @param {function} getData - A function that returns the array of data to export.
     * @param {string[]} headers - An array of header strings.
     * @param {string} filename - The desired output filename.
     */
    setupExport: (exportBtn, getData, headers, filename) => {
        if (!exportBtn) return;
        exportBtn.addEventListener('click', () => {
            try {
                const data = getData();
                const csvString = DataConverter.toCSV(data, headers);
                SafeUI.downloadJSON(csvString, filename, 'text/csv');
            } catch (err) {
                console.error("Export failed:", err);
                SafeUI.showModal("Export Error", `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
            }
        });
    },

    /**
     * Attaches import logic to a button.
     * @param {object} config - Configuration object.
     * @param {HTMLElement} config.importBtn - The import button element.
     * @param {string[]} config.headers - Required CSV headers.
     * @param {function} config.onValidateRow - (row, index) => { valid: bool, error?: string, entry?: object }
     * @param {function} config.onConfirmImport - (sanitizedData) => void
     * @param {string} config.confirmMessage - The message for the confirmation modal.
     */
    setupImport: (config) => {
        const { importBtn, headers, onValidateRow, onConfirmImport, confirmMessage } = config;
        if (!importBtn) return;

        importBtn.addEventListener('click', () => {
            SafeUI.openFilePicker(async (file) => {
                try {
                    const { data, errors: parseErrors } = await DataConverter.fromCSV(file, headers);
                    
                    const sanitizedData = [];
                    const importErrors = [...parseErrors];

                    data.forEach((item, index) => {
                        const result = onValidateRow(item, index);
                        if (result.valid) {
                            sanitizedData.push(result.entry);
                        } else {
                            importErrors.push(`Row ${index + 2}: ${result.error}`);
                        }
                    });

                    if (importErrors.length > 0) {
                        const errorList = importErrors.slice(0, 10).map(e => `<li>${SafeUI.escapeHTML(e)}</li>`).join('');
                        const moreErrors = importErrors.length > 10 ? `<li>... and ${importErrors.length - 10} more errors.</li>` : '';
                        
                        SafeUI.showModal("Import Validation Errors", 
                            `<p>Some rows had errors and were skipped:</p>
                            <ul style="font-size: 0.8rem; max-height: 150px; overflow-y: auto; text-align: left;">
                                ${errorList}${moreErrors}
                            </ul>
                            <p><strong>${sanitizedData.length} valid rows found.</strong></p>`, 
                            [{ label: 'OK' }]
                        );
                    }

                    if (sanitizedData.length === 0) {
                        if (importErrors.length === 0) {
                            SafeUI.showModal("Import Failed", "<p>No valid data found in the CSV file.</p>", [{ label: 'OK' }]);
                        }
                        return;
                    }

                    SafeUI.showModal("Confirm Import", 
                        `<p>${SafeUI.escapeHTML(confirmMessage)}</p>`, 
                        [
                            { label: 'Cancel' },
                            {
                                label: 'Import', 
                                class: 'button-danger', 
                                callback: () => {
                                    onConfirmImport(sanitizedData);
                                    // Save/render is handled by the callback
                                }
                            }
                        ]
                    );

                } catch (err) {
                    console.error("Import failed:", err);
                    SafeUI.showModal("Import Error", `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{ label: 'OK' }]);
                }
            }, '.csv');
        });
    }
};


// --- FIX: Expose components to the global window scope ---
window.BackupRestore = BackupRestore;
window.DataValidator = DataValidator;
window.DataConverter = DataConverter;
window.CsvManager = CsvManager; // NEW