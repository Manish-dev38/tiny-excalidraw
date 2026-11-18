import type { Op } from '../core/history'
import type { TextElement } from '../core/types'

/**
 * Decides what an inline text edit does to the existing element:
 * - empty text removes the element
 * - unchanged text is a no-op
 * - anything else updates the text (undoable, syncable)
 */
export function textEditOp(existing: TextElement, text: string): Op | null {
  const next = text.trim()
  if (!next) return { type: 'remove', element: existing }
  if (next === existing.text) return null
  return {
    type: 'update',
    id: existing.id,
    prev: { text: existing.text },
    next: { text: next },
  }
}
