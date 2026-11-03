import type { Scene } from './scene'

export interface History {
  /** Previous states, most recent last. */
  past: Scene[]
  present: Scene
  /** Redo stack, least recent first. */
  future: Scene[]
  limit: number
}

const DEFAULT_LIMIT = 100

export function createHistory(present: Scene, limit: number = DEFAULT_LIMIT): History {
  return { past: [], present, future: [], limit }
}

/** Records a transition from the current present to `next` (if different). */
export function pushHistory(history: History, next: Scene): History {
  if (next === history.present) return history
  const past = [...history.past, history.present]
  if (past.length > history.limit) past.shift()
  return { past, present: next, future: [], limit: history.limit }
}

export function undo(
  history: History,
): { history: History; scene: Scene } | null {
  if (history.past.length === 0) return null
  const past = [...history.past]
  const previous = past.pop()!
  return {
    scene: previous,
    history: {
      past,
      present: previous,
      future: [history.present, ...history.future],
      limit: history.limit,
    },
  }
}

export function redo(
  history: History,
): { history: History; scene: Scene } | null {
  if (history.future.length === 0) return null
  const [next, ...future] = history.future
  return {
    scene: next,
    history: {
      past: [...history.past, history.present],
      present: next,
      future,
      limit: history.limit,
    },
  }
}
