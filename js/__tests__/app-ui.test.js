import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('app-ui.js - SearchHelper', () => {
  beforeAll(() => {
    // 1. Load Core (Dependency)
    const corePath = path.resolve(__dirname, '../app-core.js')
    const coreContent = fs.readFileSync(corePath, 'utf8')
    new Function(coreContent)()

    // 2. Load UI (Target)
    const uiPath = path.resolve(__dirname, '../app-ui.js')
    const uiContent = fs.readFileSync(uiPath, 'utf8')
    new Function(uiContent)()
  })

  it('should expose SearchHelper globally', () => {
    expect(window.SearchHelper).toBeDefined()
  })

  it('createIndex should add non-enumerable _searchContent property', () => {
    const items = [
      { id: 1, name: 'Apple', desc: 'Red fruit' },
      { id: 2, name: 'Banana', desc: 'Yellow fruit' }
    ]

    window.SearchHelper.createIndex(items, ['name', 'desc'])

    // Check property existence
    expect(items[0]._searchContent).toBeDefined()
    expect(items[0]._searchContent).toContain('apple')
    expect(items[0]._searchContent).toContain('red fruit')

    // Check non-enumerability (should not appear in keys or JSON)
    expect(Object.keys(items[0])).not.toContain('_searchContent')
    const json = JSON.stringify(items[0])
    expect(json).not.toContain('_searchContent')
  })

  it('searchIndex should find items using the index', () => {
    const items = [
      { id: 1, name: 'Apple', desc: 'Red fruit' },
      { id: 2, name: 'Banana', desc: 'Yellow fruit' },
      { id: 3, name: 'Cherry', desc: 'Red fruit' }
    ]

    window.SearchHelper.createIndex(items, ['name', 'desc'])

    const results = window.SearchHelper.searchIndex(items, 'red')
    expect(results).toHaveLength(2)
    expect(results.map(i => i.name)).toEqual(['Apple', 'Cherry'])

    const results2 = window.SearchHelper.searchIndex(items, 'banana')
    expect(results2).toHaveLength(1)
    expect(results2[0].name).toBe('Banana')
  })

  it('searchIndex should return empty array for no matches', () => {
    const items = [{ id: 1, name: 'Apple' }]
    window.SearchHelper.createIndex(items, ['name'])

    const results = window.SearchHelper.searchIndex(items, 'orange')
    expect(results).toHaveLength(0)
  })

  it('searchIndex should be case-insensitive', () => {
    const items = [{ id: 1, name: 'Apple' }]
    window.SearchHelper.createIndex(items, ['name'])

    const results = window.SearchHelper.searchIndex(items, 'APPLE')
    expect(results).toHaveLength(1)
  })
})
