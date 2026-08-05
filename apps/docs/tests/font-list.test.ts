import { describe, expect, it } from 'vitest'
import { defaultEastAsiaFontFor, fontFamiliesFor } from '../src/renderer/font-list'

describe('fontFamiliesFor', () => {
  it('leads with Times New Roman for vi (official-document font)', () => {
    expect(fontFamiliesFor('vi')[0]).toBe('Times New Roman')
  })

  // Garamond and Impact lack the Vietnamese stacked tone marks on common
  // Windows/macOS builds — offering them to a Vietnamese user renders tofu
  it('omits fonts without Vietnamese diacritic coverage for vi', () => {
    const families = fontFamiliesFor('vi')
    expect(families).not.toContain('Garamond')
    expect(families).not.toContain('Impact')
    // still offered everywhere else
    expect(fontFamiliesFor('en')).toContain('Garamond')
  })
})

describe('defaultEastAsiaFontFor', () => {
  it('leaves the East Asian slot empty for vi, like en', () => {
    expect(defaultEastAsiaFontFor('vi')).toBeUndefined()
  })
})
