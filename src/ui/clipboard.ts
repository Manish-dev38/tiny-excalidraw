import type { ExcalidrawElement } from '../core/types'
import { remapArrowBindings } from '../core/binding'
import { translateElement } from './select'

/**
 * Internal clipboard: copy/paste within the app and across board tabs of the
 * same browser (localStorage is shared per origin). External paste from other
 * apps is out of scope.
 */

export interface ClipboardBackend {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface ClipboardStore {
  write(elements: ExcalidrawElement[]): void
  read(): ExcalidrawElement[]
}

const KEY = 'tiny-clipboard'

/** localStorage guarded for non-browser test environments. */
export function safeLocalStorage(): ClipboardBackend | null {
  try {
    const s = (globalThis as { localStorage?: ClipboardBackend }).localStorage
    return s ?? null
  } catch {
    return null
  }
}

function isElementish(value: unknown): value is ExcalidrawElement {
  return typeof value === 'object' && value !== null && 'id' in value && 'type' in value
}

export function createClipboardStore(backend: ClipboardBackend | null): ClipboardStore {
  return {
    write(elements: ExcalidrawElement[]): void {
      if (elements.length === 0) return
      try {
        backend?.setItem(KEY, JSON.stringify(elements))
      } catch {
        // Quota exceeded or storage blocked: the copy is simply lost.
      }
    },
    read(): ExcalidrawElement[] {
      try {
        const raw = backend?.getItem(KEY)
        if (!raw) return []
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(isElementish)
      } catch {
        return []
      }
    },
  }
}

/** Shared store used by the canvas. */
export const clipboard = createClipboardStore(safeLocalStorage())

/**
 * Deep-clones elements with fresh ids and a positional offset. The source
 * elements are never mutated. Arrow attachments are remapped to cloned shapes;
 * attachments to shapes outside the copied set are dropped.
 */
export function cloneElements(
  elements: ExcalidrawElement[],
  idFor: (index: number) => string,
  dx: number,
  dy: number,
): ExcalidrawElement[] {
  const idMap = new Map<string, string>()
  elements.forEach((el, i) => idMap.set(el.id, idFor(i)))
  return elements.map((el) => {
    const clone = translateElement({ ...el, id: idMap.get(el.id)! }, { dx, dy })
    return clone.type === 'arrow' ? remapArrowBindings(clone, idMap) : clone
  })
}
