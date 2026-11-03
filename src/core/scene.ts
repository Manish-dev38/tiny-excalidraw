import type { ExcalidrawElement } from './types'

export interface Scene {
  elements: ExcalidrawElement[]
}

export function createScene(): Scene {
  return { elements: [] }
}

export function getElement(scene: Scene, id: string): ExcalidrawElement | undefined {
  return scene.elements.find((e) => e.id === id)
}

/** Appends an element, returning a new scene (input is unchanged). */
export function addElement(scene: Scene, element: ExcalidrawElement): Scene {
  return { elements: [...scene.elements, element] }
}

/** Patches an element by id, returning a new scene. No-op for unknown ids. */
export function updateElement(
  scene: Scene,
  id: string,
  patch: Partial<ExcalidrawElement>,
): Scene {
  const index = scene.elements.findIndex((e) => e.id === id)
  if (index === -1) return scene
  const next = [...scene.elements]
  next[index] = { ...next[index], ...patch } as ExcalidrawElement
  return { elements: next }
}

/** Removes an element by id. No-op for unknown ids. */
export function removeElement(scene: Scene, id: string): Scene {
  if (!getElement(scene, id)) return scene
  return { elements: scene.elements.filter((e) => e.id !== id) }
}
