import { describe, expect, it } from 'vitest'
import {
  ARROW_GAP,
  ATTACH_DISTANCE,
  bindArrowEnds,
  borderAnchor,
  clearArrowBindings,
  detachRemoved,
  facingAnchor,
  findBindShape,
  fixedPoint,
  isBoxShape,
  pointFromFixedPoint,
  remapArrowBindings,
  resnapArrow,
} from './binding'
import { textElement } from './testHelpers'
import type {
  ArrowElement,
  ArrowBinding,
  ExcalidrawElement,
  RectLikeElement,
} from './types'

const shape = (id: string, overrides: Partial<RectLikeElement> = {}): RectLikeElement =>
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

const bind = (
  elementId: string,
  mode: 'inside' | 'orbit' = 'inside',
  fp: [number, number] = [1, 0.5],
): ArrowBinding => ({ elementId, mode, fixedPoint: fp })

describe('isBoxShape', () => {
  it('accepts every box shape and rejects arrows, pen and text', () => {
    for (const type of ['rectangle', 'ellipse', 'laptop', 'database', 'server', 'cloud', 'user'] as const) {
      expect(isBoxShape(shape('s', { type }))).toBe(true)
    }
    expect(isBoxShape(arrow('a', { x: 0, y: 0 }, { x: 1, y: 1 }))).toBe(false)
    expect(isBoxShape(textElement('t'))).toBe(false)
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

describe('anchors', () => {
  const box = shape('s', { x: 100, y: 200, width: 100, height: 60 })

  it('uses facing-edge midpoints plus the gap for inside bindings', () => {
    expect(facingAnchor(box, { x: 500, y: 230 })).toEqual({ x: 200 + ARROW_GAP, y: 230 })
    expect(facingAnchor(box, { x: -100, y: 230 })).toEqual({ x: 100 - ARROW_GAP, y: 230 })
    expect(facingAnchor(box, { x: 150, y: 500 })).toEqual({ x: 150, y: 260 + ARROW_GAP })
    expect(facingAnchor(box, { x: 150, y: -500 })).toEqual({ x: 150, y: 200 - ARROW_GAP })
  })

  it('uses the nearest border point plus the gap for orbit bindings', () => {
    expect(borderAnchor(box, { x: 500, y: 230 })).toEqual({ x: 200 + ARROW_GAP, y: 230 })
    expect(borderAnchor(box, { x: -100, y: 230 })).toEqual({ x: 100 - ARROW_GAP, y: 230 })
    expect(borderAnchor(box, { x: 150, y: 500 })).toEqual({ x: 150, y: 260 + ARROW_GAP })
    expect(borderAnchor(box, { x: 150, y: -100 })).toEqual({ x: 150, y: 200 - ARROW_GAP })
  })

  it('normalized fixed points round-trip through the shape box', () => {
    const p = { x: 125, y: 245 }
    const fp = fixedPoint(box, p)
    expect(fp).toEqual([0.25, 0.75])
    expect(pointFromFixedPoint(box, fp)).toEqual(p)
  })
})

describe('findBindShape', () => {
  it('marks points inside as inside and nearby points as orbit', () => {
    const s = shape('s', { x: 0, y: 0, width: 100, height: 60 })
    expect(findBindShape([s], { x: 50, y: 30 })?.mode).toBe('inside')
    expect(findBindShape([s], { x: 100 + 10, y: 30 })?.mode).toBe('orbit')
    expect(findBindShape([s], { x: 100 + ATTACH_DISTANCE + 1, y: 30 })).toBeNull()
  })

  it('prefers the topmost shape and skips non-box shapes', () => {
    const bottom = shape('bottom')
    const top = shape('top', { x: 10, y: 10 })
    expect(findBindShape([bottom, top, textElement('t')], { x: 20, y: 20 })?.shape.id).toBe('top')
  })
})

describe('bindArrowEnds', () => {
  const s = shape('s', { x: 100, y: 100, width: 100, height: 60 })

  it('snaps inside ends to the facing edge and records proportional bindings', () => {
    const bound = bindArrowEnds(
      arrow('a', { x: 20, y: 130 }, { x: 190, y: 130 }),
      [s],
    )
    expect(bound.points).toEqual([
      { x: 20, y: 130 },
      { x: 100 - ARROW_GAP, y: 130 },
    ])
    expect(bound.endBinding).toMatchObject({ elementId: 's', mode: 'inside' })
    expect(bound.startBinding).toBeUndefined()
  })

  it('approaching from the right uses the right edge', () => {
    const bound = bindArrowEnds(
      arrow('a', { x: 400, y: 130 }, { x: 190, y: 130 }),
      [s],
    )
    expect(bound.points[1]).toEqual({ x: 200 + ARROW_GAP, y: 130 })
  })

  it('binds both ends when the arrow sits between shapes', () => {
    const a = shape('a', { x: 0, y: 0, width: 100, height: 60 })
    const b = shape('b', { x: 300, y: 0, width: 100, height: 60 })
    const bound = bindArrowEnds(arrow('arr', { x: 90, y: 30 }, { x: 310, y: 30 }), [a, b])
    expect(bound.startBinding).toMatchObject({ elementId: 'a', mode: 'inside' })
    expect(bound.endBinding).toMatchObject({ elementId: 'b', mode: 'inside' })
    expect(bound.points).toEqual([
      { x: 100 + ARROW_GAP, y: 30 },
      { x: 300 - ARROW_GAP, y: 30 },
    ])
  })

  it('binds near misses as orbit attachments', () => {
    const bound = bindArrowEnds(
      arrow('a', { x: 20, y: 130 }, { x: 210, y: 130 }),
      [s],
    )
    expect(bound.endBinding).toMatchObject({ elementId: 's', mode: 'orbit' })
  })

  it('leaves arrows in open space untouched', () => {
    const plain = arrow('a', { x: 500, y: 500 }, { x: 600, y: 520 })
    expect(bindArrowEnds(plain, [s])).toEqual(plain)
  })
})

describe('resnapArrow', () => {
  it('recomputes the bound end from the proportional anchor', () => {
    const moved = shape('s', { x: 300, y: 100, width: 100, height: 60 })
    const bound = arrow(
      'a',
      { x: 20, y: 130 },
      { x: 206, y: 130 },
      { endBinding: bind('s', 'inside', [1.06, 0.5]) },
    )
    const snapped = resnapArrow(bound, new Map([['s', moved]]))
    expect(snapped?.points).toEqual([
      { x: 20, y: 130 },
      { x: 406, y: 130 },
    ])
  })

  it('returns null when the shape is unchanged or absent', () => {
    const s = shape('s', { x: 100, y: 100 })
    const bound = arrow(
      'a',
      { x: 20, y: 130 },
      { x: 106, y: 130 },
      { endBinding: bind('s', 'inside', [0.06, 0.5]) },
    )
    expect(resnapArrow(bound, new Map([['s', s]]))).toBeNull()
    expect(resnapArrow(bound, new Map())).toBeNull()
    expect(resnapArrow(arrow('b', { x: 0, y: 0 }, { x: 5, y: 5 }), new Map())).toBeNull()
  })
})

describe('binding edits', () => {
  const bound = arrow(
    'a',
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { startBinding: bind('a'), endBinding: bind('b') },
  )

  it('clearArrowBindings drops both and keeps endpoints', () => {
    const cleared = clearArrowBindings(bound)
    expect(cleared.startBinding).toBeUndefined()
    expect(cleared.endBinding).toBeUndefined()
    expect(cleared.points).toEqual(bound.points)
    expect(bound.startBinding).toBeTruthy()
  })

  it('detachRemoved drops only the binding to a removed shape', () => {
    const next = detachRemoved(bound, new Set(['a']))
    expect(next?.startBinding).toBeUndefined()
    expect(next?.endBinding).toEqual(bind('b'))
    expect(next?.points).toEqual(bound.points)
    expect(detachRemoved(bound, new Set(['other']))).toBeNull()
    expect(detachRemoved(arrow('b', { x: 0, y: 0 }, { x: 1, y: 1 }), new Set(['a']))).toBeNull()
  })

  it('remapArrowBindings maps through the id map and drops unmapped ones', () => {
    const next = remapArrowBindings(
      arrow('a', { x: 0, y: 0 }, { x: 100, y: 0 }, {
        startBinding: bind('old-a'),
        endBinding: bind('outside'),
      }),
      new Map([['old-a', 'new-a']]),
    )
    expect(next.startBinding).toMatchObject({ elementId: 'new-a', mode: 'inside' })
    expect(next.endBinding).toBeUndefined()
    expect(next.id).toBe('a')
  })
})

describe('binding arrow ends with text present', () => {
  it('never binds to text elements', () => {
    const t = textElement('t', { x: 0, y: 0 })
    const a: ExcalidrawElement = arrow('a', { x: 10, y: 10 }, { x: 50, y: 10 })
    expect(bindArrowEnds(a as ArrowElement, [t]).endBinding).toBeUndefined()
  })
})
