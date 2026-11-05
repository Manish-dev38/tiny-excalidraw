import { fitRect } from '../core/geometry'
import type {
  ArrowElement,
  ExcalidrawElement,
  PenElement,
  Point,
  RectLikeElement,
  TextElement,
} from '../core/types'

export interface DrawStyle {
  strokeColor: string
  background: string
  strokeWidth: number
}

export const DEFAULT_STYLE: DrawStyle = {
  strokeColor: '#000',
  background: 'transparent',
  strokeWidth: 2,
}

export function makeRectElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): RectLikeElement {
  const r = fitRect(start, end)
  return { id, type: 'rectangle', ...r, ...style }
}

export function makeEllipseElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): RectLikeElement {
  const r = fitRect(start, end)
  return { id, type: 'ellipse', ...r, ...style }
}

export function makeArrowElement(
  id: string,
  start: Point,
  end: Point,
  style: DrawStyle = DEFAULT_STYLE,
): ArrowElement {
  return { id, type: 'arrow', points: [start, end], x: start.x, y: start.y, ...style }
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
  const el: ExcalidrawElement = { id, type: 'pen', points, x: minX, y: minY, ...style }
  return el as PenElement
}

export function makeTextElement(
  id: string,
  at: Point,
  text: string,
  fontSize = 24,
  style: DrawStyle = DEFAULT_STYLE,
): TextElement {
  return {
    id,
    type: 'text',
    x: at.x,
    y: at.y,
    text,
    fontSize,
    strokeColor: style.strokeColor,
    background: 'transparent',
    strokeWidth: style.strokeWidth,
  }
}
