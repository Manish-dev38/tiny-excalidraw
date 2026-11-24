import { describe, expect, it } from 'vitest'
import {
  MIN_SIZE,
  boxFromBBox,
  groupFontScale,
  handlePoints,
  hitHandle,
  resizeBox,
  resizeElement,
  resizeTextBox,
  selectionBox,
  type Box,
} from './resize'
import { MIN_TEXT_WIDTH } from './textLayout'
import { textElement } from './testHelpers'
import type { ArrowElement, ExcalidrawElement, PenElement, TextElement } from './types'

const box: Box = { x: 0, y: 0, width: 100, height: 50 }

describe('handles', () => {
  it('places eight handles around a shape', () => {
    const handles = handlePoints(box)
    expect(handles).toHaveLength(8)
    expect(handles.find((h) => h.handle === 'nw')).toMatchObject({ x: 0, y: 0 })
    expect(handles.find((h) => h.handle === 'se')).toMatchObject({ x: 100, y: 50 })
    expect(handles.find((h) => h.handle === 'e')).toMatchObject({ x: 100, y: 25 })
  })

  it('offers only width handles for text', () => {
    const handles = handlePoints(box, true).map((h) => h.handle)
    expect(handles).toEqual(['nw', 'ne', 'sw', 'se', 'e', 'w'])
  })

  it('hit-tests handles with a slop', () => {
    const handles = handlePoints(box)
    expect(hitHandle(handles, { x: -4, y: 4 }, 10)?.handle).toBe('nw')
    expect(hitHandle(handles, { x: 50, y: 25 }, 10)).toBeNull()
  })
})

describe('resizeBox', () => {
  it('moves the dragged edge and anchors the opposite one', () => {
    expect(resizeBox(box, 'e', { x: 150, y: 20 })).toEqual({
      x: 0,
      y: 0,
      width: 150,
      height: 50,
    })
    expect(resizeBox(box, 'nw', { x: 10, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 90,
      height: 45,
    })
  })

  it('preserves aspect ratio on corners with Shift', () => {
    const next = resizeBox(box, 'se', { x: 200, y: 100 }, { shift: true })
    expect(next.width / next.height).toBeCloseTo(2)
    expect(next.x).toBe(0)
    expect(next.y).toBe(0)
  })

  it('resizes from the centre with Alt', () => {
    const next = resizeBox(box, 'e', { x: 150, y: 25 }, { alt: true })
    expect(next.width).toBe(200)
    expect(next.height).toBe(50)
    expect(next.x).toBe(-50)
  })

  it('never shrinks below the minimum size', () => {
    const next = resizeBox(box, 'se', { x: -500, y: -500 })
    expect(next.width).toBeGreaterThanOrEqual(MIN_SIZE)
    expect(next.height).toBeGreaterThanOrEqual(MIN_SIZE)
  })
})

describe('resizeTextBox', () => {
  it('changes only width and x', () => {
    expect(resizeTextBox(box, 'e', { x: 180, y: 999 })).toEqual({
      x: 0,
      y: 0,
      width: 180,
      height: 50,
    })
  })

  it('enforces the minimum text width', () => {
    expect(resizeTextBox(box, 'e', { x: -100, y: 0 }).width).toBe(MIN_TEXT_WIDTH)
  })
})

describe('resizeElement', () => {
  const rect: ExcalidrawElement = {
    id: 'r',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    strokeColor: '#000',
    background: 'transparent',
    strokeWidth: 4,
  }

  it('scales shape geometry without touching stroke width', () => {
    const next = resizeElement(rect, box, { x: 10, y: 20, width: 300, height: 150 })
    expect(next).toMatchObject({ x: 10, y: 20, width: 300, height: 150, strokeWidth: 4 })
  })

  it('re-wraps text at the new width', () => {
    const text = textElement('t', {
      text: 'one two three four five six',
      originalText: 'one two three four five six',
      width: 200,
      autoResize: false,
    })
    const next = resizeElement(
      text,
      { x: 0, y: 0, width: 200, height: 25 },
      { x: 0, y: 0, width: 90, height: 25 },
    ) as TextElement
    expect(next.width).toBe(90)
    expect(next.text).toContain('\n')
    expect(next.autoResize).toBe(false)
  })

  it('scales text font with the group factor', () => {
    const text = textElement('t', { fontSize: 20 })
    const next = resizeElement(
      text,
      box,
      { x: 0, y: 0, width: 200, height: 100 },
      { fontScale: 2 },
    ) as TextElement
    expect(next.fontSize).toBe(40)
  })

  it('scales pen points into the new box', () => {
    const pen: PenElement = {
      id: 'p',
      type: 'pen',
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 2,
    }
    const next = resizeElement(pen, box, { x: 10, y: 10, width: 200, height: 100 }) as PenElement
    expect(next.points).toEqual([
      { x: 10, y: 10 },
      { x: 210, y: 110 },
    ])
  })

  it('leaves bound arrows for the binding pass', () => {
    const arrow: ArrowElement = {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 2,
      endBinding: { elementId: 's', mode: 'inside', fixedPoint: [1, 0.5] },
    }
    expect(resizeElement(arrow, box, { x: 0, y: 0, width: 200, height: 100 })).toBe(arrow)
  })
})

describe('selection helpers', () => {
  it('hugs a lone text block instead of its stroke padding', () => {
    const text = textElement('t', { x: 10, y: 20, fontSize: 20 })
    expect(selectionBox([text])).toEqual({
      x: 10,
      y: 20,
      width: text.width,
      height: text.height,
    })
  })

  it('unions multiple element bounds', () => {
    const a: ExcalidrawElement = {
      id: 'a',
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 0,
    }
    const b: ExcalidrawElement = { ...a, id: 'b', x: 20, y: 20 }
    expect(boxFromBBox({ minX: 0, minY: 0, maxX: 30, maxY: 30 })).toEqual({
      x: 0,
      y: 0,
      width: 30,
      height: 30,
    })
    expect(selectionBox([a, b])).toEqual({ x: 0, y: 0, width: 30, height: 30 })
  })

  it('derives the group font factor from the smallest axis', () => {
    expect(groupFontScale(box, { ...box, width: 200, height: 200 })).toBe(2)
    expect(groupFontScale(box, { ...box, width: 200, height: 25 })).toBe(0.5)
  })
})
