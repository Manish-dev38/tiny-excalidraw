import type { Scene } from './scene'
import { addElement, removeElement, updateElement } from './scene'
import type { ExcalidrawElement } from './types'

export type Op =
  | { type: 'add'; element: ExcalidrawElement }
  | { type: 'remove'; element: ExcalidrawElement }
  | { type: 'update'; id: string; prev: Partial<ExcalidrawElement>; next: Partial<ExcalidrawElement> }

export interface History {
  past: Op[]
  future: Op[]
  limit: number
}

const DEFAULT_LIMIT = 100

export function createHistory(limit: number = DEFAULT_LIMIT): History {
  return { past: [], future: [], limit }
}

export function applyOp(scene: Scene, op: Op): Scene {
  switch (op.type) {
    case 'add':
      return addElement(scene, op.element)
    case 'remove':
      return removeElement(scene, op.element.id)
    case 'update':
      return updateElement(scene, op.id, op.next)
  }
}

export function invertOp(op: Op): Op {
  switch (op.type) {
    case 'add':
      return { type: 'remove', element: op.element }
    case 'remove':
      return { type: 'add', element: op.element }
    case 'update':
      return { type: 'update', id: op.id, prev: op.next, next: op.prev }
  }
}

/** Records a forward op (the change just applied) for potential undo. */
export function record(history: History, op: Op): History {
  const past = [...history.past, op]
  if (past.length > history.limit) past.shift()
  return { past, future: [], limit: history.limit }
}

/** Returns the inverse op to apply/broadcast to undo the last recorded action. */
export function undo(history: History): { history: History; op: Op } | null {
  if (history.past.length === 0) return null
  const past = [...history.past]
  const op = past.pop()!
  return {
    op: invertOp(op),
    history: { past, future: [op, ...history.future], limit: history.limit },
  }
}

/** Returns the forward op to reapply and redo a previously undone action. */
export function redo(history: History): { history: History; op: Op } | null {
  if (history.future.length === 0) return null
  const [op, ...future] = history.future
  return {
    op,
    history: { past: [...history.past, op], future, limit: history.limit },
  }
}
