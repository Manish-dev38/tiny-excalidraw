import { describe, expect, it } from 'vitest'
import { cloneElements, createClipboardStore } from './clipboard'
import type { ExcalidrawElement } from '../core/types'

const rect = (id: string): ExcalidrawElement => ({
  id,
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

function stubBackend() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('createClipboardStore', () => {
  it('round-trips elements through the backend', () => {
    const store = createClipboardStore(stubBackend())
    store.write([rect('a'), rect('b')])
    expect(store.read()).toEqual([rect('a'), rect('b')])
  })
  it('reads empty when nothing was written', () => {
    expect(createClipboardStore(stubBackend()).read()).toEqual([])
  })
  it('reads empty from a null backend', () => {
    const store = createClipboardStore(null)
    store.write([rect('a')])
    expect(store.read()).toEqual([])
  })
  it('ignores corrupt payloads', () => {
    const backend = stubBackend()
    const store = createClipboardStore(backend)
    store.write([rect('a')])
    backend.setItem('tiny-clipboard', '{not json')
    expect(store.read()).toEqual([])
    backend.setItem('tiny-clipboard', '{"nope": 1}')
    expect(store.read()).toEqual([])
  })
  it('does not write an empty selection (keeps previous clipboard)', () => {
    const backend = stubBackend()
    const store = createClipboardStore(backend)
    store.write([rect('a')])
    store.write([])
    expect(store.read()).toEqual([rect('a')])
  })
})

describe('cloneElements', () => {
  it('assigns fresh ids and applies the offset', () => {
    const clones = cloneElements([rect('a'), rect('b')], (i) => `new-${i}`, 20, 20)
    expect(clones.map((c) => c.id)).toEqual(['new-0', 'new-1'])
    expect(clones.every((c) => c.x === 20 && c.y === 20)).toBe(true)
  })
  it('does not mutate the sources', () => {
    const source = rect('a')
    cloneElements([source], () => 'new', 5, 5)
    expect(source).toEqual(rect('a'))
  })
  it('remaps arrow bindings to the cloned shapes', () => {
    const shape = rect('shape')
    const arrow: ExcalidrawElement = {
      id: 'arrow',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 1,
      endBinding: { shapeId: 'shape' },
    }
    const clones = cloneElements([shape, arrow], (i) => `new-${i}`, 20, 20)
    expect(clones[1]).toMatchObject({ id: 'new-1', endBinding: { shapeId: 'new-0' } })
  })
  it('drops bindings to shapes outside the copied set', () => {
    const arrow: ExcalidrawElement = {
      id: 'arrow',
      type: 'arrow',
      x: 0,
      y: 0,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      strokeColor: '#000',
      background: 'transparent',
      strokeWidth: 1,
      endBinding: { shapeId: 'outside' },
    }
    const clones = cloneElements([arrow], () => 'new', 0, 0)
    expect(clones[0].type === 'arrow' && clones[0].endBinding).toBeFalsy()
  })
})
