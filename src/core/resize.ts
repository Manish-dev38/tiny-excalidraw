import type { BBox } from './geometry'
import { MIN_TEXT_WIDTH, TEXT_LINE_HEIGHT, textBlock } from './textLayout'
import type { ExcalidrawElement, PenElement, TextElement } from './types'

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface HandlePoint {
  handle: ResizeHandle
  x: number
  y: number
  cursor: string
}

/** Drawn handle size in screen pixels. */
export const HANDLE_SIZE = 8
/** Extra grab area around a handle, in screen pixels. */
export const HANDLE_HIT_SLOP = 10
/** Smallest box a resize may produce (scene units). */
export const MIN_SIZE = 12

const CURSORS: Record<ResizeHandle, string> = {
  nw: 'nwse-resize',
  n: 'ns-resize',
  ne: 'nesw-resize',
  e: 'ew-resize',
  se: 'nwse-resize',
  s: 'ns-resize',
  sw: 'nesw-resize',
  w: 'ew-resize',
}

export function boxFromBBox(b: BBox): Box {
  return { x: b.minX, y: b.minY, width: b.maxX - b.minX, height: b.maxY - b.minY }
}

/** Tight geometry box for an element, ignoring stroke padding. */
export function elementBox(el: ExcalidrawElement): Box {
  switch (el.type) {
    case 'text':
      return { x: el.x, y: el.y, width: el.width, height: el.height }
    case 'pen': {
      const xs = el.points.map((p) => p.x)
      const ys = el.points.map((p) => p.y)
      const minX = xs.length ? Math.min(...xs) : el.x
      const minY = ys.length ? Math.min(...ys) : el.y
      return {
        x: minX,
        y: minY,
        width: (xs.length ? Math.max(...xs) : minX) - minX,
        height: (ys.length ? Math.max(...ys) : minY) - minY,
      }
    }
    case 'arrow':
      return {
        x: Math.min(el.points[0].x, el.points[1].x),
        y: Math.min(el.points[0].y, el.points[1].y),
        width: Math.abs(el.points[1].x - el.points[0].x),
        height: Math.abs(el.points[1].y - el.points[0].y),
      }
    default:
      return { x: el.x, y: el.y, width: el.width, height: el.height }
  }
}

/** Bounding box used to place selection handles. Text hugs its own block. */
export function selectionBox(elements: ExcalidrawElement[]): Box {
  if (elements.length === 0) return { x: 0, y: 0, width: 0, height: 0 }
  if (elements.length === 1) return elementBox(elements[0])
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const el of elements) {
    const b = elementBox(el)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.width)
    maxY = Math.max(maxY, b.y + b.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

/**
 * Handle positions around a box. Text only offers width handles: the four
 * corners and the left/right midpoints.
 */
export function handlePoints(box: Box, text = false): HandlePoint[] {
  const { x, y, width: w, height: h } = box
  const all: ResizeHandle[] = text
    ? ['nw', 'ne', 'sw', 'se', 'e', 'w']
    : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  return all.map((handle) => {
    const west = handle.includes('w')
    const east = handle.includes('e')
    const north = handle.includes('n')
    const south = handle.includes('s')
    return {
      handle,
      x: west ? x : east ? x + w : x + w / 2,
      y: north ? y : south ? y + h : y + h / 2,
      cursor: CURSORS[handle],
    }
  })
}

/** Handle under `p`, using a scene-space slop (callers divide by zoom). */
export function hitHandle(
  handles: HandlePoint[],
  p: { x: number; y: number },
  slop: number,
): HandlePoint | null {
  for (const h of handles) {
    if (Math.abs(p.x - h.x) <= slop && Math.abs(p.y - h.y) <= slop) return h
  }
  return null
}

export interface ResizeOptions {
  shift?: boolean
  alt?: boolean
  /** Minimum width; text uses `MIN_TEXT_WIDTH`. */
  minWidth?: number
  minHeight?: number
}

/**
 * Resizes a box from one handle. The opposite side stays anchored unless Alt
 * is held (resize from the centre). Shift preserves aspect ratio on corners.
 */
export function resizeBox(
  box: Box,
  handle: ResizeHandle,
  point: { x: number; y: number },
  options: ResizeOptions = {},
): Box {
  const minW = Math.max(1, options.minWidth ?? MIN_SIZE)
  const minH = Math.max(1, options.minHeight ?? MIN_SIZE)
  const west = handle.includes('w')
  const east = handle.includes('e')
  const north = handle.includes('n')
  const south = handle.includes('s')
  const corner = (west || east) && (north || south)
  const aspect = box.height === 0 ? 1 : box.width / box.height

  if (options.alt) {
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    let halfW = west || east ? Math.abs(point.x - cx) : box.width / 2
    let halfH = north || south ? Math.abs(point.y - cy) : box.height / 2
    halfW = Math.max(halfW, minW / 2)
    halfH = Math.max(halfH, minH / 2)
    if (options.shift && corner) {
      if (halfW / halfH >= aspect) halfH = halfW / aspect
      else halfW = halfH * aspect
      halfW = Math.max(halfW, minW / 2)
      halfH = Math.max(halfH, minH / 2)
    }
    return {
      x: cx - halfW,
      y: cy - halfH,
      width: halfW * 2,
      height: halfH * 2,
    }
  }

  let left = box.x
  let right = box.x + box.width
  let top = box.y
  let bottom = box.y + box.height
  if (west) left = Math.min(point.x, right - minW)
  if (east) right = Math.max(point.x, left + minW)
  if (north) top = Math.min(point.y, bottom - minH)
  if (south) bottom = Math.max(point.y, top + minH)

  if (options.shift && corner) {
    let w = right - left
    let h = bottom - top
    if (w / h >= aspect) h = w / aspect
    else w = h * aspect
    w = Math.max(w, minW)
    h = Math.max(h, minH)
    if (west) left = right - w
    else right = left + w
    if (north) top = bottom - h
    else bottom = top + h
  }

  return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Width-only resize used for a lone text element. */
export function resizeTextBox(
  box: Box,
  handle: ResizeHandle,
  point: { x: number; y: number },
): Box {
  const minW = MIN_TEXT_WIDTH
  let left = box.x
  let right = box.x + box.width
  if (handle.includes('w')) left = Math.min(point.x, right - minW)
  if (handle.includes('e')) right = Math.max(point.x, left + minW)
  return { x: left, y: box.y, width: right - left, height: box.height }
}

/** Re-wraps a text element at a new width without scaling the glyphs. */
export function fitTextToWidth(
  el: TextElement,
  width: number,
  fontSize = el.fontSize,
): TextElement {
  const raw = el.originalText ?? el.text
  const block = textBlock(raw, fontSize, {
    maxWidth: Math.max(MIN_TEXT_WIDTH, width),
    lineHeight: el.lineHeight ?? TEXT_LINE_HEIGHT,
  })
  return {
    ...el,
    fontSize,
    text: block.lines.join('\n'),
    width: Math.max(MIN_TEXT_WIDTH, width),
    height: block.height,
    autoResize: false,
    originalText: raw,
  }
}

export interface ElementResizeOptions {
  /** Multiplier applied to standalone text font sizes (group scaling). */
  fontScale?: number
  /** True when resizing a multi-element selection (text keeps auto-sizing). */
  group?: boolean
}

/**
 * Maps one element from its original box into the resized box. Shapes and pens
 * scale geometry; text re-wraps; bound arrows are left for `resnapArrow`.
 */
export function resizeElement(
  el: ExcalidrawElement,
  startBox: Box,
  nextBox: Box,
  options: ElementResizeOptions = {},
): ExcalidrawElement {
  const sx = startBox.width === 0 ? 1 : nextBox.width / startBox.width
  const sy = startBox.height === 0 ? 1 : nextBox.height / startBox.height
  const mapX = (x: number) => nextBox.x + (x - startBox.x) * sx
  const mapY = (y: number) => nextBox.y + (y - startBox.y) * sy

  if (el.type === 'text') {
    const scale = options.fontScale ?? 1
    const fontSize = Math.max(1, el.fontSize * scale)
    const x = mapX(el.x)
    const y = mapY(el.y)
    // Group resizing keeps auto-sized text auto-sized; a direct resize sets a
    // fixed wrap width so the text reflows instead of scaling glyphs.
    if (options.group && el.autoResize) {
      const block = textBlock(el.originalText ?? el.text, fontSize, {
        maxWidth: null,
        lineHeight: el.lineHeight ?? TEXT_LINE_HEIGHT,
      })
      return {
        ...el,
        x,
        y,
        fontSize,
        text: block.lines.join('\n'),
        width: block.width,
        height: block.height,
      }
    }
    const width = Math.max(MIN_TEXT_WIDTH, el.width * sx)
    return { ...fitTextToWidth(el, width, fontSize), x, y }
  }

  if (el.type === 'pen') {
    const pen = el as PenElement
    const points = pen.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) }))
    const xs = points.map((p) => p.x)
    const ys = points.map((p) => p.y)
    return {
      ...pen,
      x: xs.length ? Math.min(...xs) : mapX(pen.x),
      y: ys.length ? Math.min(...ys) : mapY(pen.y),
      points,
    }
  }

  if (el.type === 'arrow') {
    if (el.startBinding || el.endBinding) return el
    const points = el.points.map((p) => ({ x: mapX(p.x), y: mapY(p.y) })) as [
      { x: number; y: number },
      { x: number; y: number },
    ]
    return { ...el, x: points[0].x, y: points[0].y, points }
  }

  return {
    ...el,
    x: mapX(el.x),
    y: mapY(el.y),
    width: Math.max(1, el.width * sx),
    height: Math.max(1, el.height * sy),
  }
}

/** Font multiplier for a group resize (never below 1px). */
export function groupFontScale(startBox: Box, nextBox: Box): number {
  const sx = startBox.width === 0 ? 1 : nextBox.width / startBox.width
  const sy = startBox.height === 0 ? 1 : nextBox.height / startBox.height
  return Math.min(sx, sy)
}
