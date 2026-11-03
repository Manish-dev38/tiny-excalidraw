import { describe, expect, it } from 'vitest'
import { hitTestElement, translateElement } from './select'
import type { ArrowElement, ExcalidrawElement, PenElement } from '../core/types'

const rect = (id: string, x: number, y: number): ExcalidrawElement => ({
  id,
  type: 'rectangle',
  x,
  y,
  width: 10,
  height: 10,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

const pen = (id: string, points: { x: number; y: number }[]): ExcalidrawElement => ({
  id,
  type: 'pen',
  x: points[0]?.x ?? 0,
  y: points[0]?.y ?? 0,
  points,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

describe('hitTestElement', () => {
  it('hits a rectangle inside its bounds', () => {
    expect(hitTestElement(rect('a', 0, 0), { x: 5, y: 5 })).toBe(true)
  })
  it('hits a rectangle on its boundary', () => {
    expect(hitTestElement(rect('a', 0, 0), { x: 10, y: 5 })).toBe(true)
  })
  it('misses a point outside the rectangle', () => {
    expect(hitTestElement(rect('a', 0, 0), { x: 12, y: 5 })).toBe(false)
  })
  it('hits a pen stroke near one of its points', () => {
    const p = pen('a', [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ])
    expect(hitTestElement(p, { x: 2, y: 2 })).toBe(true)
  })
  it('misses a pen stroke far from all its points', () => {
    const p = pen('a', [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ])
    expect(hitTestElement(p, { x: 50, y: 50 })).toBe(false)
  })
})

describe('translateElement', () => {
  it('moves a rectangle by an offset (immutably)', () => {
    const moved = translateElement(rect('a', 0, 0), { dx: 5, dy: -3 })
    expect(moved).toMatchObject({ x: 5, y: -3 })
  })
  it('moves a pen element and its points', () => {
    const p = pen('a', [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ])
    const moved = translateElement(p, { dx: 10, dy: 20 }) as PenElement
    expect(moved.x).toBe(11)
    expect(moved.y).toBe(22)
    expect(moved.points).toEqual([
      { x: 11, y: 22 },
      { x: 13, y: 24 },
    ])
  })
  it('moves an arrow element and both endpoints', () => {
    const a: ExcalidrawElement = {
      id: 'a',
      type: 'arrow',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      x: 0,
      y: 0,
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 1,
    }
    const moved = translateElement(a, { dx: 2, dy: 2 }) as ArrowElement
    expect(moved.points).toEqual([
      { x: 2, y: 2 },
      { x: 12, y: 12 },
    ])
  })
})
