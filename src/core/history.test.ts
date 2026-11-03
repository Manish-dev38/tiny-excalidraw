import { describe, expect, it } from 'vitest'
import {
  applyOp,
  createHistory,
  invertOp,
  redo,
  record,
  undo,
  type Op,
} from './history'
import { addElement, createScene, getElement } from './scene'
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

describe('createHistory', () => {
  it('starts empty', () => {
    expect(createHistory()).toEqual({ past: [], future: [], limit: 100 })
  })
})

describe('applyOp', () => {
  it('applies add, update, and remove ops', () => {
    let scene = createScene()
    scene = applyOp(scene, { type: 'add', element: rect('a') })
    expect(getElement(scene, 'a')).toBeDefined()
    scene = applyOp(scene, { type: 'update', id: 'a', prev: { x: 0 }, next: { x: 5 } })
    expect(getElement(scene, 'a')).toMatchObject({ x: 5 })
    scene = applyOp(scene, { type: 'remove', element: rect('a') })
    expect(getElement(scene, 'a')).toBeUndefined()
  })
})

describe('invertOp', () => {
  it('inverts an add into a remove', () => {
    const op: Op = { type: 'add', element: rect('a') }
    expect(invertOp(op)).toEqual({ type: 'remove', element: rect('a') })
  })
  it('inverts a remove into an add', () => {
    const op: Op = { type: 'remove', element: rect('a') }
    expect(invertOp(op)).toEqual({ type: 'add', element: rect('a') })
  })
  it('swaps prev and next on an update', () => {
    const op: Op = { type: 'update', id: 'a', prev: { x: 0 }, next: { x: 5 } }
    expect(invertOp(op)).toEqual({ type: 'update', id: 'a', prev: { x: 5 }, next: { x: 0 } })
  })
})

describe('record / undo / redo', () => {
  it('undo returns the inverse of the last recorded op', () => {
    let h = createHistory()
    h = record(h, { type: 'add', element: rect('a') })
    const r = undo(h)
    expect(r).not.toBeNull()
    expect(r!.op).toEqual({ type: 'remove', element: rect('a') })
    expect(r!.history.future).toHaveLength(1)
  })
  it('redo replays the forward op', () => {
    let h = createHistory()
    h = record(h, { type: 'add', element: rect('a') })
    const undone = undo(h)!
    const redone = redo(undone.history)
    expect(redone).not.toBeNull()
    expect(redone!.op).toEqual({ type: 'add', element: rect('a') })
    expect(redone!.history.past).toHaveLength(1)
  })
  it('returns null when there is nothing to undo/redo', () => {
    expect(undo(createHistory())).toBeNull()
    expect(redo(createHistory())).toBeNull()
  })
  it('clears future when a new op is recorded after an undo', () => {
    let h = createHistory()
    h = record(h, { type: 'add', element: rect('a') })
    h = undo(h)!.history
    h = record(h, { type: 'add', element: rect('b') })
    expect(h.future).toEqual([])
    expect(h.past).toHaveLength(1)
    expect(h.past[0]).toMatchObject({ type: 'add' })
  })
  it('caps past at the limit', () => {
    let h = createHistory(2)
    for (let i = 0; i < 5; i++) {
      h = record(h, { type: 'add', element: rect(`e${i}`) })
    }
    expect(h.past).toHaveLength(2)
  })
})

describe('round-trip through applyOp', () => {
  it('undo then redo restores the scene', () => {
    let scene = addElement(createScene(), rect('a'))
    let h = createHistory()
    h = record(h, { type: 'remove', element: rect('a') })
    scene = applyOp(scene, { type: 'remove', element: rect('a') })
    expect(getElement(scene, 'a')).toBeUndefined()

    const undone = undo(h)!
    scene = applyOp(scene, undone.op)
    expect(getElement(scene, 'a')).toBeDefined()
  })
})
