import { bboxOf, rectContainsPoint } from '../core/geometry'
import type { Scene } from '../core/scene'
import type { Point } from '../core/types'

/**
 * Returns the ids of elements whose bounding box (padded by `padding`) contains
 * at least one eraser point. Results are in scene order and deduplicated.
 */
export function eraserHitTest(scene: Scene, points: Point[], padding = 0): string[] {
  if (points.length === 0) return []
  const ids: string[] = []
  for (const el of scene.elements) {
    const b = bboxOf(el)
    const hit = points.some((p) =>
      rectContainsPoint(
        b.minX - padding,
        b.minY - padding,
        b.maxX - b.minX + padding * 2,
        b.maxY - b.minY + padding * 2,
        p.x,
        p.y,
      ),
    )
    if (hit && !ids.includes(el.id)) ids.push(el.id)
  }
  return ids
}
