import type {
  ArrowBinding,
  ArrowElement,
  BindMode,
  ExcalidrawElement,
  Point,
  RectLikeElement,
} from './types'

/** An arrow end dropped within this distance of a shape binds to it (scene units). */
export const ATTACH_DISTANCE = 24

/** Visual breathing room between an arrow endpoint and its shape. */
export const ARROW_GAP = 6

const BOX_SHAPES = new Set([
  'rectangle',
  'ellipse',
  'laptop',
  'database',
  'server',
  'cloud',
  'user',
])

export function isBoxShape(el: ExcalidrawElement): el is RectLikeElement {
  return BOX_SHAPES.has(el.type)
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

/** True when `p` lies inside the shape's un-stroked box. */
export function insideShape(shape: RectLikeElement, p: Point): boolean {
  return (
    p.x >= shape.x &&
    p.x <= shape.x + shape.width &&
    p.y >= shape.y &&
    p.y <= shape.y + shape.height
  )
}

/** Straight-line distance from `p` to the shape's border (0 when inside). */
export function distanceToBorder(shape: RectLikeElement, p: Point): number {
  const dx = Math.max(shape.x - p.x, 0, p.x - (shape.x + shape.width))
  const dy = Math.max(shape.y - p.y, 0, p.y - (shape.y + shape.height))
  if (dx === 0 && dy === 0) return 0
  return Math.hypot(dx, dy)
}

/**
 * Topmost box shape that a dropped arrow end should bind to. Points inside a
 * shape use `inside`; points within `ATTACH_DISTANCE` use `orbit`.
 */
export function findBindShape(
  elements: ExcalidrawElement[],
  p: Point,
  exclude?: ReadonlySet<string>,
): { shape: RectLikeElement; mode: BindMode } | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!isBoxShape(el) || exclude?.has(el.id)) continue
    if (insideShape(el, p)) return { shape: el, mode: 'inside' }
  }

  let best: { shape: RectLikeElement; mode: BindMode; distance: number } | null = null
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (!isBoxShape(el) || exclude?.has(el.id)) continue
    const distance = distanceToBorder(el, p)
    if (distance <= ATTACH_DISTANCE && (!best || distance < best.distance)) {
      best = { shape: el, mode: 'orbit', distance }
    }
  }
  return best ? { shape: best.shape, mode: best.mode } : null
}

/**
 * Midpoint of the side facing `toward`, pushed `ARROW_GAP` outside the shape.
 * Used when the arrow was dropped inside the shape.
 */
export function facingAnchor(shape: RectLikeElement, toward: Point): Point {
  const cx = shape.x + shape.width / 2
  const cy = shape.y + shape.height / 2
  const dx = toward.x - cx
  const dy = toward.y - cy
  const w = Math.max(1, Math.abs(shape.width))
  const h = Math.max(1, Math.abs(shape.height))

  if (Math.abs(dx) / w >= Math.abs(dy) / h) {
    const sign = dx >= 0 ? 1 : -1
    return {
      x: shape.x + (sign > 0 ? shape.width : 0) + sign * ARROW_GAP,
      y: cy,
    }
  }
  const sign = dy >= 0 ? 1 : -1
  return {
    x: cx,
    y: shape.y + (sign > 0 ? shape.height : 0) + sign * ARROW_GAP,
  }
}

/**
 * Nearest point on the shape's border to `toward`, pushed `ARROW_GAP` outward.
 * Used when the arrow end orbits the shape from outside.
 */
export function borderAnchor(shape: RectLikeElement, toward: Point): Point {
  const left = shape.x
  const right = shape.x + shape.width
  const top = shape.y
  const bottom = shape.y + shape.height
  const px = Math.min(right, Math.max(left, toward.x))
  const py = Math.min(bottom, Math.max(top, toward.y))

  const overshoot = [
    { side: 'left' as const, amount: left - toward.x },
    { side: 'right' as const, amount: toward.x - right },
    { side: 'top' as const, amount: top - toward.y },
    { side: 'bottom' as const, amount: toward.y - bottom },
  ]
  overshoot.sort((a, b) => b.amount - a.amount)
  const side = overshoot[0].amount > 0 ? overshoot[0].side : nearestSide(shape, toward)

  switch (side) {
    case 'left':
      return { x: left - ARROW_GAP, y: py }
    case 'right':
      return { x: right + ARROW_GAP, y: py }
    case 'top':
      return { x: px, y: top - ARROW_GAP }
    case 'bottom':
      return { x: px, y: bottom + ARROW_GAP }
  }
}

function nearestSide(shape: RectLikeElement, p: Point): 'left' | 'right' | 'top' | 'bottom' {
  const distances = [
    { side: 'left' as const, amount: Math.abs(p.x - shape.x) },
    { side: 'right' as const, amount: Math.abs(p.x - (shape.x + shape.width)) },
    { side: 'top' as const, amount: Math.abs(p.y - shape.y) },
    { side: 'bottom' as const, amount: Math.abs(p.y - (shape.y + shape.height)) },
  ]
  distances.sort((a, b) => a.amount - b.amount)
  return distances[0].side
}

/** Anchor for an arrow end, depending on how it attached. */
export function anchorFor(
  shape: RectLikeElement,
  mode: BindMode,
  toward: Point,
): Point {
  return mode === 'inside' ? facingAnchor(shape, toward) : borderAnchor(shape, toward)
}

/** Normalized `[nx, ny]` position of a scene point inside a shape's box. */
export function fixedPoint(
  shape: RectLikeElement,
  point: Point,
): [number, number] {
  const w = shape.width === 0 ? 1 : shape.width
  const h = shape.height === 0 ? 1 : shape.height
  return [round4((point.x - shape.x) / w), round4((point.y - shape.y) / h)]
}

/** Scene position of a stored normalized point. */
export function pointFromFixedPoint(
  shape: RectLikeElement,
  fp: readonly [number, number],
): Point {
  return { x: shape.x + fp[0] * shape.width, y: shape.y + fp[1] * shape.height }
}

export function makeBinding(
  shape: RectLikeElement,
  mode: BindMode,
  toward: Point,
): ArrowBinding {
  const anchor = anchorFor(shape, mode, toward)
  return { elementId: shape.id, mode, fixedPoint: fixedPoint(shape, anchor) }
}

/**
 * Binds arrow ends that land on or near shapes. Inside drops snap to the
 * facing edge midpoint; near misses orbit the nearest border point. Both keep
 * a small gap so the line never touches the stroke.
 */
export function bindArrowEnds(
  arrow: ArrowElement,
  elements: ExcalidrawElement[],
): ArrowElement {
  const [a, b] = arrow.points
  const start = findBindShape(elements, a)
  const end = findBindShape(elements, b)
  if (!start && !end) return arrow

  const next: ArrowElement = {
    ...arrow,
    x: a.x,
    y: a.y,
    points: [a, b],
  }
  delete next.startBinding
  delete next.endBinding

  if (start) {
    const binding = makeBinding(start.shape, start.mode, b)
    next.startBinding = binding
    next.points[0] = pointFromFixedPoint(start.shape, binding.fixedPoint)
  }
  if (end) {
    const binding = makeBinding(end.shape, end.mode, start ? next.points[0] : a)
    next.endBinding = binding
    next.points[1] = pointFromFixedPoint(end.shape, binding.fixedPoint)
  }
  next.x = next.points[0].x
  next.y = next.points[0].y
  return next
}

/**
 * Recomputes a bound arrow's endpoints from its stored normalized anchors.
 * Returns null when nothing changed. Missing shapes keep their stored endpoint.
 */
export function resnapArrow(
  arrow: ArrowElement,
  shapes: ReadonlyMap<string, RectLikeElement>,
): ArrowElement | null {
  const [a, b] = arrow.points
  let na = a
  let nb = b
  if (arrow.startBinding) {
    const shape = shapes.get(arrow.startBinding.elementId)
    if (shape) na = pointFromFixedPoint(shape, arrow.startBinding.fixedPoint)
  }
  if (arrow.endBinding) {
    const shape = shapes.get(arrow.endBinding.elementId)
    if (shape) nb = pointFromFixedPoint(shape, arrow.endBinding.fixedPoint)
  }
  if (samePoint(na, a) && samePoint(nb, b)) return null
  return { ...arrow, x: na.x, y: na.y, points: [na, nb] }
}

function samePoint(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01
}

/** Removes both attachments; used when an arrow is moved on its own. */
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
  const dropStart = !!arrow.startBinding && removedIds.has(arrow.startBinding.elementId)
  const dropEnd = !!arrow.endBinding && removedIds.has(arrow.endBinding.elementId)
  if (!dropStart && !dropEnd) return null
  const next: ArrowElement = { ...arrow }
  if (dropStart) delete next.startBinding
  if (dropEnd) delete next.endBinding
  return next
}

/**
 * Rewrites bindings through an id map (copy/paste and duplicate).
 * Bindings outside the copied set are dropped so clones never attach to an
 * unrelated original.
 */
export function remapArrowBindings(
  arrow: ArrowElement,
  idMap: ReadonlyMap<string, string>,
): ArrowElement {
  const next: ArrowElement = { ...arrow }
  if (arrow.startBinding) {
    const mapped = idMap.get(arrow.startBinding.elementId)
    if (mapped) next.startBinding = { ...arrow.startBinding, elementId: mapped }
    else delete next.startBinding
  }
  if (arrow.endBinding) {
    const mapped = idMap.get(arrow.endBinding.elementId)
    if (mapped) next.endBinding = { ...arrow.endBinding, elementId: mapped }
    else delete next.endBinding
  }
  return next
}

