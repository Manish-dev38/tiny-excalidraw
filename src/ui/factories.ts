import { fitRect } from '../core/geometry'
import {
  DEFAULT_FONT_SIZE,
  TEXT_LINE_HEIGHT,
  textBlock,
} from '../core/textLayout'
import type {
  ArrowElement,
  ArrowheadStyle,
  ExcalidrawElement,
  PenElement,
  Point,
  RectLikeElement,
  RectLikeType,
  TextAlign,
  TextElement,
} from '../core/types'

export interface DrawStyle {
  strokeColor: string
  background: string
  strokeWidth: number
  /** Dashed stroke, used for arrows. */
  dashed: boolean
  /** Font for new text and container labels. */
  fontSize?: number
  textAlign?: TextAlign
  startArrowhead?: ArrowheadStyle | null
  endArrowhead?: ArrowheadStyle | null
}

export const DEFAULT_STYLE: DrawStyle = {
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 2,
  dashed: false,
  fontSize: DEFAULT_FONT_SIZE,
  textAlign: 'left',
  startArrowhead: null,
  endArrowhead: 'arrow',
}

function baseStyle(style: DrawStyle) {
  return {
    strokeColor: style.strokeColor,
    background: style.background,
    strokeWidth: style.strokeWidth,
  }
}

export function makeRectElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): RectLikeElement {
  const r = fitRect(start, end)
  return { id, type: 'rectangle', ...r, ...baseStyle(style) }
}

export function makeEllipseElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): RectLikeElement {
  const r = fitRect(start, end)
  return { id, type: 'ellipse', ...r, ...baseStyle(style) }
}

export function makeArrowElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): ArrowElement {
  return {
    id,
    type: 'arrow',
    points: [start, end],
    x: start.x,
    y: start.y,
    strokeColor: style.strokeColor,
    background: style.background,
    strokeWidth: style.strokeWidth,
    ...(style.dashed ? { dashed: true } : {}),
    startArrowhead: style.startArrowhead ?? null,
    endArrowhead: style.endArrowhead ?? 'arrow',
  }
}

/** Builds any box-shaped element, including infrastructure shapes. */
export function makeShapeElement(
  id: string,
  type: RectLikeType,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): RectLikeElement {
  const r = fitRect(start, end)
  return { id, type, ...r, ...baseStyle(style) }
}

export function makePenElement(
  id: string,
  points: Point[],
  style: DrawStyle = DEFAULT_STYLE,
): PenElement {
  let minX = points[0]?.x ?? 0
  let minY = points[0]?.y ?? 0
  for (const p of points) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
  }
  const el: ExcalidrawElement = {
    id,
    type: 'pen',
    points,
    x: minX,
    y: minY,
    ...baseStyle(style),
  }
  return el as PenElement
}

export function makeTextElement(
  id: string,
  at: Point,
  text: string,
  fontSize = DEFAULT_FONT_SIZE,
  style: DrawStyle = DEFAULT_STYLE,
): TextElement {
  const block = textBlock(text, fontSize, {
    maxWidth: null,
    lineHeight: TEXT_LINE_HEIGHT,
  })
  return {
    id,
    type: 'text',
    x: at.x,
    y: at.y,
    text: block.lines.join('\n'),
    originalText: text,
    width: block.width,
    height: block.height,
    fontSize,
    autoResize: true,
    textAlign: style.textAlign ?? 'left',
    verticalAlign: 'top',
    lineHeight: TEXT_LINE_HEIGHT,
    strokeColor: style.strokeColor,
    background: 'transparent',
    strokeWidth: style.strokeWidth,
  }
}
