import {
  bboxOf,
  dist,
  distToSegment,
  elbowRoute,
  ellipseContainsPoint,
  rectContainsPoint,
} from '../core/geometry'
import type { ExcalidrawElement, Point, RectLikeElement } from '../core/types'

export type StyleKey =
  | 'strokeColor'
  | 'background'
  | 'strokeWidth'
  | 'dashed'
  | 'fontSize'
  | 'textAlign'
  | 'startArrowhead'
  | 'endArrowhead'

/**
 * Which style properties are meaningful for an element type. Used to keep
 * batch style changes from writing meaningless fields (e.g. background on text).
 */
export function acceptsStyle(type: ExcalidrawElement['type'], key: StyleKey): boolean {
  switch (key) {
    case 'strokeColor':
      return true
    case 'strokeWidth':
      return type !== 'text'
    case 'dashed':
      return type === 'arrow'
    case 'fontSize':
    case 'textAlign':
      return type === 'text'
    case 'startArrowhead':
    case 'endArrowhead':
      return type === 'arrow'
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

function isTransparent(el: ExcalidrawElement): boolean {
  return !el.background || el.background === 'transparent'
}

/** True when `p` is within `tol` of a rectangle's outline. */
function nearRectOutline(el: RectLikeElement, p: Point, tol: number): boolean {
  const left = el.x
  const right = el.x + el.width
  const top = el.y
  const bottom = el.y + el.height
  const withinX = p.x >= left - tol && p.x <= right + tol
  const withinY = p.y >= top - tol && p.y <= bottom + tol
  if (!withinX || !withinY) return false
  return (
    Math.abs(p.x - left) <= tol ||
    Math.abs(p.x - right) <= tol ||
    Math.abs(p.y - top) <= tol ||
    Math.abs(p.y - bottom) <= tol
  )
}

/** True when `p` is within `tol` of an ellipse's outline. */
function nearEllipseOutline(el: RectLikeElement, p: Point, tol: number): boolean {
  const rx = Math.max(0.0001, el.width / 2)
  const ry = Math.max(0.0001, el.height / 2)
  const dx = (p.x - (el.x + rx)) / rx
  const dy = (p.y - (el.y + ry)) / ry
  const norm = Math.hypot(dx, dy)
  const scale = Math.max(0.0001, Math.min(rx, ry))
  return Math.abs(norm - 1) * scale <= tol
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
    case 'user': {
      // An unfilled shape is only selectable by its outline, matching
      // Excalidraw (empty shapes never swallow clicks meant for the board).
      if (isTransparent(el)) {
        return nearRectOutline(el, p, Math.max(tolerance, el.strokeWidth / 2 + 2))
      }
      return rectContainsPoint(el.x, el.y, el.width, el.height, p.x, p.y)
    }
    case 'ellipse': {
      if (isTransparent(el)) {
        return nearEllipseOutline(el, p, Math.max(tolerance, el.strokeWidth / 2 + 2))
      }
      return ellipseContainsPoint(el.x, el.y, el.width, el.height, p.x, p.y)
    }
    case 'arrow': {
      const [a, b] = el.points
      const route = elbowRoute(a, b)
      const tol = Math.max(tolerance, el.strokeWidth / 2 + 2)
      for (let i = 1; i < route.length; i++) {
        if (distToSegment(p, route[i - 1], route[i]) <= tol) return true
      }
      return false
    }
    case 'pen':
      return el.points.some((q) => dist(p, q) <= Math.max(tolerance, el.strokeWidth / 2 + 2))
    case 'text': {
      const b = bboxOf(el)
      return rectContainsPoint(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY, p.x, p.y)
    }
  }
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
