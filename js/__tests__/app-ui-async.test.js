import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('app-ui.js - Async Search', () => {
  beforeAll(() => {
    // 1. Load Core
    const corePath = path.resolve(__dirname, '../app-core.js')
    const coreContent = fs.readFileSync(corePath, 'utf8')
    new Function(coreContent)()

    // 2. Load UI
    const uiPath = path.resolve(__dirname, '../app-ui.js')
    const uiContent = fs.readFileSync(uiPath, 'utf8')
    new Function(uiContent)()
  })

  it('searchIndexAsync should find items asynchronously', async () => {
    const items = [
      { id: 1, name: 'Apple' },
      { id: 2, name: 'Banana' },
      { id: 3, name: 'Cherry' }
    ]

    window.SearchHelper.createIndex(items, ['name'])

    const results = await window.SearchHelper.searchIndexAsync(items, 'apple')
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('Apple')
  })

  it('searchIndexAsync should handle chunking correctly', async () => {
    // Create enough items to force at least one chunk if chunk size is small
    const items = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Item ${i}`
    }));

    window.SearchHelper.createIndex(items, ['name'])

    // Use small chunk size to force multiple chunks
    const results = await window.SearchHelper.searchIndexAsync(items, 'item', 10);
    expect(results).toHaveLength(100);
  });

  it('searchIndexAsync should return all items if term is empty', async () => {
      const items = [{id: 1, name: 'A'}];
      const results = await window.SearchHelper.searchIndexAsync(items, '');
      expect(results).toBe(items);
  });
})
