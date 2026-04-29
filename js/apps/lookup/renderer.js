// import { LOOKUP_ICONS } from './icons.js';

const LookupRenderer = {
    renderSkeletons: (container, count = 3) => {
        container.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const li = document.createElement('li');
            li.className = 'skeleton-item';
            li.setAttribute('aria-hidden', 'true');
            li.innerHTML = `
                <div class="skeleton skeleton-block short"></div>
                <div class="skeleton skeleton-block medium"></div>
                <div class="skeleton skeleton-block"></div>
            `;
            fragment.appendChild(li);
        }
        container.appendChild(fragment);
    },

    getEmptyMessage: (lowerTerm, isEditMode) => {
        if (isEditMode) {
            return `
                <div class="empty-state-container" aria-live="polite">
                    <div class="empty-state-text">No entries. Add one?</div>
                </div>
            `;
        }

        if (lowerTerm) {
            const escapedTerm = SafeUI.escapeHTML(lowerTerm);
            return `
                <div class="empty-state-container" aria-live="polite">
                    <div class="empty-state-icon">
                        ${LOOKUP_ICONS.search.replace('width="16" height="16"', 'width="48" height="48"')}
                    </div>
                    <h3 class="empty-state-text empty-state-text-bold">No entries found for "${escapedTerm}"</h3>
                    <button class="btn btn-primary" data-action="create-from-search">
                        + Add "${escapedTerm}"
                    </button>
                </div>
            `;
        }

        return `
            <div class="empty-state-container" aria-live="polite">
                <div class="empty-state-icon">
                    ${LOOKUP_ICONS.empty}
                </div>
                <p class="empty-state-text">Enter a keyword to start searching.</p>
            </div>
        `;
    },

    createItemElement: (item, searchTerm) => {
        const li = document.createElement('li');
        li.className = 'result-item';
        li.dataset.id = item.id;

        const createDataRow = (label, value, highlightTerm) => {
            if (!value) return '';
            const highlightedValue = highlightTerm ? UIPatterns.highlightSearchTerm(value, highlightTerm) : SafeUI.escapeHTML(value);
            return `
                <div class="item-row">
                    <strong>${label}:</strong>
                    <div class="item-value">
                        <span>${highlightedValue}</span>
                        <button class="btn-copy btn-icon" title="Copy ${label}" aria-label="Copy ${label}" data-copy="${SafeUI.escapeHTML(value)}">
                            ${SafeUI.SVGIcons.copy}
                        </button>
                    </div>
                </div>
            `;
        };

        const createNotesRow = (notes) => {
            if (!notes) return '';
            return `
                <div class="item-row-notes">
                    <strong>Notes:</strong>
                    <span class="item-notes-text">${SafeUI.escapeHTML(notes)}</span>
                </div>
            `;
        };

        li.innerHTML = `
            <div class="item-header">
                <span class="item-keyword">${UIPatterns.highlightSearchTerm(item.keyword, searchTerm)}</span>
                <div class="item-actions">
                    <button class="btn-edit btn-icon" title="Edit" aria-label="Edit Entry">${SafeUI.SVGIcons.pencil}</button>
                    <button class="btn-delete btn-icon" title="Delete" aria-label="Delete Entry">${SafeUI.SVGIcons.trash}</button>
                </div>
            </div>
            <div class="item-content">
                ${createDataRow('Group', item.assignmentGroup, searchTerm)}
                ${createDataRow('Path', item.phoneLogPath, searchTerm)}
                ${createNotesRow(item.notes)}
            </div>
        `;
        return li;
    }
};
