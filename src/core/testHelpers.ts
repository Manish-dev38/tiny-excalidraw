import { TEXT_LINE_HEIGHT, textBlock } from './textLayout'
import type { TextElement } from './types'

/** Text factory shared by tests; fills in the required round-3 metrics. */
export function textElement(
  id: string,
  overrides: Partial<TextElement> = {},
): TextElement {
  const text = overrides.originalText ?? overrides.text ?? 'hi'
  const fontSize = overrides.fontSize ?? 16
  const width = overrides.autoResize === false ? overrides.width : null
  const block = textBlock(text, fontSize, {
    maxWidth: width ?? null,
    lineHeight: TEXT_LINE_HEIGHT,
  })
  return {
    id,
    type: 'text',
    x: 0,
    y: 0,
    text: block.lines.join('\n'),
    originalText: text,
    fontSize,
    width: block.width,
    height: block.height,
    autoResize: width === null,
    textAlign: 'left',
    verticalAlign: 'top',
    lineHeight: TEXT_LINE_HEIGHT,
    strokeColor: '#000',
    background: 'transparent',
    strokeWidth: 1,
    ...overrides,
  }
}
