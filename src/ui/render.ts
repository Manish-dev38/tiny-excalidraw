import type { Point } from '../core/types'
import type { ExcalidrawElement } from '../core/types'
import type { Viewport } from './viewport'

export const HANDWRITING_FONT = "'Caveat', 'Segoe Print', 'Comic Sans MS', cursive"

export function strokeStyle(el: ExcalidrawElement): string {
  return el.strokeColor
}

export function drawElement(ctx: CanvasRenderingContext2D, el: ExcalidrawElement): void {
  switch (el.type) {
    case 'pen': {
      if (el.points.length === 0) return
      ctx.lineWidth = el.strokeWidth
      ctx.strokeStyle = el.strokeColor
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.beginPath()
      ctx.moveTo(el.points[0].x, el.points[0].y)
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y)
      }
      ctx.stroke()
      break
    }
    case 'rectangle': {
      if (el.background !== 'transparent') {
        ctx.fillStyle = el.background
        ctx.fillRect(el.x, el.y, el.width, el.height)
      }
      ctx.lineWidth = el.strokeWidth
      ctx.strokeStyle = el.strokeColor
      ctx.strokeRect(el.x, el.y, el.width, el.height)
      break
    }
    case 'ellipse': {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const rx = Math.abs(el.width / 2)
      const ry = Math.abs(el.height / 2)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      if (el.background !== 'transparent') {
        ctx.fillStyle = el.background
        ctx.fill()
      }
      ctx.lineWidth = el.strokeWidth
      ctx.strokeStyle = el.strokeColor
      ctx.stroke()
      break
    }
    case 'arrow': {
      const [a, b] = el.points
      ctx.lineWidth = el.strokeWidth
      ctx.strokeStyle = el.strokeColor
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      drawArrowHead(ctx, b, a, el.strokeWidth)
      break
    }
    case 'text': {
      ctx.font = `${el.fontSize}px ${HANDWRITING_FONT}`
      ctx.fillStyle = el.strokeColor
      ctx.textBaseline = 'top'
      ctx.fillText(el.text, el.x, el.y)
      break
    }
  }
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  from: Point,
  width: number,
): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const size = Math.max(10, width * 4)
  const spread = 0.4
  const a1 = angle - Math.PI + spread
  const a2 = angle + Math.PI - spread
  ctx.fillStyle = ctx.strokeStyle as string
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(tip.x + Math.cos(a1) * size, tip.y + Math.sin(a1) * size)
  ctx.lineTo(tip.x + Math.cos(a2) * size, tip.y + Math.sin(a2) * size)
  ctx.closePath()
  ctx.fill()
}

export function clearCanvas(ctx: CanvasRenderingContext2D, vp: Viewport, background: string): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  ctx.setTransform(vp.zoom, 0, 0, vp.zoom, vp.x, vp.y)
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  elements: ExcalidrawElement[],
  vp: Viewport,
  background: string,
): void {
  clearCanvas(ctx, vp, background)
  for (const el of elements) drawElement(ctx, el)
}

export function renderPath(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  style: { strokeColor: string; strokeWidth: number },
): void {
  if (points.length === 0) return
  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.strokeColor
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
}

export function renderShape(
  ctx: CanvasRenderingContext2D,
  type: 'rectangle' | 'ellipse' | 'arrow',
  a: Point,
  b: Point,
  style: { strokeColor: string; strokeWidth: number; background: string },
): void {
  if (type === 'arrow') {
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.strokeColor
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    drawArrowHead(ctx, b, a, style.strokeWidth)
    return
  }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  ctx.beginPath()
  if (type === 'rectangle') {
    if (style.background !== 'transparent') {
      ctx.fillStyle = style.background
      ctx.fillRect(x, y, w, h)
    }
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.strokeColor
    ctx.strokeRect(x, y, w, h)
  } else {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
    if (style.background !== 'transparent') {
      ctx.fillStyle = style.background
      ctx.fill()
    }
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.strokeColor
    ctx.stroke()
  }
}
