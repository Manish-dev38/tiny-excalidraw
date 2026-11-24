import { describe, expect, it } from 'vitest'
import {
  ARROW_LABEL_MAX_WIDTH,
  LABEL_PADDING,
  MIN_TEXT_WIDTH,
  TEXT_LINE_HEIGHT,
  arrowLabelMaxWidth,
  labelMaxWidth,
  measureTextWidth,
  normalizeFontSize,
  textBlock,
  wrapText,
} from './textLayout'

describe('measureTextWidth', () => {
  it('returns zero for empty text and grows with length', () => {
    expect(measureTextWidth('', 20)).toBe(0)
    expect(measureTextWidth('hello', 20)).toBeGreaterThan(0)
    expect(measureTextWidth('hello world', 20)).toBeGreaterThan(
      measureTextWidth('hello', 20),
    )
  })
})

describe('wrapText', () => {
  it('wraps greedily on spaces', () => {
    expect(wrapText('one two three four', 60, 10)).toEqual(['one two', 'three four'])
  })

  it('preserves explicit newlines and blank lines', () => {
    expect(wrapText('one\n\ntwo', 100, 10)).toEqual(['one', '', 'two'])
  })

  it('never splits a word wider than the line', () => {
    expect(wrapText('supercalifragilistic', 10, 10)).toEqual([
      'supercalifragilistic',
    ])
  })
})

describe('textBlock', () => {
  it('auto-sizes to the widest line', () => {
    const block = textBlock('one\nlonger line', 20)
    expect(block.lines).toEqual(['one', 'longer line'])
    expect(block.width).toBeCloseTo(measureTextWidth('longer line', 20))
    expect(block.height).toBeCloseTo(2 * 20 * TEXT_LINE_HEIGHT)
  })

  it('uses the provided width when wrapping', () => {
    const block = textBlock('one two three four', 10, { maxWidth: 70 })
    expect(block.width).toBe(70)
    expect(block.lines).toHaveLength(2)
  })

  it('never returns a wrapped block narrower than the minimum', () => {
    expect(textBlock('a', 10, { maxWidth: 10 }).width).toBe(MIN_TEXT_WIDTH)
  })
})

describe('label widths and font sizes', () => {
  it('reserves padding inside a container', () => {
    expect(labelMaxWidth(200)).toBe(200 - LABEL_PADDING * 2)
    expect(labelMaxWidth(40)).toBe(MIN_TEXT_WIDTH)
  })

  it('caps arrow labels', () => {
    expect(arrowLabelMaxWidth(500)).toBe(ARROW_LABEL_MAX_WIDTH)
    expect(arrowLabelMaxWidth(100)).toBe(100)
  })

  it('snaps to the available font sizes', () => {
    expect(normalizeFontSize(19)).toBe(20)
    expect(normalizeFontSize(30)).toBe(28)
    expect(normalizeFontSize(0)).toBe(20)
  })
})
