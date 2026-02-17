import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('app-data.js Tests', () => {
  beforeAll(() => {
    // 1. Load Core (Dependency)
    const corePath = path.resolve(__dirname, '../app-core.js')
    const coreContent = fs.readFileSync(corePath, 'utf8')
    new Function(coreContent)()

    // 2. Load Data (Target)
    const dataPath = path.resolve(__dirname, '../app-data.js')
    const dataContent = fs.readFileSync(dataPath, 'utf8')
    new Function(dataContent)()

    // Mock SafeUI.readTextFile if not already mocked
    // app-core.js defines SafeUI using a closure, so we can't easily spy on internal methods
    // but we can replace the method on the global object if exposed, or mock the underlying UIUtils

    // SafeUI is exposed on window.SafeUI
    // We can spy on window.SafeUI.readTextFile
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('DataConverter', () => {
    describe('toCSV', () => {
      it('should convert simple object array to CSV', () => {
        const data = [
          { id: 1, name: 'Alice', age: 30 },
          { id: 2, name: 'Bob', age: 25 }
        ]
        const headers = ['id', 'name', 'age']
        const expected = 'id,name,age\n1,Alice,30\n2,Bob,25'

        expect(window.DataConverter.toCSV(data, headers)).toBe(expected)
      })

      it('should handle special characters (quotes, commas, newlines)', () => {
        const data = [
          { id: 1, note: 'Hello, World' },
          { id: 2, note: 'He said "Hi"' },
          { id: 3, note: 'Line 1\nLine 2' }
        ]
        const headers = ['id', 'note']
        // expected:
        // id,note
        // 1,"Hello, World"
        // 2,"He said ""Hi"""
        // 3,"Line 1
        // Line 2"

        const csv = window.DataConverter.toCSV(data, headers)
        const lines = csv.split('\n')
        expect(lines[0]).toBe('id,note')
        expect(lines[1]).toBe('1,"Hello, World"')
        expect(lines[2]).toBe('2,"He said ""Hi"""')
        // Newline handling might vary slightly depending on implementation details of split,
        // but let's check the raw string contains the quoted newline
        expect(csv).toContain('"Line 1\nLine 2"')
      })

      it('should handle null and undefined values', () => {
        const data = [
          { id: 1, value: null },
          { id: 2, value: undefined },
          { id: 3, value: 'test' }
        ]
        const headers = ['id', 'value']
        const expected = 'id,value\n1,\n2,\n3,test'

        expect(window.DataConverter.toCSV(data, headers)).toBe(expected)
      })

      it('should throw error for invalid input', () => {
          expect(() => window.DataConverter.toCSV(null, [])).toThrow()
          expect(() => window.DataConverter.toCSV([], [])).toThrow() // Empty headers
      })
    })

    describe('fromCSV', () => {
      it('should parse simple CSV correctly', async () => {
        const csvContent = 'id,name,age\n1,Alice,30\n2,Bob,25'
        const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

        // Mock SafeUI.readTextFile
        vi.spyOn(window.SafeUI, 'readTextFile').mockResolvedValue(csvContent)

        const result = await window.DataConverter.fromCSV(file, ['id', 'name'])

        expect(result.errors).toHaveLength(0)
        expect(result.data).toHaveLength(2)
        expect(result.data[0]).toEqual({ id: '1', name: 'Alice' }) // CSV parsing usually returns strings
        expect(result.data[1]).toEqual({ id: '2', name: 'Bob' })
      })

      it('should handle quoted values including commas and newlines', async () => {
        const csvContent = 'id,note\n1,"Hello, World"\n2,"Multi\nLine"'
        const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

        vi.spyOn(window.SafeUI, 'readTextFile').mockResolvedValue(csvContent)

        const result = await window.DataConverter.fromCSV(file, ['id', 'note'])

        expect(result.errors).toHaveLength(0)
        expect(result.data).toHaveLength(2)
        expect(result.data[0].note).toBe('Hello, World')
        expect(result.data[1].note).toBe('Multi\nLine')
      })

      it('should report missing headers', async () => {
        const csvContent = 'id,age\n1,30'
        const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

        vi.spyOn(window.SafeUI, 'readTextFile').mockResolvedValue(csvContent)

        await expect(window.DataConverter.fromCSV(file, ['id', 'name']))
          .rejects.toThrow(/Missing required CSV header: "name"/)
      })

      it('should handle empty file', async () => {
         const csvContent = ''
         const file = new File([csvContent], 'empty.csv', { type: 'text/csv' })

         vi.spyOn(window.SafeUI, 'readTextFile').mockResolvedValue(csvContent)

         const result = await window.DataConverter.fromCSV(file, ['id'])
         // Implementation returns empty data and errors for empty file (or throws if headers missing?)
         // Looking at code: if lines.length === 0 return { data: [], errors: [] }
         expect(result.data).toEqual([])
         expect(result.errors).toEqual([])
      })
    })
  })

  describe('DataValidator', () => {
    describe('hasDuplicate', () => {
      const items = [
        { id: 1, name: 'Apple' },
        { id: 2, name: 'Banana' }
      ]

      it('should detect duplicates case-insensitively', () => {
        expect(window.DataValidator.hasDuplicate(items, 'name', 'apple')).toBe(true)
        expect(window.DataValidator.hasDuplicate(items, 'name', 'APPLE')).toBe(true)
        expect(window.DataValidator.hasDuplicate(items, 'name', '  Apple  ')).toBe(true)
      })

      it('should return false for unique values', () => {
        expect(window.DataValidator.hasDuplicate(items, 'name', 'Cherry')).toBe(false)
      })

      it('should exclude specified ID (for self-match during edit)', () => {
        expect(window.DataValidator.hasDuplicate(items, 'name', 'Apple', 1)).toBe(false)
        expect(window.DataValidator.hasDuplicate(items, 'name', 'Apple', 2)).toBe(true) // 2 is not 1, so it sees Apple at id:1
      })
    })

    describe('validateFields', () => {
        it('should validate required fields', () => {
            const rules = {
                name: { required: true }
            }

            expect(window.DataValidator.validateFields({ name: 'test' }, rules).valid).toBe(true)
            expect(window.DataValidator.validateFields({ name: '' }, rules).valid).toBe(false)
        })

        it('should validate maxLength', () => {
            const rules = {
                code: { maxLength: 3 }
            }

            expect(window.DataValidator.validateFields({ code: 'ABC' }, rules).valid).toBe(true)
            expect(window.DataValidator.validateFields({ code: 'ABCD' }, rules).valid).toBe(false)
        })

        it('should validate minLength', () => {
             const rules = {
                password: { minLength: 5 }
            }
             expect(window.DataValidator.validateFields({ password: '12345' }, rules).valid).toBe(true)
             expect(window.DataValidator.validateFields({ password: '123' }, rules).valid).toBe(false)
        })

        it('should validate patterns', () => {
            const rules = {
                digits: { pattern: /^\d+$/ }
            }
            expect(window.DataValidator.validateFields({ digits: '123' }, rules).valid).toBe(true)
            expect(window.DataValidator.validateFields({ digits: '123a' }, rules).valid).toBe(false)
        })

        it('should run custom validation', () => {
            const rules = {
                even: {
                    custom: val => parseInt(val) % 2 === 0,
                    customMessage: 'Must be even'
                }
            }
            expect(window.DataValidator.validateFields({ even: '4' }, rules).valid).toBe(true)

            const result = window.DataValidator.validateFields({ even: '3' }, rules)
            expect(result.valid).toBe(false)
            expect(result.errors).toContain('Must be even')
        })
    })
  })
})
