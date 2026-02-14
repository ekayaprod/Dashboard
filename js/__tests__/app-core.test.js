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
})
