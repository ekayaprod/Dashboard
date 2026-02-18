import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('js/apps/passwords.js - PasswordLogic', () => {
  beforeAll(() => {
    // 1. Load app-core.js to get SafeUI
    const coreScriptPath = path.resolve(__dirname, '../app-core.js')
    const coreScriptContent = fs.readFileSync(coreScriptPath, 'utf8')
    new Function(coreScriptContent)()

    // 2. Mock AppLifecycle to prevent initializePage from running or causing errors
    window.AppLifecycle = {
      onBootstrap: vi.fn(),
      initPage: vi.fn(),
      showStartupError: vi.fn(),
      isReady: () => true
    }

    // 3. Load passwords.js and expose PasswordLogic
    const passwordScriptPath = path.resolve(__dirname, '../apps/passwords.js')
    let passwordScriptContent = fs.readFileSync(passwordScriptPath, 'utf8')

    // Append code to expose PasswordLogic to window
    passwordScriptContent += '; window.PasswordLogic = PasswordLogic;'

    new Function(passwordScriptContent)()
  })

  describe('getCurrentSeason', () => {
    // Helper to mock date
    const mockDate = (isoDate) => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(isoDate))
    }

    afterAll(() => {
      vi.useRealTimers()
    })

    it('should identify Winter (Jan)', () => {
      mockDate('2023-01-15')
      expect(window.PasswordLogic.getCurrentSeason()).toBe('winter')
    })

    it('should identify Spring (Apr)', () => {
      mockDate('2023-04-15')
      expect(window.PasswordLogic.getCurrentSeason()).toBe('spring')
    })

    it('should identify Summer (Jul)', () => {
      mockDate('2023-07-15')
      expect(window.PasswordLogic.getCurrentSeason()).toBe('summer')
    })

    it('should identify Autumn (Oct)', () => {
      mockDate('2023-10-15')
      expect(window.PasswordLogic.getCurrentSeason()).toBe('autumn')
    })

    // Test Boundary/Overlap (Logic has offsets)
    // Spring starts Mar 20, but startOffset is 12 days -> Mar 8
    it('should identify Spring early due to offset (Mar 10)', () => {
        mockDate('2023-03-10')
        expect(window.PasswordLogic.getCurrentSeason()).toBe('spring')
    })
  })

  describe('computeAvailableStructures', () => {
    const mockConfig = {
        "2": [
            { categories: ["A", "B"], label: "Structure 1" },
            { categories: ["A", "C"], label: "Structure 2" }
        ],
        "3": [
            { categories: ["A", "B", "C"], label: "Structure 3" }
        ]
    }

    it('should filter structures based on available categories', () => {
        const activeWordBank = {
            "A": ["word"],
            "B": ["word"]
            // "C" is missing
        }

        const result = window.PasswordLogic.computeAvailableStructures(mockConfig, activeWordBank)

        // Structure 1 (A, B) should be present
        expect(result["2"]).toHaveLength(1)
        expect(result["2"][0].label).toBe("Structure 1")

        // Structure 2 (A, C) should be filtered out
        // Structure 3 (A, B, C) should be filtered out
        expect(result["3"]).toHaveLength(0)
    })

    it('should return all structures if all categories exist', () => {
        const activeWordBank = {
            "A": ["word"], "B": ["word"], "C": ["word"]
        }
        const result = window.PasswordLogic.computeAvailableStructures(mockConfig, activeWordBank)
        expect(result["2"]).toHaveLength(2)
        expect(result["3"]).toHaveLength(1)
    })
  })

  describe('generatePassphrase', () => {
    const mockWordBank = {
        "Adjective": ["Happy", "Sad"],
        "Noun": ["Cat", "Dog"],
        "Verb": ["Runs", "Jumps"]
    }

    const mockStructures = {
        "2": [{ categories: ["Adjective", "Noun"], label: "Adj+Noun" }],
        "3": [{ categories: ["Adjective", "Noun", "Verb"], label: "Adj+Noun+Verb" }]
    }

    const mockSymbolRules = {
        "beforeNum": ["#"],
        "afterNum": ["!"],
        "junction": ["-"],
        "end": ["?"]
    }

    const context = {
        availableStructures: mockStructures,
        activeWordBank: mockWordBank,
        symbolRules: mockSymbolRules
    }

    it('should generate a basic 2-word passphrase', () => {
        const config = {
            passNumWords: 2,
            passNumDigits: 2,
            passNumSymbols: 0,
            passSeparator: '-',
            minLength: 0,
            maxLength: 50,
            passNumPlacement: 'end',
            passSymPlacement: 'any'
        }

        const result = window.PasswordLogic.generatePassphrase(config, context)
        // Format: word-wordNN (separator is -)
        // Words are capitalized by default in generatePassphrase logic?
        // Logic: if separator != '', words are lowercased.
        // "happy-cat" + digits

        expect(result).toMatch(/^[a-z]+-[a-z]+\d{2}$/)
        expect(result.length).toBeGreaterThan(5)
    })

    it('should handle separator removal (CamelCase)', () => {
        const config = {
            passNumWords: 2,
            passNumDigits: 0,
            passNumSymbols: 0,
            passSeparator: '', // Empty separator
            minLength: 0,
            maxLength: 50
        }

        const result = window.PasswordLogic.generatePassphrase(config, context)
        // Should be Capitalized: HappyCat
        expect(result).toMatch(/^[A-Z][a-z]+[A-Z][a-z]+$/)
    })

    it('should enforce minLength with padding', () => {
         const config = {
            passNumWords: 1, // "Happy" (5)
            passNumDigits: 0,
            passNumSymbols: 0,
            passSeparator: '',
            minLength: 20, // High min length
            maxLength: 30,
            padToMin: true,
            passNumPlacement: 'end' // Enforce placement for deterministic test
        }

        // 1 word structure isn't in mockStructures, need to add it or it will fail
        // Default logic falls back? No, returns error if no structure.
        // Let's add "1" to context or use 2

        // Wait, context is passed by reference? I should create a local context or update mockStructures
        const localContext = {
            ...context,
            availableStructures: {
                ...mockStructures,
                "1": [{ categories: ["Noun"], label: "Noun" }]
            }
        }

        const result = window.PasswordLogic.generatePassphrase(config, localContext)
        expect(result.length).toBeGreaterThanOrEqual(20)
        expect(result).toMatch(/^[A-Z][a-z]+\d+$/) // Word + many digits
    })

    it('should return error if constraints are impossible', () => {
        const config = {
            passNumWords: 2,
            passNumDigits: 0,
            passNumSymbols: 0,
            passSeparator: '',
            minLength: 50,
            maxLength: 5, // Impossible
            padToMin: true
        }

        const result = window.PasswordLogic.generatePassphrase(config, context)
        // Logic checks estimate first: "Settings exceed Max Length" or returns early
        // Or if it tries and fails: "Retry limit hit"
        // Here minLength > maxLength check comes first
        expect(result).toBe("[Min length > Max length]")
    })

    it('should handle symbols correctly', () => {
        const config = {
            passNumWords: 2,
            passNumDigits: 2,
            passNumSymbols: 2,
            passSeparator: '-',
            minLength: 0,
            maxLength: 50,
            passNumPlacement: 'end',
            passSymPlacement: 'aroundNum' // Symbols around number
        }

        const result = window.PasswordLogic.generatePassphrase(config, context)
        // word-word + #NN! (beforeNum and afterNum symbols)
        // Symbols are # and !
        expect(result).toMatch(/^[a-z]+-[a-z]+[#\d!]+$/)
    })

    it('should return error when no structure is found', () => {
        const config = {
            passNumWords: 5, // No structure for 5
            passNumDigits: 0,
            passNumSymbols: 0,
            passSeparator: '',
            minLength: 0,
            maxLength: 50
        }
        const result = window.PasswordLogic.generatePassphrase(config, context)
        expect(result).toContain("No valid word structure found")
    })
  })
})
