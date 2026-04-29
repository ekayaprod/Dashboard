// import { LookupHelpers } from './helpers.js';

const LookupCSV = {
    columnMap: {
        'keyword': 'keyword',
        'assignment group': 'assignmentGroup',
        'notes': 'notes',
        'phone log path': 'phoneLogPath'
    },
    formatRowForExport: (row) => ({
        'Keyword': row.keyword || '',
        'Assignment Group': row.assignmentGroup || '',
        'Notes': row.notes || '',
        'Phone Log Path': row.phoneLogPath || ''
    }),
    normalizeImportedRow: (row) => DataHelpers.CSV.normalizeRow(row, LookupCSV.columnMap),
    validateRow: (row, index, existingItems) => {
        const entry = LookupHelpers.createEntry(row);
        const validation = LookupHelpers.validateEntry(entry);
        if (!validation.valid) return { error: `Row ${index + 2}: ${validation.errors.join(', ')}` };

        const contentKey = `${entry.keyword.toLowerCase()}|${entry.assignmentGroup.toLowerCase()}`;
        if (entry.id && existingItems.some(item => item.id === entry.id)) return { action: 'overwrite', entry: entry };
        if (existingItems.some(item => `${item.keyword.toLowerCase()}|${item.assignmentGroup.toLowerCase()}` === contentKey)) {
            return { error: `Row ${index + 2}: A identical entry (Keyword + Group) already exists. Row skipped.` };
        }
        return { action: 'add', entry: entry };
    }
};
