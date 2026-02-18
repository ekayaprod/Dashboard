import { describe, it, expect, beforeAll, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('js/apps/lookup.js - LookupHelpers', () => {
  beforeAll(() => {
    // 1. Load app-core.js to get SafeUI and other globals
    const coreScriptPath = path.resolve(__dirname, '../app-core.js')
    const coreScriptContent = fs.readFileSync(coreScriptPath, 'utf8')
    new Function(coreScriptContent)()

    // 2. Mock AppLifecycle to prevent initializePage from running
    window.AppLifecycle = {
      onBootstrap: vi.fn(),
      initPage: vi.fn(),
      isReady: () => true
    }

    // 3. Load lookup.js and expose LookupHelpers
    const lookupScriptPath = path.resolve(__dirname, '../apps/lookup.js')
    let lookupScriptContent = fs.readFileSync(lookupScriptPath, 'utf8')

    // Append code to expose the local const LookupHelpers to window
    lookupScriptContent += '; window.LookupHelpers = LookupHelpers;'

    new Function(lookupScriptContent)()
  })

  describe('createEntry', () => {
    it('should create an entry with default values', () => {
      const entry = window.LookupHelpers.createEntry()
      expect(entry).toHaveProperty('id')
      expect(entry.keyword).toBe('')
      expect(entry.assignmentGroup).toBe('')
      expect(entry.notes).toBe('')
      expect(entry.phoneLogPath).toBe('')
    })

    it('should merge partial input with defaults', () => {
      const partial = {
        keyword: ' test keyword ',
        assignmentGroup: 'Group A'
      }
      const entry = window.LookupHelpers.createEntry(partial)
      expect(entry.keyword).toBe('test keyword') // Should be trimmed
      expect(entry.assignmentGroup).toBe('Group A')
      expect(entry.notes).toBe('')
    })

    it('should preserve provided ID', () => {
      const id = 'custom-id-123'
      const entry = window.LookupHelpers.createEntry({ id })
      expect(entry.id).toBe(id)
    })
  })

  describe('validateEntry', () => {
    it('should return valid=false if keyword is missing', () => {
      const entry = window.LookupHelpers.createEntry({ keyword: '' })
      const result = window.LookupHelpers.validateEntry(entry)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Keyword is required')
    })

    it('should return valid=true for a complete entry', () => {
        const entry = window.LookupHelpers.createEntry({ keyword: 'valid' })
        const result = window.LookupHelpers.validateEntry(entry)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
    })
  })

  describe('keywordUtils.parse', () => {
    it('should parse comma-separated strings into arrays', () => {
      const input = 'key1, key2, key3'
      const result = window.LookupHelpers.keywordUtils.parse(input)
      expect(result).toEqual(['key1', 'key2', 'key3'])
    })

    it('should handle extra whitespace and empty parts', () => {
        const input = ' key1 , , key2 '
        const result = window.LookupHelpers.keywordUtils.parse(input)
        expect(result).toEqual(['key1', 'key2'])
    })
  })

  describe('keywordUtils.merge', () => {
    it('should merge two keyword strings with unique values', () => {
      const k1 = 'a, b'
      const k2 = 'c, d'
      const result = window.LookupHelpers.keywordUtils.merge(k1, k2)
      // The implementation uses Map values, order is insertion order
      // a, b, c, d
      expect(result).toBe('a, b, c, d')
    })

    it('should deduplicate case-insensitively by default', () => {
        const k1 = 'Apple, Banana'
        const k2 = 'apple, CHERRY'
        const result = window.LookupHelpers.keywordUtils.merge(k1, k2)
        // Should keep the first occurrence case (Apple) and add new ones (CHERRY)
        expect(result).toBe('Apple, Banana, CHERRY')
    })

    it('should merge case-sensitively when requested', () => {
        const k1 = 'Apple'
        const k2 = 'apple'
        const result = window.LookupHelpers.keywordUtils.merge(k1, k2, true)
        expect(result).toBe('Apple, apple')
    })
  })

  describe('validateSearchUrl', () => {
    it('should validate valid URLs with {query} placeholder', () => {
      const url = 'https://example.com/search?q={query}'
      const result = window.LookupHelpers.validateSearchUrl(url)
      expect(result.valid).toBe(true)
    })

    it('should fail if {query} placeholder is missing', () => {
        const url = 'https://example.com/search'
        const result = window.LookupHelpers.validateSearchUrl(url)
        expect(result.valid).toBe(false)
        expect(result.message).toContain('{query}')
    })

    it('should fail if URL protocol is invalid', () => {
        const url = 'ftp://example.com/{query}'
        const result = window.LookupHelpers.validateSearchUrl(url)
        expect(result.valid).toBe(false)
        expect(result.message).toContain('http:// or https://')
    })

    it('should fail if URL is empty', () => {
        const result = window.LookupHelpers.validateSearchUrl('')
        expect(result.valid).toBe(false)
        expect(result.message).toContain('empty')
    })
  })
})
