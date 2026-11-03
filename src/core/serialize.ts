import { createScene, type Scene } from './scene'
import type { ElementType, ExcalidrawElement } from './types'

export function serializeScene(scene: Scene): string {
  return JSON.stringify(scene)
}

const ELEMENT_TYPES: ElementType[] = ['pen', 'rectangle', 'ellipse', 'arrow', 'text']

function isElement(value: unknown): value is ExcalidrawElement {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    ELEMENT_TYPES.includes(e.type as ElementType) &&
    typeof e.x === 'number' &&
    typeof e.y === 'number' &&
    typeof e.strokeColor === 'string' &&
    typeof e.strokeWidth === 'number'
  )
}

export function deserializeScene(json: string): Scene {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('Invalid scene JSON')
  }
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Invalid scene shape')
  const elements = (parsed as { elements?: unknown }).elements
  if (!Array.isArray(elements) || !elements.every(isElement)) {
    throw new Error('Invalid scene shape')
  }
  return { elements }
}

export function emptyScene(): Scene {
  return createScene()
}
