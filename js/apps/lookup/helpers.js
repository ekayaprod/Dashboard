const LookupHelpers = {
    createEntry: (partial = {}) => ({
        id: partial.id || SafeUI.generateId(),
        keyword: (partial.keyword || '').trim(),
        assignmentGroup: (partial.assignmentGroup || '').trim(),
        notes: (partial.notes || '').trim(),
        phoneLogPath: (partial.phoneLogPath || '').trim()
    }),
    validateEntry: (entry) => {
        const errors = [];
        if (!entry.keyword?.trim()) errors.push('Keyword required');
        return { valid: errors.length === 0, errors };
    },
    keywordUtils: {
        parse: (keywordString) => keywordString.split(',').map(k => k.trim()).filter(Boolean),
        merge: (keywordString1, keywordString2, caseSensitive = false) => {
            const keywords1 = LookupHelpers.keywordUtils.parse(keywordString1);
            const keywords2 = LookupHelpers.keywordUtils.parse(keywordString2);
            if (caseSensitive) return [...new Set([...keywords1, ...keywords2])].join(', ');
            const keywordMap = new Map();
            [...keywords1, ...keywords2].forEach(kw => {
                const key = kw.toLowerCase();
                if (!keywordMap.has(key)) keywordMap.set(key, kw);
            });
            return Array.from(keywordMap.values()).join(', ');
        }
    },
    validateSearchUrl: (url) => {
        if (!url) return { valid: false, message: 'URL required' };
        if (!/\{query\}/i.test(url)) return { valid: false, message: 'Must contain {query}' };
        try {
            const testUrl = url.replace(/\{query\}/ig, 'test');
            const urlObj = new URL(testUrl);
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                return { valid: false, message: 'Must use http:// or https://' };
            }
        } catch (e) {
            return { valid: false, message: 'The URL format is invalid.' };
        }
        return { valid: true, message: '' };
    },
    modalActions: {
        cancelAndConfirm: (label, callback, isDangerous = false) => [
            { label: 'Cancel' },
            { label, class: isDangerous ? 'btn-danger' : 'btn-primary', callback }
        ],
        cancelAndMultiple: (actions) => [ { label: 'Cancel' }, ...actions ]
    }
};
