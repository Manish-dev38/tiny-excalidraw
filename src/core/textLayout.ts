/** Font stack shared by canvas, DOM editor and SVG export. */
export const TEXT_FONT_FAMILY = "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive"

/** Excalidraw-like defaults for hand-drawn text. */
export const DEFAULT_FONT_SIZE = 20
export const FONT_SIZES = [16, 20, 28, 36] as const
export const TEXT_LINE_HEIGHT = 1.25

/** Smallest width a text block can be resized to. */
export const MIN_TEXT_WIDTH = 60
/** Breathing room between a shape edge and its label. */
export const LABEL_PADDING = 8
/** Arrow labels wrap before this width, even on very long arrows. */
export const ARROW_LABEL_MAX_WIDTH = 240

/** Average glyph width fallback when there is no canvas (tests, SSR). */
const FALLBACK_CHAR_RATIO = 0.52

let measureCtx: CanvasRenderingContext2D | null | undefined

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx
  try {
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      measureCtx = document.createElement('canvas').getContext('2d')
    } else {
      measureCtx = null
    }
  } catch {
    measureCtx = null
  }
  return measureCtx
}

/**
 * Width of one line of handwriting at `fontSize`. Uses real font metrics in
 * the browser and a deterministic approximation in node/test environments.
 */
export function measureTextWidth(text: string, fontSize: number): number {
  if (!text) return 0
  const ctx = getMeasureContext()
  if (ctx) {
    ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`
    return ctx.measureText(text).width
  }
  return text.length * fontSize * FALLBACK_CHAR_RATIO
}

/**
 * Greedy word wrap. Explicit newlines are preserved; a word is never split,
 * even when it is wider than the available width.
 */
export function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = words[0]
    for (let i = 1; i < words.length; i++) {
      const candidate = `${line} ${words[i]}`
      if (measureTextWidth(candidate, fontSize) <= maxWidth) {
        line = candidate
      } else {
        lines.push(line)
        line = words[i]
      }
    }
    lines.push(line)
  }
  return lines
}

export interface TextBlock {
  /** Rendered lines, after wrapping. */
  lines: string[]
  /** Block width in scene units. */
  width: number
  /** Block height (lines × fontSize × lineHeight). */
  height: number
}

export interface TextBlockOptions {
  /** Wrap at this width; omit/null for auto-sized text. */
  maxWidth?: number | null
  /** Multiplier applied to the font size for line spacing. */
  lineHeight?: number
}

/** Lays out a run of text into lines and a bounding block. */
export function textBlock(
  text: string,
  fontSize: number,
  options: TextBlockOptions = {},
): TextBlock {
  const lineHeight = options.lineHeight ?? TEXT_LINE_HEIGHT
  const maxWidth = options.maxWidth ?? null
  const wrapping = maxWidth !== null && Number.isFinite(maxWidth)
  const source = text.length === 0 ? [''] : text.split('\n')
  const lines = wrapping ? wrapText(text, Math.max(1, maxWidth), fontSize) : source
  let measured = 0
  for (const line of lines) {
    measured = Math.max(measured, measureTextWidth(line, fontSize))
  }
  // A wrapped block keeps its wrap width (it is the resize box); auto-sized
  // text reports the width of its longest rendered line.
  const width = wrapping ? Math.max(MIN_TEXT_WIDTH, maxWidth) : measured
  return {
    lines,
    width,
    height: Math.max(1, lines.length) * fontSize * lineHeight,
  }
}

/** Width available for a label inside a container of the given width. */
export function labelMaxWidth(containerWidth: number): number {
  return Math.max(MIN_TEXT_WIDTH, Math.abs(containerWidth) - LABEL_PADDING * 2)
}

/** Width available for an arrow label, capped like Excalidraw labels. */
export function arrowLabelMaxWidth(arrowLength: number): number {
  return Math.max(MIN_TEXT_WIDTH, Math.min(ARROW_LABEL_MAX_WIDTH, arrowLength))
}

/** Font size used for a new text element or a container label. */
export function normalizeFontSize(size: number): number {
  const nearest = FONT_SIZES.reduce((best, candidate) =>
    Math.abs(candidate - size) < Math.abs(best - size) ? candidate : best,
  )
  return Number.isFinite(size) && size > 0 ? nearest : DEFAULT_FONT_SIZE
}
