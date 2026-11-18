import { describe, expect, it } from 'vitest'
import {
  ATTACH_PADDING,
  bindArrowEnds,
  clearArrowBindings,
  detachRemoved,
  findAttachShape,
  isBoxShape,
  remapArrowBindings,
  resnapArrow,
  shapeAnchor,
} from './binding'
import type { ArrowElement, ExcalidrawElement, RectLikeElement } from './types'

const shape = (
  id: string,
  overrides: Partial<RectLikeElement> = {},
): RectLikeElement =>
  ({
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 60,
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

const text = (id: string): ExcalidrawElement => ({
  id,
  type: 'text',
  x: 0,
  y: 0,
  text: 'hi',
  fontSize: 16,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

describe('isBoxShape', () => {
  it('accepts every box shape and rejects arrows, pen and text', () => {
    for (const type of ['rectangle', 'ellipse', 'laptop', 'database', 'server', 'cloud', 'user'] as const) {
      expect(isBoxShape(shape('s', { type }))).toBe(true)
    }
    expect(isBoxShape(arrow('a', { x: 0, y: 0 }, { x: 1, y: 1 }))).toBe(false)
    expect(isBoxShape(text('t'))).toBe(false)
    expect(
      isBoxShape({
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

describe('shapeAnchor', () => {
  const box = shape('s', { x: 100, y: 200, width: 100, height: 60 })
  it('anchors on the side facing the target', () => {
    expect(shapeAnchor(box, { x: 500, y: 230 })).toEqual({ x: 200, y: 230 })
    expect(shapeAnchor(box, { x: -100, y: 230 })).toEqual({ x: 100, y: 230 })
    expect(shapeAnchor(box, { x: 150, y: 500 })).toEqual({ x: 150, y: 260 })
    expect(shapeAnchor(box, { x: 150, y: -500 })).toEqual({ x: 150, y: 200 })
  })
  it('uses side midpoints, not corners', () => {
    expect(shapeAnchor(box, { x: 1000, y: 230 })).toEqual({ x: 200, y: 230 })
    expect(shapeAnchor(box, { x: 150, y: 1000 })).toEqual({ x: 150, y: 260 })
  })
})

describe('findAttachShape', () => {
  it('finds a shape inside its padded bounds', () => {
    const s = shape('s', { x: 0, y: 0, width: 100, height: 60 })
    expect(findAttachShape([s], { x: 50, y: 30 })?.id).toBe('s')
    expect(findAttachShape([s], { x: 100 + ATTACH_PADDING, y: 30 })?.id).toBe('s')
    expect(findAttachShape([s], { x: 100 + ATTACH_PADDING + 1, y: 30 })).toBeNull()
  })
  it('prefers the topmost shape and skips non-box shapes', () => {
    const bottom = shape('bottom')
    const top = shape('top', { x: 10, y: 10 })
    expect(findAttachShape([bottom, top, text('t')], { x: 20, y: 20 })?.id).toBe('top')
  })
})

describe('bindArrowEnds', () => {
  const s = shape('s', { x: 100, y: 100, width: 100, height: 60 })

  it('snaps ends that land on shapes and records the bindings', () => {
    const bound = bindArrowEnds(
      arrow('a', { x: 20, y: 130 }, { x: 190, y: 130 }),
      [s],
    )
    // Drawn from the left, so the end snaps to the shape's left edge midpoint.
    expect(bound.points).toEqual([
      { x: 20, y: 130 },
      { x: 100, y: 130 },
    ])
    expect(bound.endBinding).toEqual({ shapeId: 's' })
    expect(bound.startBinding).toBeUndefined()
  })

  it('snaps to the right edge when approaching from the right', () => {
    const bound = bindArrowEnds(
      arrow('a', { x: 400, y: 130 }, { x: 190, y: 130 }),
      [s],
    )
    expect(bound.points[1]).toEqual({ x: 200, y: 130 })
  })

  it('binds both ends when the arrow sits between shapes', () => {
    const a = shape('a', { x: 0, y: 0, width: 100, height: 60 })
    const b = shape('b', { x: 300, y: 0, width: 100, height: 60 })
    const bound = bindArrowEnds(arrow('arr', { x: 90, y: 30 }, { x: 310, y: 30 }), [a, b])
    expect(bound.startBinding).toEqual({ shapeId: 'a' })
    expect(bound.endBinding).toEqual({ shapeId: 'b' })
    expect(bound.points).toEqual([
      { x: 100, y: 30 },
      { x: 300, y: 30 },
    ])
  })

  it('leaves arrows in open space untouched', () => {
    const plain = arrow('a', { x: 500, y: 500 }, { x: 600, y: 520 })
    expect(bindArrowEnds(plain, [s])).toEqual(plain)
  })
})

describe('resnapArrow', () => {
  it('recomputes the bound end against a moved shape', () => {
    const moved = shape('s', { x: 300, y: 100, width: 100, height: 60 })
    const bound = arrow(
      'a',
      { x: 20, y: 130 },
      { x: 200, y: 130 },
      { endBinding: { shapeId: 's' } },
    )
    const snapped = resnapArrow(bound, new Map([['s', moved]]))
    expect(snapped?.points).toEqual([
      { x: 20, y: 130 },
      { x: 300, y: 130 },
    ])
  })

  it('returns null when the shape did not move or is absent', () => {
    const s = shape('s', { x: 100, y: 100 })
    const bound = arrow(
      'a',
      { x: 20, y: 130 },
      { x: 100, y: 130 },
      { endBinding: { shapeId: 's' } },
    )
    expect(resnapArrow(bound, new Map([['s', s]]))).toBeNull()
    expect(resnapArrow(bound, new Map())).toBeNull()
    expect(resnapArrow(arrow('b', { x: 0, y: 0 }, { x: 5, y: 5 }), new Map())).toBeNull()
  })
})

describe('clearArrowBindings', () => {
  it('drops both bindings and keeps the endpoints', () => {
    const bound = arrow(
      'a',
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { startBinding: { shapeId: 'a' }, endBinding: { shapeId: 'b' } },
    )
    const cleared = clearArrowBindings(bound)
    expect(cleared.startBinding).toBeUndefined()
    expect(cleared.endBinding).toBeUndefined()
    expect(cleared.points).toEqual(bound.points)
    expect(bound.startBinding).toEqual({ shapeId: 'a' })
  })
})

describe('detachRemoved', () => {
  const bound = arrow(
    'a',
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { startBinding: { shapeId: 's1' }, endBinding: { shapeId: 's2' } },
  )

  it('drops only the binding to a removed shape', () => {
    const next = detachRemoved(bound, new Set(['s1']))
    expect(next?.startBinding).toBeUndefined()
    expect(next?.endBinding).toEqual({ shapeId: 's2' })
    expect(next?.points).toEqual(bound.points)
  })

  it('returns null when nothing points at the removed shape', () => {
    expect(detachRemoved(bound, new Set(['other']))).toBeNull()
    expect(detachRemoved(arrow('b', { x: 0, y: 0 }, { x: 1, y: 1 }), new Set(['s1']))).toBeNull()
  })
})

describe('remapArrowBindings', () => {
  const bound = arrow(
    'a',
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { startBinding: { shapeId: 'old-a' }, endBinding: { shapeId: 'outside' } },
  )

  it('maps bindings through the id map and drops unmapped ones', () => {
    const next = remapArrowBindings(bound, new Map([['old-a', 'new-a']]))
    expect(next.startBinding).toEqual({ shapeId: 'new-a' })
    expect(next.endBinding).toBeUndefined()
    expect(next.id).toBe('a')
  })
})
