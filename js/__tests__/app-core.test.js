import { describe, it, expect, beforeAll } from 'vitest'
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

    expect(utils.formatMinutesToHM(90)).toBe('1:30')
    expect(utils.formatMinutesToHM(90.6)).toBe('1:31') // Rounding

    expect(utils.formatMinutesToHHMM_Signed(90)).toBe('01:30')
    expect(utils.formatMinutesToHHMM_Signed(-90)).toBe('-01:30')

    expect(utils.formatMinutesToHHMMShort(90)).toBe('1h 30m')
    expect(utils.formatMinutesToHHMMShort(60)).toBe('1h')
    expect(utils.formatMinutesToHHMMShort(30)).toBe('30m')
    expect(utils.formatMinutesToHHMMShort(0)).toBe('0m')
    expect(utils.formatMinutesToHHMMShort(-1)).toBe('0m')
    expect(utils.formatMinutesToHHMMShort(NaN)).toBe('0m')
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
})
