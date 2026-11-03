import { describe, expect, it } from 'vitest'
import { addElement, createScene, getElement, removeElement, updateElement } from './scene'
import type { ExcalidrawElement } from './types'

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

describe('createScene', () => {
  it('starts empty', () => {
    expect(createScene().elements).toEqual([])
  })
})

describe('addElement', () => {
  it('appends and is retrievable by id', () => {
    const scene = addElement(createScene(), rect('a'))
    expect(scene.elements).toHaveLength(1)
    expect(getElement(scene, 'a')).toMatchObject({ id: 'a', type: 'rectangle' })
  })
  it('is immutable: the original scene is unchanged', () => {
    const original = createScene()
    const next = addElement(original, rect('a'))
    expect(original.elements).toEqual([])
    expect(next.elements).toHaveLength(1)
  })
  it('preserves insertion order', () => {
    let scene = addElement(createScene(), rect('a'))
    scene = addElement(scene, rect('b'))
    scene = addElement(scene, rect('c'))
    expect(scene.elements.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('updateElement', () => {
  it('patches fields immutably', () => {
    const base = addElement(createScene(), rect('a'))
    const next = updateElement(base, 'a', { strokeColor: '#f00', strokeWidth: 4 })
    expect(getElement(next, 'a')).toMatchObject({ strokeColor: '#f00', strokeWidth: 4 })
    expect(getElement(base, 'a')).toMatchObject({ strokeColor: '#000', strokeWidth: 1 })
  })
  it('returns the same scene for an unknown id', () => {
    const base = addElement(createScene(), rect('a'))
    expect(updateElement(base, 'nope', { strokeColor: '#f00' })).toBe(base)
  })
})

describe('removeElement', () => {
  it('removes an element', () => {
    const base = addElement(addElement(createScene(), rect('a')), rect('b'))
    const next = removeElement(base, 'a')
    expect(next.elements.map((e) => e.id)).toEqual(['b'])
  })
  it('returns the same scene for an unknown id', () => {
    const base = addElement(createScene(), rect('a'))
    expect(removeElement(base, 'nope')).toBe(base)
  })
})
