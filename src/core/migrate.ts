import {
  isBoxShape,
  makeBinding,
  pointFromFixedPoint,
} from './binding'
import { isContainer, layoutLabel, type ContainerElement } from './containers'
import { textBlock } from './textLayout'
import type {
  ArrowBinding,
  ArrowElement,
  BindMode,
  ExcalidrawElement,
  RectLikeElement,
  TextAlign,
  TextElement,
  TextVerticalAlign,
} from './types'

type Raw = Record<string, unknown>

function isRecord(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

function textAlignOr(value: unknown, fallback: TextAlign): TextAlign {
  return value === 'left' || value === 'center' || value === 'right' ? value : fallback
}

function verticalAlignOr(value: unknown, fallback: TextVerticalAlign): TextVerticalAlign {
  return value === 'top' || value === 'middle' ? value : fallback
}

function isBindMode(value: unknown): value is BindMode {
  return value === 'inside' || value === 'orbit'
}

/** Reads the current binding shape, tolerating the v1/v2 `{ shapeId }` form. */
function readBinding(value: unknown, shapes: Map<string, RectLikeElement>): {
  binding?: ArrowBinding
  legacyShape?: RectLikeElement
} {
  if (!isRecord(value)) return {}
  if (
    typeof value.elementId === 'string' &&
    isBindMode(value.mode) &&
    Array.isArray(value.fixedPoint) &&
    value.fixedPoint.length === 2 &&
    typeof value.fixedPoint[0] === 'number' &&
    typeof value.fixedPoint[1] === 'number'
  ) {
    return {
      binding: {
        elementId: value.elementId,
        mode: value.mode,
        fixedPoint: [
          round4(value.fixedPoint[0] as number),
          round4(value.fixedPoint[1] as number),
        ],
      },
    }
  }
  if (typeof value.shapeId === 'string') {
    return { legacyShape: shapes.get(value.shapeId) }
  }
  return {}
}

/**
 * Normalizes any board version into the current element model:
 * - legacy `{ shapeId }` arrow bindings become proportional anchors
 * - text gains metrics, alignment and wrapping fields
 * - `boundElements` is rebuilt from `containerId`
 * - bound labels are re-wrapped and re-centred
 */
export function migrateElements(input: readonly unknown[]): ExcalidrawElement[] {
  const elements = input.filter(isRecord) as unknown as ExcalidrawElement[]
  const shapes = new Map<string, RectLikeElement>()
  for (const el of elements) {
    if (isBoxShape(el)) shapes.set(el.id, el)
  }
  const byId = new Map(elements.map((el) => [el.id, el]))

  // --- Arrows: normalize bindings and refresh endpoints for legacy anchors ---
  for (const el of elements) {
    if (el.type !== 'arrow') continue
    const arrow = el as ArrowElement
    const rawArrow = el as unknown as Raw
    const start = readBinding(rawArrow.startBinding, shapes)
    const end = readBinding(rawArrow.endBinding, shapes)
    let [a, b] = arrow.points

    if (start.binding) {
      arrow.startBinding = start.binding
      const shape = shapes.get(start.binding.elementId)
      if (shape) a = pointFromFixedPoint(shape, start.binding.fixedPoint)
      else delete arrow.startBinding
    } else if (start.legacyShape) {
      const binding = makeBinding(start.legacyShape, 'inside', b)
      arrow.startBinding = binding
      a = pointFromFixedPoint(start.legacyShape, binding.fixedPoint)
    } else {
      delete arrow.startBinding
    }

    if (end.binding) {
      arrow.endBinding = end.binding
      const shape = shapes.get(end.binding.elementId)
      if (shape) b = pointFromFixedPoint(shape, end.binding.fixedPoint)
      else delete arrow.endBinding
    } else if (end.legacyShape) {
      const binding = makeBinding(end.legacyShape, 'inside', a)
      arrow.endBinding = binding
      b = pointFromFixedPoint(end.legacyShape, binding.fixedPoint)
    } else {
      delete arrow.endBinding
    }

    arrow.points = [a, b]
    arrow.x = a.x
    arrow.y = a.y
    if (rawArrow.endArrowhead === undefined) {
      // Older arrows always had the classic head.
      arrow.endArrowhead = 'arrow'
    }
  }

  // --- Text: fill in the round-3 layout fields ---
  for (const el of elements) {
    if (el.type !== 'text') continue
    const text = el as TextElement
    const raw = text as unknown as Raw
    const containerId =
      typeof text.containerId === 'string' ? text.containerId : undefined
    const container = containerId ? byId.get(containerId) : undefined

    text.originalText =
      typeof text.originalText === 'string'
        ? text.originalText
        : typeof text.text === 'string'
          ? text.text
          : ''

    if (!(container && isContainer(container))) {
      delete text.containerId
      text.autoResize = typeof text.autoResize === 'boolean' ? text.autoResize : true
      text.textAlign = textAlignOr(raw.textAlign, 'left')
      text.verticalAlign = verticalAlignOr(raw.verticalAlign, 'top')
      text.lineHeight = numberOr(text.lineHeight, 1.25) || 1.25
      text.strokeWidth = numberOr(text.strokeWidth, 1)
      layoutStandalone(text)
      continue
    }

    text.containerId = container.id
    text.autoResize = false
    text.textAlign = textAlignOr(raw.textAlign, 'center')
    text.verticalAlign = verticalAlignOr(raw.verticalAlign, 'middle')
    text.lineHeight = numberOr(text.lineHeight, 1.25) || 1.25
    text.strokeWidth = numberOr(text.strokeWidth, 1)
    const layout = layoutLabel(text, container as ContainerElement)
    Object.assign(text, layout)
  }

  // --- Containers: rebuild boundElements from the labels that point at them ---
  const labels = new Map<string, string[]>()
  for (const el of elements) {
    if (el.type === 'text' && el.containerId) {
      const list = labels.get(el.containerId) ?? []
      list.push(el.id)
      labels.set(el.containerId, list)
    }
  }
  for (const el of elements) {
    if (!isContainer(el)) continue
    const ids = labels.get(el.id) ?? []
    if (ids.length === 0) {
      delete el.boundElements
    } else {
      el.boundElements = ids.map((id) => ({ type: 'text' as const, id }))
    }
  }

  return elements
}

function layoutStandalone(text: TextElement): void {
  const fontSize = numberOr(text.fontSize, 20) || 20
  text.fontSize = fontSize
  const lineHeight = text.lineHeight ?? 1.25
  const autoResize = text.autoResize ?? true
  const maxWidth =
    autoResize === false && typeof text.width === 'number' && text.width > 0
      ? text.width
      : null
  const block = textBlock(text.originalText ?? text.text ?? '', fontSize, {
    maxWidth,
    lineHeight,
  })
  text.text = block.lines.join('\n')
  text.width = block.width
  text.height = block.height
}
