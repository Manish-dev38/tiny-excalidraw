import type { Point } from '../core/types'

export interface Viewport {
  /** Screen-space translation of the scene origin, in px. */
  x: number
  y: number
  zoom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function sceneToScreen(vp: Viewport, p: Point): Point {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y }
}

export function screenToScene(vp: Viewport, p: Point): Point {
  return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom }
}

/**
 * Zoom by `factor` keeping the scene point currently under screen point `c`
 * fixed on screen.
 */
export function zoomAt(vp: Viewport, c: Point, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor)
  const k = zoom / vp.zoom
  return {
    zoom,
    x: c.x - (c.x - vp.x) * k,
    y: c.y - (c.y - vp.y) * k,
  }
}

export function panBy(vp: Viewport, dx: number, dy: number): Viewport {
  return { x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }
}
