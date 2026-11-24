import { isBoxShape } from './binding'
import { elbowRoute } from './geometry'
import type {
  ArrowElement,
  ExcalidrawElement,
  RectLikeElement,
  TextElement,
} from './types'
import {
  LABEL_PADDING,
  MIN_TEXT_WIDTH,
  TEXT_LINE_HEIGHT,
  arrowLabelMaxWidth,
  labelMaxWidth,
  measureTextWidth,
  wrapText,
} from './textLayout'

/** Elements that can own a bound text label. */
export type ContainerElement = RectLikeElement | ArrowElement

export function isContainer(el: ExcalidrawElement): el is ContainerElement {
  return isBoxShape(el) || el.type === 'arrow'
}

/** The label owned by a container, if present. */
export function boundText(
  elements: ExcalidrawElement[],
  containerId: string,
): TextElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]
    if (el.type === 'text' && el.containerId === containerId) return el
  }
  return null
}

/** The container a label belongs to, if it is still on the board. */
export function containerOf(
  elements: ExcalidrawElement[],
  text: TextElement,
): ContainerElement | null {
  if (!text.containerId) return null
  const found = elements.find((el) => el.id === text.containerId)
  return found && isContainer(found) ? found : null
}

/** Every arrow whose start or end is attached to `containerId`. */
export function boundArrows(
  elements: ExcalidrawElement[],
  containerId: string,
): ArrowElement[] {
  return elements.filter(
    (el): el is ArrowElement =>
      el.type === 'arrow' &&
      ((el.startBinding?.elementId === containerId) ||
        (el.endBinding?.elementId === containerId)),
  )
}

/** Bounding box of an arrow route, used to centre its label. */
export function arrowBBox(arrow: ArrowElement): {
  x: number
  y: number
  width: number
  height: number
} {
  const route = elbowRoute(arrow.points[0], arrow.points[1])
  let minX = route[0].x
  let minY = route[0].y
  let maxX = route[0].x
  let maxY = route[0].y
  for (const p of route.slice(1)) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/** Length of an arrow's elbow route (straight for axis-aligned drags). */
function routeLength(arrow: ArrowElement): number {
  const route = elbowRoute(arrow.points[0], arrow.points[1])
  let total = 0
  for (let i = 1; i < route.length; i++) {
    total += Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y)
  }
  return total
}

/** Width the label may occupy inside a container. */
export function containerLabelWidth(container: ContainerElement): number {
  if (container.type === 'arrow') {
    return arrowLabelMaxWidth(routeLength(container))
  }
  return labelMaxWidth(container.width)
}

export interface LabelLayout {
  text: string
  x: number
  y: number
  width: number
  height: number
  autoResize: false
}

/**
 * Wraps a label's raw text to its container and returns the text metrics plus
 * the position that keeps it centred. Containers own alignment, not position.
 */
export function layoutLabel(text: TextElement, container: ContainerElement): LabelLayout {
  const raw = text.originalText ?? text.text
  const maxWidth = containerLabelWidth(container)
  const fontSize = text.fontSize
  const lineHeight = text.lineHeight ?? TEXT_LINE_HEIGHT

  if (container.type === 'arrow') {
    const b = arrowBBox(container)
    const measured = measureTextWidth(raw.split('\n')[0] ?? '', fontSize)
    const width = Math.min(maxWidth, Math.max(MIN_TEXT_WIDTH, measured))
    const lines = wrapText(raw, width, fontSize)
    const height = Math.max(1, lines.length) * fontSize * lineHeight
    return {
      text: lines.join('\n'),
      x: b.x + (b.width - width) / 2,
      y: b.y + (b.height - height) / 2,
      width,
      height,
      autoResize: false,
    }
  }

  const lines = wrapText(raw, maxWidth, fontSize)
  const height = Math.max(1, lines.length) * fontSize * lineHeight
  return {
    text: lines.join('\n'),
    x: container.x + LABEL_PADDING,
    y: container.y + (container.height - height) / 2,
    width: maxWidth,
    height,
    autoResize: false,
  }
}

/** Rewraps and repositions a label after its container changed. */
export function reflowLabel(
  text: TextElement,
  container: ContainerElement,
): TextElement {
  const layout = layoutLabel(text, container)
  return { ...text, ...layout }
}

/** Adds/updates a text reference on a container. */
export function withBoundText(
  container: ContainerElement,
  textId: string,
): ContainerElement {
  const refs = (container.boundElements ?? []).filter(
    (ref) => !(ref.type === 'text' && ref.id === textId),
  )
  return { ...container, boundElements: [...refs, { type: 'text', id: textId }] }
}

/** Drops a text reference, removing the array once it is empty. */
export function withoutBoundText(
  container: ContainerElement,
  textId: string,
): ContainerElement {
  const refs = (container.boundElements ?? []).filter(
    (ref) => !(ref.type === 'text' && ref.id === textId),
  )
  const next: ContainerElement = { ...container }
  if (refs.length === 0) delete next.boundElements
  else next.boundElements = refs
  return next
}

/**
 * Expands a deletion set the way Excalidraw does: a container takes its label
 * with it, and a shape takes every arrow attached to it. Labels deleted on
 * their own leave the container alive.
 */
export function deletionSet(
  elements: ExcalidrawElement[],
  ids: Iterable<string>,
): Set<string> {
  const doomed = new Set(ids)
  let changed = true
  while (changed) {
    changed = false
    for (const el of elements) {
      if (el.type === 'text') {
        if (!doomed.has(el.id) && el.containerId && doomed.has(el.containerId)) {
          doomed.add(el.id)
          changed = true
        }
        continue
      }
      if (!isBoxShape(el) || !doomed.has(el.id)) continue
      for (const arrow of boundArrows(elements, el.id)) {
        if (!doomed.has(arrow.id)) {
          doomed.add(arrow.id)
          changed = true
        }
      }
    }
  }
  return doomed
}
