import { describe, expect, it } from 'vitest'
import { createHistory, pushHistory, redo, undo } from './history'
import { addElement, createScene } from './scene'
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

const s0 = createScene()
const s1 = addElement(s0, rect('a'))
const s2 = addElement(s1, rect('b'))

describe('createHistory', () => {
  it('starts with the given scene and empty stacks', () => {
    const h = createHistory(s0)
    expect(h.present).toBe(s0)
    expect(h.past).toEqual([])
    expect(h.future).toEqual([])
  })
})

describe('pushHistory', () => {
  it('records the previous present into past and advances present', () => {
    let h = createHistory(s0)
    h = pushHistory(h, s1)
    expect(h.present).toBe(s1)
    expect(h.past).toEqual([s0])
    expect(h.future).toEqual([])
  })
  it('does not record when the new scene is identical to present', () => {
    let h = createHistory(s0)
    h = pushHistory(h, s0)
    expect(h.past).toEqual([])
    expect(h.present).toBe(s0)
  })
  it('caps the past stack at the limit, dropping oldest', () => {
    let h = createHistory(s0, 2)
    h = pushHistory(h, s1)
    h = pushHistory(h, s2)
    h = pushHistory(h, addElement(s2, rect('c')))
    expect(h.past).toHaveLength(2)
    expect(h.past[0]).toBe(s1)
    expect(h.past[1]).toBe(s2)
  })
})

describe('undo', () => {
  it('steps back through recorded states', () => {
    let h = createHistory(s0)
    h = pushHistory(h, s1)
    h = pushHistory(h, s2)
    const r1 = undo(h)
    expect(r1).not.toBeNull()
    expect(r1!.scene).toBe(s1)
    expect(r1!.history.future).toEqual([s2])
    const r2 = undo(r1!.history)
    expect(r2!.scene).toBe(s0)
    expect(r2!.history.future).toEqual([s1, s2])
  })
  it('returns null when there is nothing to undo', () => {
    const h = createHistory(s0)
    expect(undo(h)).toBeNull()
  })
})

describe('redo', () => {
  it('steps forward after undoing', () => {
    let h = createHistory(s0)
    h = pushHistory(h, s1)
    h = pushHistory(h, s2)
    const undone = undo(h)!
    const redone = redo(undone.history)
    expect(redone).not.toBeNull()
    expect(redone!.scene).toBe(s2)
    expect(redone!.history.past).toEqual([s0, s1])
  })
  it('returns null when there is nothing to redo', () => {
    const h = createHistory(s0)
    expect(redo(h)).toBeNull()
  })
})

describe('branching after undo', () => {
  it('clears the future when a new state is pushed after an undo', () => {
    let h = createHistory(s0)
    h = pushHistory(h, s1)
    h = pushHistory(h, s2)
    h = undo(h)!.history
    const newState = addElement(s1, rect('c'))
    h = pushHistory(h, newState)
    expect(h.future).toEqual([])
    expect(h.past).toEqual([s0, s1])
    expect(h.present).toBe(newState)
  })
})
