import { describe, expect, it } from 'vitest'
import {
  arrowBBox,
  boundArrows,
  boundText,
  containerLabelWidth,
  containerOf,
  deletionSet,
  isContainer,
  layoutLabel,
  reflowLabel,
  withBoundText,
  withoutBoundText,
} from './containers'
import { textElement } from './testHelpers'
import type {
  ArrowElement,
  ArrowBinding,
  ExcalidrawElement,
  RectLikeElement,
  TextElement,
} from './types'

const shape = (id: string, overrides: Partial<RectLikeElement> = {}): RectLikeElement =>
  ({
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    strokeColor: '#000',
    background: 'transparent',
    strokeWidth: 1,
    ...overrides,
  }) as RectLikeElement

const arrow = (
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  overrides: Partial<ArrowElement> = {},
): ArrowElement => ({
  id,
  type: 'arrow',
  x: a.x,
  y: a.y,
  points: [a, b],
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 2,
  ...overrides,
})

const bind = (elementId: string): ArrowBinding => ({
  elementId,
  mode: 'inside',
  fixedPoint: [1, 0.5],
})

const label = (id: string, containerId: string, overrides: Partial<TextElement> = {}) =>
  textElement(id, {
    text: 'Label',
    originalText: 'Label',
    fontSize: 20,
    containerId,
    autoResize: false,
    ...overrides,
  })

describe('isContainer', () => {
  it('accepts box shapes and arrows, not text or pen', () => {
    expect(isContainer(shape('s'))).toBe(true)
    expect(isContainer(shape('e', { type: 'ellipse' }))).toBe(true)
    expect(isContainer(shape('l', { type: 'laptop' }))).toBe(true)
    expect(isContainer(arrow('a', { x: 0, y: 0 }, { x: 10, y: 0 }))).toBe(true)
    expect(isContainer(textElement('t'))).toBe(false)
    expect(
      isContainer({
        id: 'p',
        type: 'pen',
        x: 0,
        y: 0,
        points: [{ x: 0, y: 0 }],
        strokeColor: '#000',
        background: 'transparent',
        strokeWidth: 1,
      }),
    ).toBe(false)
  })
})

describe('lookups', () => {
  it('finds the topmost label pointing at a container', () => {
    const old = label('old', 's')
    const fresh = label('fresh', 's')
    expect(boundText([shape('s'), old, fresh], 's')?.id).toBe('fresh')
    expect(boundText([shape('s')], 's')).toBeNull()
  })

  it('resolves a label back to its container only when still valid', () => {
    const s = shape('s')
    expect(containerOf([s, label('t', 's')], label('t', 's'))?.id).toBe('s')
    expect(containerOf([label('t', 's')], label('t', 's'))).toBeNull()
    const other = textElement('other')
    expect(containerOf([other], textElement('t', { containerId: 'other' }))).toBeNull()
    expect(containerOf([s], textElement('t'))).toBeNull()
  })

  it('lists arrows attached at either end', () => {
    const start = arrow('start', { x: 0, y: 0 }, { x: 10, y: 0 }, { startBinding: bind('s') })
    const end = arrow('end', { x: 0, y: 0 }, { x: 10, y: 0 }, { endBinding: bind('s') })
    const loose = arrow('loose', { x: 0, y: 0 }, { x: 10, y: 0 })
    expect(boundArrows([start, end, loose], 's').map((a) => a.id)).toEqual(['start', 'end'])
  })
})

describe('arrowBBox', () => {
  it('covers a straight route', () => {
    const a = arrow('a', { x: 10, y: 20 }, { x: 110, y: 20 })
    expect(arrowBBox(a)).toEqual({ x: 10, y: 20, width: 100, height: 0 })
  })

  it('covers both runs of an elbow', () => {
    const a = arrow('a', { x: 0, y: 0 }, { x: 100, y: 80 })
    expect(arrowBBox(a)).toEqual({ x: 0, y: 0, width: 100, height: 80 })
  })
})

describe('containerLabelWidth', () => {
  it('reserves padding inside a shape', () => {
    expect(containerLabelWidth(shape('s', { width: 200 }))).toBe(184)
  })

  it('never goes below the minimum width', () => {
    expect(containerLabelWidth(shape('s', { width: 40 }))).toBe(60)
  })

  it('caps arrow labels and uses the longer axis', () => {
    expect(containerLabelWidth(arrow('a', { x: 0, y: 0 }, { x: 100, y: 0 }))).toBe(100)
    expect(containerLabelWidth(arrow('a', { x: 0, y: 0 }, { x: 500, y: 0 }))).toBe(240)
  })
})

describe('layoutLabel', () => {
  it('lays a shape label out with padding and vertical centring', () => {
    const layout = layoutLabel(label('t', 's'), shape('s'))
    expect(layout).toEqual({
      text: 'Label',
      x: 8,
      y: 37.5,
      width: 184,
      height: 25,
      autoResize: false,
    })
  })

  it('wraps a long shape label at the container width', () => {
    const text = label('t', 's', {
      text: 'one two three four five six seven eight',
      originalText: 'one two three four five six seven eight',
    })
    const layout = layoutLabel(text, shape('s', { width: 120 }))
    expect(layout.width).toBe(104)
    expect(layout.text).toContain('\n')
    expect(layout.height).toBeGreaterThan(25)
  })

  it('centres an arrow label on the route', () => {
    const a = arrow('a', { x: 0, y: 0 }, { x: 100, y: 0 })
    const layout = layoutLabel(
      label('t', 'a', { text: 'hi', originalText: 'hi', fontSize: 16 }),
      a,
    )
    expect(layout.width).toBe(60)
    expect(layout.x).toBe(20)
    expect(layout.y).toBe(-10)
    expect(layout.text).toBe('hi')
  })
})

describe('reflowLabel', () => {
  it('returns a new label object with the container layout applied', () => {
    const before = label('t', 's')
    const after = reflowLabel(before, shape('s', { x: 50, y: 20 }))
    expect(after).not.toBe(before)
    expect(after).toMatchObject({ x: 58, y: 57.5, width: 184 })
    expect(before.x).not.toBe(58)
  })
})

describe('bound text references', () => {
  it('adds a reference without duplicating it', () => {
    const s = shape('s')
    const once = withBoundText(s, 't1')
    expect(once.boundElements).toEqual([{ type: 'text', id: 't1' }])
    expect(withBoundText(once, 't1').boundElements).toEqual([{ type: 'text', id: 't1' }])
    expect(withBoundText(once, 't2').boundElements).toHaveLength(2)
  })

  it('drops a reference and removes the empty array', () => {
    const s = shape('s', { boundElements: [{ type: 'text', id: 't1' }] })
    const next = withoutBoundText(s, 't1')
    expect('boundElements' in next).toBe(false)
    const two = shape('s', {
      boundElements: [
        { type: 'text', id: 't1' },
        { type: 'text', id: 't2' },
      ],
    })
    expect(withoutBoundText(two, 't1').boundElements).toEqual([{ type: 'text', id: 't2' }])
  })
})

describe('deletionSet', () => {
  const s = shape('s')
  const t = label('t', 's')
  const attachedStart = arrow('as', { x: 0, y: 0 }, { x: 10, y: 0 }, { startBinding: bind('s') })
  const attachedEnd = arrow('ae', { x: 0, y: 0 }, { x: 10, y: 0 }, { endBinding: bind('s') })
  const loose = arrow('loose', { x: 0, y: 0 }, { x: 10, y: 0 })
  const elements: ExcalidrawElement[] = [s, t, attachedStart, attachedEnd, loose]

  it('takes a shape label and every attached arrow with the shape', () => {
    expect([...deletionSet(elements, ['s'])].sort()).toEqual(['ae', 'as', 's', 't'])
  })

  it('leaves the container alive when only its label is deleted', () => {
    expect([...deletionSet(elements, ['t'])]).toEqual(['t'])
  })

  it('follows cascades transitively', () => {
    // Deleting a label does not delete arrows; deleting the shape does.
    expect([...deletionSet(elements, ['s', 't'])]).toEqual(
      expect.arrayContaining(['s', 't', 'as', 'ae']),
    )
    expect(deletionSet(elements, ['s', 't']).size).toBe(4)
  })

  it('returns an empty set for unknown ids', () => {
    expect(deletionSet(elements, ['nope']).size).toBe(1)
  })
})
