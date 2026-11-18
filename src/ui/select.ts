import { bboxOf, dist, rectContainsPoint } from '../core/geometry'
import type { ExcalidrawElement, Point } from '../core/types'

/**
 * Which style properties are meaningful for an element type. Used to keep
 * batch style changes from writing meaningless fields (e.g. background on text).
 */
export function acceptsStyle(
  type: ExcalidrawElement['type'],
  key: 'strokeColor' | 'background' | 'strokeWidth',
): boolean {
  switch (key) {
    case 'strokeColor':
      return true
    case 'strokeWidth':
      return type !== 'text'
    case 'background':
      return (
        type === 'rectangle' ||
        type === 'ellipse' ||
        type === 'laptop' ||
        type === 'database' ||
        type === 'server' ||
        type === 'cloud' ||
        type === 'user'
      )
  }
}

/**
 * Hit-test a single element at a scene point. Shape elements use their exact
 * filled/stroked region; pen strokes hit within a small distance of any point.
 */
export function hitTestElement(el: ExcalidrawElement, p: Point, tolerance = 8): boolean {
  switch (el.type) {
    case 'rectangle':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      return rectContainsPoint(el.x, el.y, el.width, el.height, p.x, p.y)
    case 'ellipse': {
      // Ellipse test centered on the element bounds.
      const rx = Math.max(0.0001, el.width / 2)
      const ry = Math.max(0.0001, el.height / 2)
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const dx = (p.x - cx) / rx
      const dy = (p.y - cy) / ry
      return dx * dx + dy * dy <= 1
    }
    case 'arrow': {
      const [a, b] = el.points
      return distToSegment(p, a, b) <= Math.max(tolerance, el.strokeWidth / 2 + 2)
    }
    case 'pen':
      return el.points.some((q) => dist(p, q) <= Math.max(tolerance, el.strokeWidth / 2 + 2))
    case 'text': {
      const b = bboxOf(el)
      return rectContainsPoint(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, p.x, p.y)
    }
  }
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const proj = { x: a.x + t * abx, y: a.y + t * aby }
  return dist(p, proj)
}

/** Returns a new element translated by (dx, dy); the input is unchanged. */
export function translateElement(
  el: ExcalidrawElement,
  { dx, dy }: { dx: number; dy: number },
): ExcalidrawElement {
  switch (el.type) {
    case 'pen':
      return {
        ...el,
        x: el.x + dx,
        y: el.y + dy,
        points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      }
    case 'arrow':
      return {
        ...el,
        x: el.x + dx,
        y: el.y + dy,
        points: el.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) as [
          Point,
          Point,
        ],
      }
    default:
      return { ...el, x: el.x + dx, y: el.y + dy }
  }
}

/** Returns the topmost (last-drawn) element containing `p`. */
export function hitTestTop(
  elements: ExcalidrawElement[],
  p: Point,
  tolerance = 8,
): ExcalidrawElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    if (hitTestElement(elements[i], p, tolerance)) return elements[i]
  }
  return null
}

/** True when two rectangles overlap (touching edges count). */
export function rectsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

/**
 * Elements whose bounds intersect the marquee rect (any corner order).
 * Selection keeps scene order so z-index is preserved on group ops.
 */
export function elementsInRect(
  elements: ExcalidrawElement[],
  a: Point,
  b: Point,
): ExcalidrawElement[] {
  const rect = {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  }
  return elements.filter((el) => {
    const bb = bboxOf(el)
    return rectsIntersect(rect, bb)
  })
}
