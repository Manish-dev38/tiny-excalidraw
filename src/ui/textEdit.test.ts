import { describe, expect, it } from 'vitest'
import { textEditOp } from './textEdit'
import type { TextElement } from '../core/types'

const text = (value: string): TextElement => ({
  id: 't1',
  type: 'text',
  x: 0,
  y: 0,
  text: value,
  fontSize: 24,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

describe('textEditOp', () => {
  it('returns an update when the text changes', () => {
    expect(textEditOp(text('hello'), 'goodbye')).toEqual({
      type: 'update',
      id: 't1',
      prev: { text: 'hello' },
      next: { text: 'goodbye' },
    })
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
  it('trims the committed text', () => {
    const op = textEditOp(text('hello'), '  padded  ')
    expect(op).toMatchObject({ next: { text: 'padded' } })
  })
})
