import { bboxOf } from './geometry'
import type { ArrowElement, ExcalidrawElement, Point, RectLikeElement } from './types'

/** How far outside a shape an arrow end still snaps to it (scene units). */
export const ATTACH_PADDING = 10

const BOX_SHAPES = new Set(['rectangle', 'ellipse', 'laptop', 'database', 'server', 'cloud', 'user'])

export function isBoxShape(el: ExcalidrawElement): el is RectLikeElement {
  return BOX_SHAPES.has(el.type)
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01
}

/**
 * Midpoint of the shape side facing `toward`. Edge midpoints keep connectors
 * tidy and deterministic, like hand-drawn architecture diagrams.
 */
export function shapeAnchor(shape: RectLikeElement, toward: Point): Point {
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  const w = Math.max(1, Math.abs(shape.width))
  const h = Math.max(1, Math.abs(shape.height))
  if (Math.abs(dx) / w >= Math.abs(dy) / h) {
    return dx >= 0
      ? { x: shape.x + shape.width, y: cy }
      : { x: shape.x, y: cy }
  }
  return dy >= 0
    ? { x: cx, y: shape.y + shape.height }
    : { x: cx, y: shape.y }
}

/** Topmost shape whose padded bounds contain `p`. */
export function findAttachShape(
  elements: ExcalidrawElement[],
  p: Point,
): RectLikeElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!isBoxShape(el)) continue
    const b = bboxOf(el)
    if (
      p.x >= b.minX - ATTACH_PADDING &&
      p.x <= b.maxX + ATTACH_PADDING &&
      p.y >= b.minY - ATTACH_PADDING &&
      p.y <= b.maxY + ATTACH_PADDING
    ) {
      return el
    }
  }
  return null
}

/**
 * Binds arrow ends that land on shapes and snaps those ends to the facing
 * side midpoints. Arrows drawn in open space are returned unchanged.
 */
export function bindArrowEnds(
  arrow: ArrowElement,
  elements: ExcalidrawElement[],
): ArrowElement {
  const startShape = findAttachShape(elements, arrow.points[0])
  const endShape = findAttachShape(elements, arrow.points[1])
  if (!startShape && !endShape) return arrow
  let a = arrow.points[0]
  let b = arrow.points[1]
  if (startShape) a = shapeAnchor(startShape, b)
  if (endShape) b = shapeAnchor(endShape, a)
  return {
    ...arrow,
    x: a.x,
    y: a.y,
    points: [a, b],
    ...(startShape ? { startBinding: { shapeId: startShape.id } } : {}),
    ...(endShape ? { endBinding: { shapeId: endShape.id } } : {}),
  }
}

/**
 * Recomputes a bound arrow's endpoints against moved shapes. Returns null when
 * nothing changed. Shapes that are not in the map (e.g. untouched, or deleted)
 * keep their stored endpoints.
 */
export function resnapArrow(
  arrow: ArrowElement,
  shapes: ReadonlyMap<string, RectLikeElement>,
): ArrowElement | null {
  const a = arrow.points[0]
  const b = arrow.points[1]
  let na = a
  let nb = b
  const startShape = arrow.startBinding ? shapes.get(arrow.startBinding.shapeId) : undefined
  const endShape = arrow.endBinding ? shapes.get(arrow.endBinding.shapeId) : undefined
  if (startShape) na = shapeAnchor(startShape, nb)
  if (endShape) nb = shapeAnchor(endShape, na)
  if (samePoint(na, a) && samePoint(nb, b)) return null
  return { ...arrow, x: na.x, y: na.y, points: [na, nb] }
}

/** Removes both attachments; used when the arrow itself is moved. */
export function clearArrowBindings(arrow: ArrowElement): ArrowElement {
  const next: ArrowElement = { ...arrow }
  delete next.startBinding
  delete next.endBinding
  return next
}

/** Clears bindings that reference a removed shape; endpoints stay put. */
export function detachRemoved(
  arrow: ArrowElement,
  removedIds: ReadonlySet<string>,
): ArrowElement | null {
  const dropStart = !!arrow.startBinding && removedIds.has(arrow.startBinding.shapeId)
  const dropEnd = !!arrow.endBinding && removedIds.has(arrow.endBinding.shapeId)
  if (!dropStart && !dropEnd) return null
  const next: ArrowElement = { ...arrow }
  if (dropStart) delete next.startBinding
  if (dropEnd) delete next.endBinding
  return next
}

/**
 * Rewrites bindings through an id map (used by copy/paste and duplicate).
 * Bindings to shapes outside the copied set are dropped: the clone should not
 * silently attach to an unrelated original.
 */
export function remapArrowBindings(
  arrow: ArrowElement,
  idMap: ReadonlyMap<string, string>,
): ArrowElement {
  const next: ArrowElement = { ...arrow }
  if (arrow.startBinding) {
    const mapped = idMap.get(arrow.startBinding.shapeId)
    if (mapped) next.startBinding = { shapeId: mapped }
    else delete next.startBinding
  }
  if (arrow.endBinding) {
    const mapped = idMap.get(arrow.endBinding.shapeId)
    if (mapped) next.endBinding = { shapeId: mapped }
    else delete next.endBinding
  }
  return next
}
