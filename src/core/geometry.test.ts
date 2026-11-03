import { describe, expect, it } from 'vitest'
import {
  bboxOf,
  dist,
  ellipseContainsPoint,
  fitRect,
  rectContainsPoint,
  shapesOverlap,
} from './geometry'
import type { ExcalidrawElement } from './types'

const rect = (overrides: Partial<ExcalidrawElement> = {}): ExcalidrawElement =>
  ({
    id: 'r1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    strokeColor: '#000',
    background: 'transparent',
    strokeWidth: 1,
    ...overrides,
  }) as ExcalidrawElement

describe('dist', () => {
  it('computes Euclidean distance', () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(dist({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0)
  })
})

describe('rectContainsPoint', () => {
  it('contains interior points', () => {
    expect(rectContainsPoint(0, 0, 10, 10, 5, 5)).toBe(true)
  })
  it('contains boundary points inclusively', () => {
    expect(rectContainsPoint(0, 0, 10, 10, 10, 10)).toBe(true)
    expect(rectContainsPoint(0, 0, 10, 10, 0, 0)).toBe(true)
  })
  it('rejects outside points', () => {
    expect(rectContainsPoint(0, 0, 10, 10, 11, 5)).toBe(false)
    expect(rectContainsPoint(0, 0, 10, 10, 5, -1)).toBe(false)
  })
})

describe('ellipseContainsPoint', () => {
  const cx = 5
  const cy = 5
  it('contains center', () => {
    expect(ellipseContainsPoint(0, 0, 10, 10, cx, cy)).toBe(true)
  })
  it('contains points on the boundary', () => {
    expect(ellipseContainsPoint(0, 0, 10, 10, 10, 5)).toBe(true)
  })
  it('rejects outside points', () => {
    expect(ellipseContainsPoint(0, 0, 10, 10, 10.1, 5)).toBe(false)
    expect(ellipseContainsPoint(0, 0, 10, 10, 5, 10.1)).toBe(false)
  })
})

describe('fitRect', () => {
  it('normalizes a drag from top-left to bottom-right', () => {
    expect(fitRect({ x: 10, y: 20 }, { x: 30, y: 5 })).toEqual({
      x: 10,
      y: 5,
      width: 20,
      height: 15,
    })
  })
  it('normalizes a drag from bottom-right to top-left', () => {
    expect(fitRect({ x: 30, y: 30 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    })
  })
})

describe('bboxOf', () => {
  it('encloses a rectangle with half its stroke width', () => {
    const el = rect({ x: 0, y: 0, width: 10, height: 10, strokeWidth: 2 })
    expect(bboxOf(el)).toEqual({ minX: -1, minY: -1, maxX: 11, maxY: 11 })
  })
  it('encloses a pen element across all its points', () => {
    const pen: ExcalidrawElement = {
      id: 'p1',
      type: 'pen',
      x: 0,
      y: 0,
      points: [
        { x: 2, y: 3 },
        { x: -5, y: 8 },
        { x: 4, y: -2 },
      ],
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 1,
    }
    expect(bboxOf(pen)).toEqual({ minX: -5.5, minY: -2.5, maxX: 4.5, maxY: 8.5 })
  })
})

describe('shapesOverlap', () => {
  it('detects overlapping bounding boxes', () => {
    const a = rect({ x: 0, y: 0, width: 10, height: 10 })
    const b = rect({ x: 5, y: 5, width: 10, height: 10 })
    expect(shapesOverlap(a, b)).toBe(true)
  })
  it('rejects disjoint bounding boxes', () => {
    const a = rect({ x: 0, y: 0, width: 10, height: 10 })
    const b = rect({ x: 20, y: 0, width: 10, height: 10 })
    expect(shapesOverlap(a, b)).toBe(false)
  })
})
