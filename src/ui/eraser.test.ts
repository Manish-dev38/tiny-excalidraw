import { describe, expect, it } from 'vitest'
import { eraserHitTest } from './eraser'
import { addElement, createScene } from '../core/scene'
import type { ExcalidrawElement } from '../core/types'

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

describe('eraserHitTest', () => {
  it('returns ids of elements whose bounds contain an eraser point', () => {
    let scene = createScene()
    scene = addElement(scene, rect('a', 0, 0)) // covers (0..10, 0..10)
    scene = addElement(scene, rect('b', 100, 100))
    expect(eraserHitTest(scene, [{ x: 5, y: 5 }])).toEqual(['a'])
  })
  it('matches several elements with multiple points', () => {
    let scene = createScene()
    scene = addElement(scene, rect('a', 0, 0))
    scene = addElement(scene, rect('b', 100, 100))
    expect(
      eraserHitTest(scene, [
        { x: 5, y: 5 },
        { x: 105, y: 105 },
      ]),
    ).toEqual(['a', 'b'])
  })
  it('ignores disjoint elements and empty point lists', () => {
    let scene = createScene()
    scene = addElement(scene, rect('a', 0, 0))
    expect(eraserHitTest(scene, [{ x: 50, y: 50 }])).toEqual([])
    expect(eraserHitTest(scene, [])).toEqual([])
  })
})
