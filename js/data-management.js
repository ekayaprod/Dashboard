/**
 * data-management.js
 * State persistence, backup/restore, and validation logic
 * Used by: index.html, lookup.html, template.html
 */

/**
 * BackupRestore - Handles JSON backup and restore operations
 */
const BackupRestore = {
    /**
     * Creates and triggers download of a JSON backup file
     * @param {Object} state - The current application state object
     * @param {string} appName - A prefix for the backup filename (e.g., 'dashboard')
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
            
            SafeUI.downloadJSON(dataStr, filename);
            SafeUI.showToast('Backup created successfully.');
            
        } catch (err) {
            console.error("Backup failed:", err);
            SafeUI.showModal('Backup Error', `<p>Failed to create backup: ${err.message}</p>`, [{label: 'OK'}]);
        }
    },

    /**
     * Opens file picker and attempts to restore from JSON file
     * @param {Function} onRestore - Callback function(data) called on successful file read/parse
     */
    restoreBackup: (onRestore) => {
        SafeUI.openFilePicker((file) => {
            SafeUI.readJSONFile(
                file,
                (parsedData) => {
                    // Pass the successfully parsed data to the callback
                    onRestore(parsedData);
                },
                (errorMsg) => {
                    // Handle JSON parsing or file read errors
                    SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(errorMsg)}</p>`, [{label: 'OK'}]);
                }
            );
        });
    },

    /**
     * Validates the high-level structure of a backup file
     * @param {Object} data - Parsed backup data
     * @param {Array<string>} [requiredKeys] - Optional array of keys to ensure exist in data.data
     * @returns {boolean} True if valid
     */
    validateBackup: (data, requiredKeys = []) => {
        if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
            return false;
        }
        
        // Check if all required keys exist in the 'data' property
        return requiredKeys.every(key => key in data.data);
    },

    /**
     * Validates an array of items, ensuring each item is an object with required fields
     * @param {Array} items - Array of items to check
     * @param {Array<string>} requiredFields - Keys that must exist in each item object
     * @returns {boolean} True if all items are valid
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
     * @param {Object} config - Configuration object
     * - appName {string} - The expected appName in the backup (e.g., 'dashboard')
     * - legacyAppName {string} - [Optional] A legacy appName to also accept (e.g., 'assignment_tool')
     * - itemValidators {Object} - An object where keys are state properties (e.g., 'apps')
     * and values are arrays of required fields (e.g., ['id', 'name'])
     * - onRestore {Function} - Callback(dataToValidate, isLegacy) called on success
     */
    handleRestoreUpload: (config) => {
        BackupRestore.restoreBackup((restoredData) => {
            try {
                // Handle new backup format (with metadata) or old format (just state)
                const dataToValidate = restoredData.data ? restoredData.data : restoredData;
                const isNewBackup = !!restoredData.data;
                const appName = restoredData.appName;
                
                const isLegacy = config.legacyAppName && appName === config.legacyAppName;
                const isCorrectApp = appName === config.appName;

                // If it's the new backup format, it MUST have a matching appName (or legacy name)
                if (isNewBackup && !isCorrectApp && !isLegacy) {
                    throw new Error(`This file is not a valid '${config.appName}' backup.`);
                }

                // Validate that the main data keys exist (e.g., 'apps', 'notes')
                const requiredDataKeys = Object.keys(config.itemValidators);
                if (isNewBackup && !BackupRestore.validateBackup(restoredData, requiredDataKeys)) {
                     throw new Error('Backup file is invalid or missing required data.');
                }

                // Validate the structure of items within each array
                for (const [key, fields] of Object.entries(config.itemValidators)) {
                    // It's ok if a key is missing (e.g., old backup), but if it exists, it must be valid
                    if (dataToValidate[key] && !BackupRestore.validateItems(dataToValidate[key], fields)) {
                        throw new Error(`Backup data for '${key}' contains corrupt items.`);
                    }
                }
                
                // All validations passed, call the page-specific restore handler
                config.onRestore(dataToValidate, isLegacy);

            } catch(err) {
                console.error("Restore failed:", err);
                SafeUI.showModal('Restore Failed', `<p>${SafeUI.escapeHTML(err.message)}</p>`, [{label: 'OK'}]);
            }
        });
    }
};

/**
 * DataValidator - Input validation utilities
 */
const DataValidator = {
    /**
     * Check for duplicate values in array
     * @param {Array} items - Array to check
     * @param {string} field - Field to check for duplicates
     * @param {*} value - Value to check
     * @param {*} excludeId - ID to exclude from check (for updates)
     * @returns {boolean} True if duplicate found
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
     * @param {Object} fields - Object with field values to validate
     * @param {Object} rules - Validation rules for each field
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validateFields: (fields, rules) => {
        const errors = [];
        
        for (const [fieldName, value] of Object.entries(fields)) {
            const fieldRules = rules[fieldName];
            if (!fieldRules) continue;
            
            const trimmedValue = String(value).trim();
            
            // Required check
            if (fieldRules.required && !trimmedValue) {
                errors.push(`${fieldName} is required`);
                continue;
            }
            
            // Max length check
            if (fieldRules.maxLength && trimmedValue.length > fieldRules.maxLength) {
                errors.push(`${fieldName} must be ${fieldRules.maxLength} characters or less`);
            }
            
            // Min length check
            if (fieldRules.minLength && trimmedValue.length < fieldRules.minLength) {
                errors.push(`${fieldName} must be at least ${fieldRules.minLength} characters`);
            }
            
            // Pattern check
            if (fieldRules.pattern && trimmedValue && !fieldRules.pattern.test(trimmedValue)) {
                errors.push(`${fieldName} format is invalid`);
            }
            
            // Custom validator
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
// Removed the extra closing brace from here
