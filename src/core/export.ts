import { bboxOf, LINE_HEIGHT, type BBox } from './geometry'
import type { Scene } from './scene'
import type { ExcalidrawElement } from './types'

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return map[c]!
  })
}

function unionBBox(elements: ExcalidrawElement[]): BBox {
  if (elements.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  let b = bboxOf(elements[0])
  for (const el of elements.slice(1)) {
    const c = bboxOf(el)
    b = {
      minX: Math.min(b.minX, c.minX),
      minY: Math.min(b.minY, c.minY),
      maxX: Math.max(b.maxX, c.maxX),
      maxY: Math.max(b.maxY, c.maxY),
    }
  }
  return b
}

function elementToSVG(el: ExcalidrawElement): string {
  switch (el.type) {
    case 'rectangle':
      return `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${esc(el.background)}" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}"/>`
    case 'ellipse': {
      const rx = el.width / 2
      const ry = el.height / 2
      return `<ellipse cx="${el.x + rx}" cy="${el.y + ry}" rx="${rx}" ry="${ry}" fill="${esc(el.background)}" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}"/>`
    }
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      return infraShapeToSVG(el)
    case 'arrow': {
      const [a, b] = el.points
      return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}"/>`
    }
    case 'pen': {
      const d = el.points
        .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
        .join(' ')
      return `<path d="${d}" fill="none" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`
    }
    case 'text': {
      const lines = el.text.split('\n')
      const spans = lines
        .map((line, i) => {
          const dy = i === 0 ? el.fontSize : el.fontSize * LINE_HEIGHT
          return `<tspan x="${el.x}" dy="${dy}">${esc(line)}</tspan>`
        })
        .join('')
      return `<text font-size="${el.fontSize}" font-family="Caveat, Segoe Print, cursive" fill="${esc(el.strokeColor)}">${spans}</text>`
    }
  }
}

/** SVG for the infrastructure shapes, mirroring `traceBoxShape` geometry. */
function infraShapeToSVG(el: Extract<ExcalidrawElement, { width: number }>): string {
  const { x, y, width: w, height: h } = el
  const style = `fill="${esc(el.background)}" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}" stroke-linejoin="round"`
  const strokes = `fill="none" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}"`
  switch (el.type) {
    case 'laptop':
      return [
        `<rect x="${x + w * 0.08}" y="${y}" width="${w * 0.84}" height="${h * 0.68}" ${style}/>`,
        `<path d="M ${x} ${y + h} L ${x + w * 0.1} ${y + h * 0.78} L ${x + w * 0.9} ${y + h * 0.78} L ${x + w} ${y + h} Z" ${style}/>`,
      ].join('')
    case 'database': {
      const ry = Math.max(1, h * 0.12)
      const cx = x + w / 2
      return [
        `<path d="M ${x} ${y + ry} L ${x} ${y + h - ry} A ${w / 2} ${ry} 0 0 0 ${x + w} ${y + h - ry} L ${x + w} ${y + ry} Z" ${style}/>`,
        `<ellipse cx="${cx}" cy="${y + ry}" rx="${w / 2}" ry="${ry}" fill="${esc(el.background)}" stroke="${esc(el.strokeColor)}" stroke-width="${el.strokeWidth}"/>`,
      ].join('')
    }
    case 'server':
      return [
        `<rect x="${x + w * 0.08}" y="${y}" width="${w * 0.84}" height="${h}" ${style}/>`,
        `<line x1="${x + w * 0.08}" y1="${y + h / 3}" x2="${x + w * 0.92}" y2="${y + h / 3}" ${strokes}/>`,
        `<line x1="${x + w * 0.08}" y1="${y + (h * 2) / 3}" x2="${x + w * 0.92}" y2="${y + (h * 2) / 3}" ${strokes}/>`,
      ].join('')
    case 'cloud':
      return `<path d="M ${x + w * 0.22} ${y + h * 0.85} C ${x - w * 0.02} ${y + h * 0.85} ${x} ${y + h * 0.45} ${x + w * 0.25} ${y + h * 0.44} C ${x + w * 0.28} ${y + h * 0.12} ${x + w * 0.66} ${y + h * 0.08} ${x + w * 0.7} ${y + h * 0.36} C ${x + w * 0.95} ${y + h * 0.3} ${x + w * 1.02} ${y + h * 0.65} ${x + w * 0.82} ${y + h * 0.85} Z" ${style}/>`
    case 'user': {
      const cx = x + w / 2
      const r = Math.min(w, h) * 0.18
      return [
        `<ellipse cx="${cx}" cy="${y + h * 0.3}" rx="${r}" ry="${r}" ${style}/>`,
        `<path d="M ${cx - w * 0.4} ${y + h} C ${cx - w * 0.4} ${y + h * 0.58} ${cx + w * 0.4} ${y + h * 0.58} ${cx + w * 0.4} ${y + h} Z" ${style}/>`,
      ].join('')
    }
    default:
      // Rectangles and ellipses are serialised by `elementToSVG` directly.
      return ''
  }
}

export function toSVG(scene: Scene, scale = 1): string {
  const b = unionBBox(scene.elements)
  const width = b.maxX - b.minX
  const height = b.maxY - b.minY
  const body = scene.elements.map(elementToSVG).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minY} ${width} ${height}" width="${width * scale}" height="${height * scale}">\n${body}\n</svg>`
}
