import type { ExcalidrawElement, Point } from './types'

export function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
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
export const LINE_HEIGHT = 1.2

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
      const lines = el.text.split('\n')
      const longest = lines.reduce((n, line) => Math.max(n, line.length), 0)
      minX = el.x
      minY = el.y
      maxX = el.x + longest * el.fontSize * 0.55
      maxY = el.y + lines.length * el.fontSize * LINE_HEIGHT
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
