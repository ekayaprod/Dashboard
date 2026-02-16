import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Modernization Refactor Tests', () => {
  beforeAll(() => {
    // Load the script content
    const scriptPath = path.resolve(__dirname, '../app-core.js')
    const scriptContent = fs.readFileSync(scriptPath, 'utf8')

    // Execute the script in the global context
    const fn = new Function(scriptContent)
    fn()
  })

  it('UIUtils.readTextFile should return a Promise', async () => {
    const file = new File(['hello world'], 'test.txt', { type: 'text/plain' })

    await expect(window.UIUtils.readTextFile(file)).resolves.toBe('hello world')
  })

  it('UIUtils.readJSONFile should return a Promise', async () => {
    const data = { foo: 'bar' }
    const file = new File([JSON.stringify(data)], 'test.json', { type: 'application/json' })

    await expect(window.UIUtils.readJSONFile(file)).resolves.toEqual(data)
  })
})
