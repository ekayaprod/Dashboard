/**
 * ============================================================================
 * app-data.js
 * * Contains data-centric logic: backup/restore and validation.
 * (Formerly data-management.js)
 * * Depends on: app-core.js (for SafeUI)
 * ============================================================================
 */

const BackupRestore = {
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

    validateBackup: (data, requiredKeys = []) => {
        if (!data || typeof data !== 'object' || !data.data || typeof data.data !== 'object') {
            return false;
        }
        
        return requiredKeys.every(key => key in data.data);
    },

    validateItems: (items, requiredFields) => {
        if (!Array.isArray(items)) return false;
        
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