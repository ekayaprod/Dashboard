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
            // If the cell contains a comma, a quote, or a newline, enclose it in quotes
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
    fromCSV: (file, requiredHeaders) => {
        return new Promise((resolve, reject) => {
            SafeUI.readTextFile(file,
                (text) => {
                    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
                    if (lines.length === 0) {
                        return resolve({ data: [], errors: [] });
                    }

                    const headerLine = lines.shift();
                    const headers = headerLine.split(',').map(h => h.trim());
                    const errors = [];

                    // Check if all required headers are present
                    for (const reqHeader of requiredHeaders) {
                        if (!headers.includes(reqHeader)) {
                            errors.push(`Missing required CSV header: "${reqHeader}"`);
                        }
                    }
                    if (errors.length > 0) {
                        // If required headers are missing, we can't parse
                        return reject(new Error(`CSV Import Failed: ${errors.join(', ')}`));
                    }

                    const data = lines.map((line, index) => {
                        const obj = {};
                        const values = line.split(','); // Simple split, no quote handling
                        
                        headers.forEach((header, i) => {
                            obj[header] = values[i] || '';
                        });
                        return obj;
                    });
                    
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

