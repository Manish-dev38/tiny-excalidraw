import { describe, expect, it } from 'vitest'
import { migrateElements } from './migrate'
import type { ArrowElement, RectLikeElement, TextElement } from './types'

const base = {
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
}

const shape = (id: string, overrides: Record<string, unknown> = {}): RectLikeElement =>
  ({
    id,
    type: 'rectangle',
    x: 100,
    y: 100,
    width: 100,
    height: 60,
    ...base,
    ...overrides,
  }) as RectLikeElement

function arrowOf(elements: unknown[]): ArrowElement {
  const found = elements.find((el) => (el as { type?: string }).type === 'arrow')
  if (!found) throw new Error('no arrow')
  return found as ArrowElement
}

function textOf(elements: unknown[]): TextElement {
  const found = elements.find((el) => (el as { type?: string }).type === 'text')
  if (!found) throw new Error('no text')
  return found as TextElement
}

describe('migrateElements: arrows', () => {
  it('converts a legacy shapeId attachment into a proportional anchor', () => {
    const s = shape('s')
    const legacy = {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 130,
      points: [
        { x: 0, y: 130 },
        { x: 190, y: 130 },
      ],
      ...base,
      endBinding: { shapeId: 's' },
    }
    const out = migrateElements([s, legacy])
    const arrow = arrowOf(out)
    expect(arrow.endBinding).toEqual({
      elementId: 's',
      mode: 'inside',
      fixedPoint: [-0.06, 0.5],
    })
    expect(arrow.startBinding).toBeUndefined()
    expect(arrow.points[1]).toEqual({ x: 94, y: 130 })
    expect(arrow.endArrowhead).toBe('arrow')
  })

  it('refreshes endpoints for an existing v3 binding', () => {
    const s = shape('s', { x: 0, y: 0, width: 100, height: 60 })
    const current = {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 30,
      points: [
        { x: 0, y: 30 },
        { x: 10, y: 30 },
      ],
      ...base,
      endBinding: { elementId: 's', mode: 'orbit', fixedPoint: [1.06, 0.5] },
      endArrowhead: 'triangle',
    }
    const arrow = arrowOf(migrateElements([s, current]))
    expect(arrow.endBinding).toMatchObject({ mode: 'orbit', fixedPoint: [1.06, 0.5] })
    expect(arrow.points[1]).toEqual({ x: 106, y: 30 })
    expect(arrow.endArrowhead).toBe('triangle')
  })

  it('drops bindings to shapes that are no longer on the board', () => {
    const current = {
      id: 'a',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      ...base,
      startBinding: { elementId: 'gone', mode: 'inside', fixedPoint: [1, 0.5] },
    }
    const arrow = arrowOf(migrateElements([current]))
    expect(arrow.startBinding).toBeUndefined()
    expect(arrow.points[0]).toEqual({ x: 0, y: 0 })
  })
})

describe('migrateElements: standalone text', () => {
  it('fills in metrics and layout defaults for a legacy text', () => {
    const legacy = {
      id: 't',
      type: 'text',
      x: 5,
      y: 6,
      text: 'Hello world',
      fontSize: 20,
      ...base,
    }
    const text = textOf(migrateElements([legacy]))
    expect(text.originalText).toBe('Hello world')
    expect(text.autoResize).toBe(true)
    expect(text.textAlign).toBe('left')
    expect(text.verticalAlign).toBe('top')
    expect(text.lineHeight).toBe(1.25)
    expect(text.width).toBeCloseTo(114.4)
    expect(text.height).toBeCloseTo(25)
    expect(text.x).toBe(5)
  })

  it('re-wraps a fixed-width text at its stored width', () => {
    const legacy = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      text: 'one two three four five six',
      fontSize: 20,
      width: 120,
      autoResize: false,
      ...base,
    }
    const text = textOf(migrateElements([legacy]))
    expect(text.width).toBe(120)
    expect(text.text).toContain('\n')
    expect(text.height).toBeGreaterThan(25)
  })
})

describe('migrateElements: container labels', () => {
  it('binds a label to its container and centres it', () => {
    const s = shape('s', { x: 0, y: 0, width: 200, height: 100 })
    const label = {
      id: 't',
      type: 'text',
      x: 50,
      y: 50,
      text: 'Hi',
      fontSize: 20,
      containerId: 's',
      ...base,
    }
    const out = migrateElements([s, label])
    const text = textOf(out)
    expect(text).toMatchObject({
      autoResize: false,
      textAlign: 'center',
      verticalAlign: 'middle',
      x: 8,
      y: 37.5,
      width: 184,
      height: 25,
      text: 'Hi',
    })
    expect((out[0] as RectLikeElement).boundElements).toEqual([{ type: 'text', id: 't' }])
  })

  it('rebuilds boundElements from the labels that point at a container', () => {
    const s = shape('s', { boundElements: [{ type: 'text', id: 'gone' }] })
    const label = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      text: 'Hi',
      fontSize: 20,
      containerId: 's',
      ...base,
    }
    const out = migrateElements([s, label])
    expect((out[0] as RectLikeElement).boundElements).toEqual([{ type: 'text', id: 't' }])
  })

  it('clears stale container references', () => {
    const s = shape('s', {
      boundElements: [
        { type: 'text', id: 't' },
        { type: 'text', id: 'gone' },
      ],
    })
    const out = migrateElements([s])
    expect('boundElements' in out[0]).toBe(false)
  })

  it('treats text pointing at a non-container as standalone', () => {
    const other = {
      id: 'other',
      type: 'text',
      x: 0,
      y: 0,
      text: 'other',
      fontSize: 20,
      ...base,
    }
    const child = {
      id: 't',
      type: 'text',
      x: 0,
      y: 0,
      text: 'Hi',
      fontSize: 20,
      containerId: 'other',
      ...base,
    }
    const text = textOf(migrateElements([other, child]).filter((el) => (el as TextElement).id === 't'))
    expect(text.containerId).toBeUndefined()
    expect(text.autoResize).toBe(true)
    expect(text.textAlign).toBe('left')
  })
})
