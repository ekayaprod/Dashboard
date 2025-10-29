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
     * * Example:
     * BackupRestore.createBackup(state, 'myapp');
     * // Triggers download for 'myapp-backup-2024-01-15.json'
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
     * * Example:
     * BackupRestore.restoreBackup((backupData) => {
     * // Validate and apply backup data
     * if (backupData.appName === 'myapp') {
     * state = backupData.data;
     * saveState();
     * SafeUI.showToast('Restore successful');
     * } else {
     * SafeUI.showModal('Error', '<p>Not a 'myapp' backup file.</p>', [{label: 'OK'}]);
     * }
     * });
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
     * * Example:
     * const data = JSON.parse(fileContent);
     * if (!BackupRestore.validateBackup(data, ['apps', 'notes'])) {
     * SafeUI.showModal('Error', '<p>Invalid backup file structure.</p>', [{label: 'OK'}]);
     * return;
     * }
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
     * * Example:
     * if (!BackupRestore.validateItems(data.apps, ['id', 'name', 'url'])) {
     * SafeUI.showModal('Invalid Data', '<p>Some items are corrupt.</p>', [{label: 'OK'}]);
     * return;
     * }
     */
    validateItems: (items, requiredFields) => {
        if (!Array.isArray(items)) return false;
        
        return items.every(item => {
            if (!item || typeof item !== 'object') return false;
            return requiredFields.every(field => field in item);
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
     * * Example:
     * const isDuplicate = DataValidator.hasDuplicate(
     * state.apps,
     * 'name',
     * 'Slack',
     * currentApp.id  // Exclude current app when editing
     * );
     * * if (isDuplicate) {
     * SafeUI.showValidationError('Duplicate Name', 'This name already exists.', 'app-name-input');
     * return false;
     * }
     */
    hasDuplicate: (items, field, value, excludeId = null) => {
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
     * * Example:
     * const result = DataValidator.validateFields(
     * {
     * name: document.getElementById('name').value,
     * email: document.getElementById('email').value
     * },
     * {
     * name: { required: true, maxLength: 50 },
     * email: { required: true, pattern: /^.+@.+\..+$/ }
     * }
     * );
     * * if (!result.valid) {
     * SafeUI.showModal('Validation Error', `<p>${result.errors.join('<br>')}</p>`, [{label: 'OK'}]);
     * return;
     * }
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