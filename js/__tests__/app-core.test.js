import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('app-core.js', () => {
  beforeAll(() => {
    // Load the script content
    const scriptPath = path.resolve(__dirname, '../app-core.js')
    const scriptContent = fs.readFileSync(scriptPath, 'utf8')

    // Execute the script in the global context
    // Using new Function creates a function body.
    // Variables declared with const/let are block-scoped to the function body,
    // but assignments to window will persist globally.
    const fn = new Function(scriptContent)
    fn()
  })

  it('should expose UIUtils globally', () => {
    expect(window.UIUtils).toBeDefined()
  })

  it('should verify escapeHTML function', () => {
    const input = '<script>alert("xss")</script>'
    const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    expect(window.UIUtils.escapeHTML(input)).toBe(expected)
  })

  it('should verify DateUtils.parseTimeToMinutes function', () => {
    // Basic format H:MM
    expect(window.DateUtils.parseTimeToMinutes('1:30')).toBe(90)
    // Minutes only
    expect(window.DateUtils.parseTimeToMinutes('45')).toBe(45)
    // Decimal hours
    expect(window.DateUtils.parseTimeToMinutes('1.5')).toBe(90)
    // H:MM:SS
    expect(window.DateUtils.parseTimeToMinutes('1:30:30')).toBe(90.5)
  })

  it('should verify DateUtils formatting functions', () => {
    const utils = window.DateUtils
    expect(utils.formatMinutesToHHMM(90)).toBe('01:30')
    expect(utils.formatMinutesToHHMM(-90)).toBe('00:00') // Default behavior

    expect(utils.formatMinutesToHHMM_Signed(90)).toBe('01:30')
    expect(utils.formatMinutesToHHMM_Signed(-90)).toBe('-01:30')
  })

  describe('CoreValidators', () => {
    // Access validators via SafeUI as it's the public API wrapper
    const validators = () => window.SafeUI.validators

    it('should validate URLs correctly', () => {
      // Valid URLs
      expect(validators().url('https://google.com')).toBe(true)
      expect(validators().url('http://localhost:3000')).toBe(true)
      expect(validators().url('google.com')).toBe(true) // Should auto-prepend http
      expect(validators().url('sub.domain.com')).toBe(true)

      // Invalid URLs
      expect(validators().url('not a url')).toBe(false)
      expect(validators().url(null)).toBe(false)
      expect(validators().url('')).toBe(false)
    })

    it('should validate notEmpty correctly', () => {
      expect(validators().notEmpty('hello')).toBe(true)
      expect(validators().notEmpty('  hello  ')).toBe(true) // Trims
      expect(validators().notEmpty(0)).toBe(true)

      expect(validators().notEmpty('')).toBe(false)
      expect(validators().notEmpty('   ')).toBe(false) // Trims to empty
      expect(validators().notEmpty(null)).toBe(false)
      expect(validators().notEmpty(undefined)).toBe(false)
    })

    it('should validate maxLength correctly', () => {
      expect(validators().maxLength('abc', 3)).toBe(true)
      expect(validators().maxLength('ab', 3)).toBe(true)

      expect(validators().maxLength('abcd', 3)).toBe(false)
      expect(validators().maxLength(null, 3)).toBe(false)
    })
  })

  describe('SVGIcons', () => {
    it('should have aria-hidden="true" on all icons', () => {
      const icons = window.SafeUI.SVGIcons
      Object.values(icons).forEach((icon) => {
        expect(icon).toContain('aria-hidden="true"')
      })
    })
  })

  describe('SafeUI.fetchJSON', () => {
    const fetchJSON = (url, opts, validator) => window.SafeUI.fetchJSON(url, opts, validator)

    // Mock fetch
    const originalFetch = global.fetch
    let mockFetch

    beforeEach(() => {
        mockFetch = vi.fn()
        global.fetch = mockFetch
        // reduce initial delay for tests to speed up
        // Note: We cannot easily change the internal INITIAL_DELAY variable since it's inside the closure.
        // We will mock setTimeout to fast-forward time?
        // Or just rely on the fact that we might be mocking Promise?
        // No, fetchJSON uses `await new Promise(resolve => setTimeout(resolve, delay));`
        // We should use fake timers.
        vi.useFakeTimers()
    })

    afterEach(() => {
        global.fetch = originalFetch
        vi.useRealTimers()
    })

    it('should return parsed JSON on success', async () => {
        const mockData = { success: true }
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockData,
            status: 200
        })

        const result = await fetchJSON('http://test.com')
        expect(result).toEqual(mockData)
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should retry on 500 error and succeed', async () => {
        const mockData = { success: true }
        mockFetch
            .mockResolvedValueOnce({ status: 500, ok: false })
            .mockResolvedValueOnce({ status: 500, ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => mockData, status: 200 })

        // We need to advance timers for retries
        const promise = fetchJSON('http://test.com')

        // Advance for first retry
        await vi.advanceTimersByTimeAsync(1000)
        // Advance for second retry
        await vi.advanceTimersByTimeAsync(2000)

        const result = await promise
        expect(result).toEqual(mockData)
        expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('should retry on 429 error', async () => {
        const mockData = { success: true }
        mockFetch
            .mockResolvedValueOnce({ status: 429, ok: false })
            .mockResolvedValueOnce({ ok: true, json: async () => mockData, status: 200 })

        const promise = fetchJSON('http://test.com')

        // Advance for first retry
        await vi.advanceTimersByTimeAsync(1000)

        const result = await promise
        expect(result).toEqual(mockData)
        expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should NOT retry on 404 error', async () => {
        mockFetch.mockResolvedValue({ status: 404, ok: false })

        await expect(fetchJSON('http://test.com')).rejects.toThrow('Request failed with status 404')
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should fail if validation fails', async () => {
        const mockData = { valid: false }
        mockFetch.mockResolvedValue({
            ok: true,
            json: async () => mockData,
            status: 200
        })

        const validator = (d) => d.valid === true

        await expect(fetchJSON('http://test.com', {}, validator)).rejects.toThrow('Response validation failed')
    })

    it('should fail if JSON is invalid', async () => {
         mockFetch.mockResolvedValue({
            ok: true,
            json: async () => { throw new Error('Bad JSON') },
            status: 200
        })

        await expect(fetchJSON('http://test.com')).rejects.toThrow('Invalid JSON response')
        // Should not retry on JSON error
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('createStateManager', () => {
    // We access via SafeUI which exposes createStateManager from UIUtils
    const createStateManager = (key, defaults, version, onCorruption) =>
        window.SafeUI.createStateManager(key, defaults, version, onCorruption)

    const KEY = 'test_key'
    const DEFAULTS = { value: 0 }
    const VERSION = '1.0.0'

    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it('should call onCorruption and log error if onCorruption throws', () => {
        // Arrange: corrupted data in localStorage
        localStorage.setItem(KEY, 'invalid json {')

        // Mock console.error
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Mock onCorruption to throw
        const error = new Error('Callback failed')
        const onCorruption = vi.fn(() => { throw error })

        // Act
        const manager = createStateManager(KEY, DEFAULTS, VERSION, onCorruption)
        const loadedState = manager.load() // Load triggers parsing

        // Assert
        expect(onCorruption).toHaveBeenCalled()
        expect(consoleSpy).toHaveBeenCalledWith('Error in onCorruption callback:', error)

        // Ensure returned state is default despite the error in callback
        expect(loadedState).toEqual({ ...DEFAULTS, version: VERSION })
    })
  })

  describe('UIUtils.getRandomInt', () => {
    it('should handle crypto errors gracefully by falling back to Math.random', () => {
      const consoleSpy = vi.spyOn(console, 'warn')

      // Mock crypto.getRandomValues to throw
      const originalCrypto = window.crypto

      // Ensure crypto exists on window
      if (!window.crypto) {
        Object.defineProperty(window, 'crypto', {
          value: {},
          writable: true
        })
      }

      const throwingCrypto = {
        getRandomValues: vi.fn().mockImplementation(() => {
          throw new Error('Quota exceeded')
        }),
        randomUUID: () => 'uuid'
      }

      // Overwrite window.crypto
      Object.defineProperty(window, 'crypto', {
        value: throwingCrypto,
        writable: true,
        configurable: true
      })

      // Call the function
      const result = window.UIUtils.getRandomInt(100)

      // Assertions
      expect(typeof result).toBe('number')
      expect(result).toBeGreaterThanOrEqual(0)
      expect(result).toBeLessThan(100)

      // Check that it warned
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('UIUtils: crypto.getRandomValues failed'),
        expect.any(Error)
      )

      // Restore window.crypto
      if (originalCrypto) {
        Object.defineProperty(window, 'crypto', {
          value: originalCrypto,
          writable: true,
          configurable: true
        })
      }
    })
  })
})
