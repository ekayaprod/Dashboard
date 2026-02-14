import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('app-ui.js - ListRenderer', () => {
    beforeEach(() => {
        // Mock globals if needed, or load the file
        const corePath = path.resolve(__dirname, '../app-core.js')
        const uiPath = path.resolve(__dirname, '../app-ui.js')

        // Simple loading without `fs` overhead if we just want to test logic,
        // but since it's an IIFE assignment to window, we need to load it.
        // We'll just load it once.
        if (!window.ListRenderer) {
            const coreContent = fs.readFileSync(corePath, 'utf8')
            new Function(coreContent)()
            const uiContent = fs.readFileSync(uiPath, 'utf8')
            new Function(uiContent)()
        }

        document.body.innerHTML = '<ul id="list-container"></ul>';
    })

    it('should pass index to createItemElement', () => {
        const container = document.getElementById('list-container');
        const items = ['a', 'b', 'c'];
        const createItemElement = vi.fn((item, index) => {
            const li = document.createElement('li');
            li.textContent = `${item}-${index}`;
            return li;
        });

        window.ListRenderer.renderList({
            container,
            items,
            createItemElement
        });

        expect(createItemElement).toHaveBeenCalledTimes(3);
        expect(createItemElement).toHaveBeenNthCalledWith(1, 'a', 0);
        expect(createItemElement).toHaveBeenNthCalledWith(2, 'b', 1);
        expect(createItemElement).toHaveBeenNthCalledWith(3, 'c', 2);

        expect(container.children.length).toBe(3);
        expect(container.children[0].textContent).toBe('a-0');
        expect(container.children[2].textContent).toBe('c-2');
    });

    it('should clear container if append is false', () => {
        const container = document.getElementById('list-container');
        container.innerHTML = '<li>Existing</li>';

        window.ListRenderer.renderList({
            container,
            items: ['new'],
            createItemElement: (item) => document.createElement('li'),
            append: false
        });

        expect(container.children.length).toBe(1);
    });

    it('should append to container if append is true', () => {
        const container = document.getElementById('list-container');
        container.innerHTML = '<li>Existing</li>';

        window.ListRenderer.renderList({
            container,
            items: ['new'],
            createItemElement: (item) => document.createElement('li'),
            append: true
        });

        expect(container.children.length).toBe(2);
    });
});
