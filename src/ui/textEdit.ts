import type { Op } from '../core/history'
import { TEXT_LINE_HEIGHT, textBlock } from '../core/textLayout'
import type { TextElement } from '../core/types'

export interface TextEditOptions {
  /**
   * Wrap width for the edited text. Container labels pass the label width;
   * omitted means "keep the element's current resize mode".
   */
  maxWidth?: number | null
}

/**
 * Decides what an inline text edit does to the existing element:
 * - empty text removes the element
 * - unchanged text is a no-op
 * - anything else updates the text, re-wraps it, and refreshes metrics
 */
export function textEditOp(
  existing: TextElement,
  text: string,
  options: TextEditOptions = {},
): Op | null {
  const nextRaw = text.trim()
  if (!nextRaw) return { type: 'remove', element: existing }
  const previousRaw = existing.originalText ?? existing.text
  if (nextRaw === previousRaw) return null

  const maxWidth =
    options.maxWidth !== undefined
      ? options.maxWidth
      : existing.containerId
        ? existing.width
        : existing.autoResize
          ? null
          : existing.width
  const block = textBlock(nextRaw, existing.fontSize, {
    maxWidth,
    lineHeight: existing.lineHeight ?? TEXT_LINE_HEIGHT,
  })
  const width = maxWidth !== null ? Math.max(maxWidth, 0) : block.width
  const next = {
    text: block.lines.join('\n'),
    originalText: nextRaw,
    width,
    height: block.height,
    autoResize: maxWidth === null,
  }
  return {
    type: 'update',
    id: existing.id,
    prev: {
      text: existing.text,
      originalText: existing.originalText,
      width: existing.width,
      height: existing.height,
      autoResize: existing.autoResize,
    },
    next,
  }
}
