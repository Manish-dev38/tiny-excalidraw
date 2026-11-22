import { describe, expect, it } from 'vitest'
import { deserializeScene, serializeScene } from './serialize'
import { addElement, createScene } from './scene'
import type { ExcalidrawElement } from './types'

const rect = (id: string): ExcalidrawElement => ({
  id,
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 30,
  height: 40,
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 1,
})

describe('serializeScene / deserializeScene', () => {
  it('round-trips a scene losslessly', () => {
    const scene = addElement(addElement(createScene(), rect('a')), rect('b'))
    const restored = deserializeScene(serializeScene(scene))
    expect(restored.elements).toEqual(scene.elements)
  })
  it('round-trips a pen element with its points', () => {
    const pen: ExcalidrawElement = {
      id: 'p1',
      type: 'pen',
      x: 0,
      y: 0,
      points: [
        { x: 1, y: 2 },
        { x: 3, y: 4 },
      ],
      strokeColor: '#0af',
      background: 'transparent',
      strokeWidth: 2,
    }
    const restored = deserializeScene(serializeScene(addElement(createScene(), pen)))
    expect(restored.elements[0]).toEqual(pen)
  })
  it('round-trips infrastructure shapes (autosave restore path)', () => {
    const server: ExcalidrawElement = {
      id: 's1',
      type: 'server',
      x: 5,
      y: 6,
      width: 70,
      height: 90,
      strokeColor: '#000',
      background: '#ffec99',
      strokeWidth: 2,
    }
    const restored = deserializeScene(serializeScene(addElement(createScene(), server)))
    expect(restored.elements[0]).toEqual(server)
  })
  it('throws on invalid JSON', () => {
    expect(() => deserializeScene('not json')).toThrow()
  })
  it('throws when the shape is not a valid scene', () => {
    expect(() => deserializeScene(JSON.stringify({ elements: 'nope' }))).toThrow()
  })
})
