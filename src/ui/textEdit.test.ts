import { describe, expect, it } from 'vitest'
import { textEditOp } from './textEdit'
import { textElement } from '../core/testHelpers'
import type { TextElement } from '../core/types'

const text = (value: string, overrides = {}) =>
  textElement('t1', { text: value, originalText: value, fontSize: 24, ...overrides })

/** Narrow an update op's `next` patch to the fields this test cares about. */
function nextOf(op: ReturnType<typeof textEditOp>): Partial<TextElement> {
  if (op?.type !== 'update') throw new Error('expected an update op')
  return op.next as Partial<TextElement>
}

describe('textEditOp', () => {
  it('returns a metric update when the text changes', () => {
    const op = textEditOp(text('hello'), 'goodbye')
    expect(op).toMatchObject({
      type: 'update',
      id: 't1',
      prev: { text: 'hello' },
      next: { originalText: 'goodbye', text: 'goodbye' },
    })
    const next = nextOf(op)
    expect(next.height).toBeCloseTo(30)
    expect(next.autoResize).toBe(true)
  })

  it('returns null when the text is unchanged', () => {
    expect(textEditOp(text('hello'), 'hello')).toBeNull()
    expect(textEditOp(text('hello'), '  hello  ')).toBeNull()
  })

  it('removes the element when the text is emptied', () => {
    expect(textEditOp(text('hello'), '   ')).toEqual({
      type: 'remove',
      element: text('hello'),
    })
  })

  it('trims surrounding whitespace but keeps internal newlines', () => {
    const op = textEditOp(text('hello'), '  first\nsecond  ')
    expect(op).toMatchObject({ next: { originalText: 'first\nsecond' } })
    const next = nextOf(op)
    expect(next.text).toBe('first\nsecond')
    expect(next.height).toBeCloseTo(60)
  })

  it('wraps at the supplied container width', () => {
    const next = nextOf(textEditOp(text('one'), 'one two three four', { maxWidth: 80 }))
    expect(next.text).toContain('\n')
    expect(next.width).toBe(80)
    expect(next.autoResize).toBe(false)
  })

  it('keeps an explicitly sized text wrapping at its old width', () => {
    const existing = textElement('t1', {
      text: 'one two',
      originalText: 'one two',
      width: 70,
      autoResize: false,
    })
    const next = nextOf(textEditOp(existing, 'one two three four five'))
    expect(next.width).toBe(70)
    expect(next.text).toContain('\n')
  })
})
