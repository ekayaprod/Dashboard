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
    },

    /**
     * FIX: Mode D - Consolidated backup/restore UI logic
     * Attaches backup/restore handlers and manages the confirmation modal flow.
     */
    setupBackupRestoreHandlers: (config) => {
        const { 
            backupBtn, 
            restoreBtn, 
            state, 
            appName, 
            itemValidators, 
            onRestore, // This is the page-specific function to *apply* the state
            legacyAppName = null,
            restoreConfirmMessage = 'Overwrite all data with this backup?'
        } = config;
    
        if (!backupBtn || !restoreBtn) {
            console.error("setupBackupRestoreHandlers: Missing backup or restore button.");
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
                legacyAppName: legacyAppName,
                itemValidators: itemValidators,
                onRestore: (dataToRestore, isLegacy) => {
                    // Handle the confirmation modal *inside* this helper
                    SafeUI.showModal('Confirm Restore', 
                        `<p>${SafeUI.escapeHTML(restoreConfirmMessage)}</p><p>This cannot be undone.</p>`, 
                        [
                            { label: 'Cancel' },
                            { 
                                label: 'Restore', 
                                class: 'button-danger', 
                                callback: () => {
                                    try {
                                        // Call the page-specific restore logic
                                        onRestore(dataToRestore, isLegacy);
                                        SafeUI.showToast('Data restored successfully.');
                                    } catch (err) {
                                        console.error('Restore failed during state update:', err);
                                        SafeUI.showModal('Restore Error', `<p>Failed to apply restore: ${SafeUI.escapeHTML(err.message)}</p>`, [{label: 'OK'}]);
                                    }
                                }
                            }
                        ]
                    );
                }
            });
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
            const itemValue = String(item[field]).toLowerCase().trim();
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

// --- FIX: Expose components to the global window scope ---
window.BackupRestore = BackupRestore;
window.DataValidator = DataValidator;
window.DataConverter = DataConverter;