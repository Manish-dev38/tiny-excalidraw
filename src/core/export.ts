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

export function toSVG(scene: Scene, scale = 1): string {
  const b = unionBBox(scene.elements)
  const width = b.maxX - b.minX
  const height = b.maxY - b.minY
  const body = scene.elements.map(elementToSVG).join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${b.minX} ${b.minY} ${width} ${height}" width="${width * scale}" height="${height * scale}">\n${body}\n</svg>`
}
