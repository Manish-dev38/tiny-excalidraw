import { describe, expect, it } from 'vitest'
import {
  makeArrowElement,
  makeEllipseElement,
  makePenElement,
  makeRectElement,
  makeTextElement,
} from './factories'

describe('makeRectElement', () => {
  it('fits two drag points into a normalized rect', () => {
    const el = makeRectElement('r', { x: 10, y: 20 }, { x: 30, y: 5 })
    expect(el).toMatchObject({ id: 'r', type: 'rectangle', x: 10, y: 5, width: 20, height: 15 })
  })
  it('normalizes a reverse drag', () => {
    const el = makeRectElement('r', { x: 30, y: 30 }, { x: 10, y: 10 })
    expect(el).toMatchObject({ x: 10, y: 10, width: 20, height: 20 })
  })
})

describe('makeEllipseElement', () => {
  it('produces an ellipse of the same normalized size', () => {
    const el = makeEllipseElement('e', { x: 0, y: 0 }, { x: 10, y: 20 })
    expect(el).toMatchObject({ type: 'ellipse', x: 0, y: 0, width: 10, height: 20 })
  })
})

describe('makePenElement', () => {
  it('stores the path and anchors at its top-left', () => {
    const path = [
      { x: 2, y: 3 },
      { x: -5, y: 8 },
      { x: 4, y: -2 },
    ]
    const el = makePenElement('p', path)
    expect(el.points).toEqual(path)
    expect(el).toMatchObject({ id: 'p', type: 'pen', x: -5, y: -2 })
  })
})

describe('makeArrowElement', () => {
  it('stores start and end points', () => {
    const el = makeArrowElement('a', { x: 0, y: 0 }, { x: 50, y: 25 })
    expect(el.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
    ])
  })
})

describe('makeTextElement', () => {
  it('captures content, position, and font size', () => {
    const el = makeTextElement('t', { x: 5, y: 6 }, 'hello', 28)
    expect(el).toMatchObject({
      id: 't',
      type: 'text',
      x: 5,
      y: 6,
      text: 'hello',
      fontSize: 28,
    })
  })

  it('inherits the chosen stroke colour so text stays visible on dark boards', () => {
    const el = makeTextElement('t', { x: 0, y: 0 }, 'hello', 24, {
      strokeColor: '#ffffff',
      background: 'transparent',
      strokeWidth: 2,
    })
    expect(el.strokeColor).toBe('#ffffff')
    expect(el.strokeWidth).toBe(2)
    expect(el.background).toBe('transparent')
  })
})
