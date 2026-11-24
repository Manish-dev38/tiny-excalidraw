import { TEXT_LINE_HEIGHT, textBlock } from './textLayout'
import type { ExcalidrawElement, Point } from './types'

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** Distance from a point to a line segment. */
export function distToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const proj = { x: a.x + t * abx, y: a.y + t * aby }
  return dist(p, proj)
}

/** Minimum straight distance for an elbow to be worth drawing (scene units). */
const MIN_ELBOW = 2

/**
 * Orthogonal (elbow) route between two points, like architecture sketches:
 * two runs joined by a mid jog on the dominant axis. Degenerate drags (nearly
 * horizontal or vertical) stay straight, which is just a collapsed elbow.
 *
 * The route always stays inside the endpoints' bounding box, so element
 * bounds and hit-testing can keep using the two stored points.
 */
export function elbowRoute(a: Point, b: Point): Point[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < MIN_ELBOW || Math.abs(dy) < MIN_ELBOW) {
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }]
  }
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = a.x + dx / 2
    return [
      { x: a.x, y: a.y },
      { x: mx, y: a.y },
      { x: mx, y: b.y },
      { x: b.x, y: b.y },
    ]
  }
  const my = a.y + dy / 2
  return [
    { x: a.x, y: a.y },
    { x: a.x, y: my },
    { x: b.x, y: my },
    { x: b.x, y: b.y },
  ]
}

/** Trace an orthogonal route into the current path. */
export function traceRoute(ctx: CanvasRenderingContext2D, route: Point[]): void {
  if (route.length === 0) return
  ctx.moveTo(route[0].x, route[0].y)
  for (let i = 1; i < route.length; i++) ctx.lineTo(route[i].x, route[i].y)
}

export function rectContainsPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  px: number,
  py: number,
): boolean {
  return px >= x && px <= x + width && py >= y && py <= y + height
}

export function ellipseContainsPoint(
  x: number,
  y: number,
  width: number,
  height: number,
  px: number,
  py: number,
): boolean {
  const rx = width / 2
  const ry = height / 2
  const cx = x + rx
  const cy = y + ry
  const dx = (px - cx) / rx
  const dy = (py - cy) / ry
  return dx * dx + dy * dy <= 1
}

export function fitRect(
  a: Point,
  b: Point,
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  }
}

export interface BBox {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Line height multiplier shared by canvas rendering, bounds and SVG export. */
export const LINE_HEIGHT = TEXT_LINE_HEIGHT

export function bboxOf(el: ExcalidrawElement): BBox {
  const pad = el.strokeWidth / 2
  let minX: number
  let minY: number
  let maxX: number
  let maxY: number

  switch (el.type) {
    case 'pen': {
      let lx = el.points[0]?.x ?? el.x
      let ly = el.points[0]?.y ?? el.y
      let hx = lx
      let hy = ly
      for (const p of el.points) {
        lx = Math.min(lx, p.x)
        ly = Math.min(ly, p.y)
        hx = Math.max(hx, p.x)
        hy = Math.max(hy, p.y)
      }
      minX = lx
      minY = ly
      maxX = hx
      maxY = hy
      break
    }
    case 'rectangle':
    case 'ellipse':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      minX = el.x
      minY = el.y
      maxX = el.x + el.width
      maxY = el.y + el.height
      break
    case 'arrow':
      minX = Math.min(el.points[0].x, el.points[1].x)
      minY = Math.min(el.points[0].y, el.points[1].y)
      maxX = Math.max(el.points[0].x, el.points[1].x)
      maxY = Math.max(el.points[0].y, el.points[1].y)
      break
    case 'text': {
      // Text elements carry their own laid-out metrics; fall back to a fresh
      // layout for legacy objects that predate the round-3 fields.
      const width =
        typeof el.width === 'number' && Number.isFinite(el.width)
          ? el.width
          : textBlock(el.text, el.fontSize, {
              maxWidth: el.autoResize === false ? el.width : null,
            }).width
      const height =
        typeof el.height === 'number' && Number.isFinite(el.height)
          ? el.height
          : textBlock(el.text, el.fontSize, { lineHeight: el.lineHeight }).height
      minX = el.x
      minY = el.y
      maxX = el.x + width
      maxY = el.y + height
      break
    }
  }

  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

export function shapesOverlap(a: ExcalidrawElement, b: ExcalidrawElement): boolean {
  const ba = bboxOf(a)
  const bb = bboxOf(b)
  return !(
    ba.maxX < bb.minX ||
    bb.maxX < ba.minX ||
    ba.maxY < bb.minY ||
    bb.maxY < ba.minY
  )
}
