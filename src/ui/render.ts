import type { ArrowheadStyle, Point } from '../core/types'
import type { ExcalidrawElement, RectLikeType } from '../core/types'
import { elbowRoute, traceRoute } from '../core/geometry'
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from '../core/textLayout'
import type { Viewport } from './viewport'

export const HANDWRITING_FONT = TEXT_FONT_FAMILY

export function strokeStyle(el: ExcalidrawElement): string {
  return el.strokeColor
}

/**
 * Traces the outline of a box shape into the current path. Infrastructure
 * shapes are drawn from the same (x, y, width, height) box as rectangles so
 * they scale, fill, and hit-test consistently.
 */
export function traceBoxShape(
  ctx: CanvasRenderingContext2D,
  type: RectLikeType,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  switch (type) {
    case 'rectangle':
      ctx.rect(x, y, w, h)
      return
    case 'ellipse':
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
      return
    case 'laptop': {
      // Screen and keyboard deck.
      ctx.rect(x + w * 0.08, y, w * 0.84, h * 0.68)
      ctx.moveTo(x, y + h)
      ctx.lineTo(x + w * 0.1, y + h * 0.78)
      ctx.lineTo(x + w * 0.9, y + h * 0.78)
      ctx.lineTo(x + w, y + h)
      ctx.closePath()
      return
    }
    case 'database': {
      // Cylinder: body sides + bottom arc, then the top rim.
      const ry = Math.max(1, h * 0.12)
      const cx = x + w / 2
      ctx.moveTo(x, y + ry)
      ctx.lineTo(x, y + h - ry)
      ctx.ellipse(cx, y + h - ry, w / 2, ry, 0, Math.PI, 0)
      ctx.lineTo(x + w, y + ry)
      ctx.moveTo(x + w, y + ry)
      ctx.ellipse(cx, y + ry, w / 2, ry, 0, Math.PI * 2, 0)
      return
    }
    case 'server': {
      // Rack body with two shelf lines.
      ctx.rect(x + w * 0.08, y, w * 0.84, h)
      for (const frac of [1 / 3, 2 / 3]) {
        ctx.moveTo(x + w * 0.08, y + h * frac)
        ctx.lineTo(x + w * 0.92, y + h * frac)
      }
      return
    }
    case 'cloud': {
      ctx.moveTo(x + w * 0.22, y + h * 0.85)
      ctx.bezierCurveTo(
        x - w * 0.02, y + h * 0.85,
        x, y + h * 0.45,
        x + w * 0.25, y + h * 0.44,
      )
      ctx.bezierCurveTo(
        x + w * 0.28, y + h * 0.12,
        x + w * 0.66, y + h * 0.08,
        x + w * 0.7, y + h * 0.36,
      )
      ctx.bezierCurveTo(
        x + w * 0.95, y + h * 0.3,
        x + w * 1.02, y + h * 0.65,
        x + w * 0.82, y + h * 0.85,
      )
      ctx.closePath()
      return
    }
    case 'user': {
      const cx = x + w / 2
      const r = Math.min(w, h) * 0.18
      ctx.ellipse(cx, y + h * 0.3, r, r, 0, 0, Math.PI * 2)
      ctx.moveTo(cx - w * 0.4, y + h)
      ctx.bezierCurveTo(
        cx - w * 0.4, y + h * 0.58,
        cx + w * 0.4, y + h * 0.58,
        cx + w * 0.4, y + h,
      )
      ctx.closePath()
      return
    }
  }
}

function drawBoxShape(
  ctx: CanvasRenderingContext2D,
  type: RectLikeType,
  x: number,
  y: number,
  w: number,
  h: number,
  style: { strokeColor: string; background: string; strokeWidth: number },
): void {
  ctx.beginPath()
  traceBoxShape(ctx, type, x, y, w, h)
  if (style.background !== 'transparent') {
    ctx.fillStyle = style.background
    ctx.fill()
  }
  ctx.lineWidth = style.strokeWidth
  ctx.strokeStyle = style.strokeColor
  ctx.stroke()
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
    case 'rectangle':
    case 'ellipse':
    case 'laptop':
    case 'database':
    case 'server':
    case 'cloud':
    case 'user':
      drawBoxShape(ctx, el.type, el.x, el.y, el.width, el.height, el)
      break
    case 'arrow': {
      const [a, b] = el.points
      const route = elbowRoute(a, b)
      ctx.lineWidth = el.strokeWidth
      ctx.strokeStyle = el.strokeColor
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.setLineDash(el.dashed ? [8, 7] : [])
      ctx.beginPath()
      traceRoute(ctx, route)
      ctx.stroke()
      ctx.setLineDash([])
      const endStyle = el.endArrowhead === undefined ? 'arrow' : el.endArrowhead
      if (endStyle) {
        drawArrowHead(
          ctx,
          route[route.length - 1],
          route[route.length - 2],
          endStyle,
          el.strokeWidth,
        )
      }
      if (el.startArrowhead) {
        drawArrowHead(ctx, route[0], route[1], el.startArrowhead, el.strokeWidth)
      }
      break
    }
    case 'text': {
      ctx.save()
      ctx.font = `${el.fontSize}px ${HANDWRITING_FONT}`
      ctx.fillStyle = el.strokeColor
      ctx.textBaseline = 'top'
      ctx.textAlign = el.textAlign ?? 'left'
      const lines = el.text.split('\n')
      const lineHeight = (el.lineHeight ?? TEXT_LINE_HEIGHT) * el.fontSize
      const width =
        typeof el.width === 'number'
          ? el.width
          : lines.reduce(
              (w, line) => Math.max(w, ctx.measureText(line).width),
              0,
            )
      const x =
        ctx.textAlign === 'center'
          ? el.x + width / 2
          : ctx.textAlign === 'right'
            ? el.x + width
            : el.x
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x, el.y + i * lineHeight)
      }
      ctx.restore()
      break
    }
  }
}

/** Head length grows with stroke width, like Excalidraw's markers. */
export function arrowHeadSize(strokeWidth: number): number {
  return 6 + 2 * strokeWidth
}

function drawArrowHead(
  ctx: CanvasRenderingContext2D,
  tip: Point,
  from: Point,
  style: ArrowheadStyle,
  width: number,
): void {
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x)
  const length = arrowHeadSize(width)
  const half = length * 0.4
  const baseX = tip.x - Math.cos(angle) * length
  const baseY = tip.y - Math.sin(angle) * length
  const nx = Math.cos(angle + Math.PI / 2) * half
  const ny = Math.sin(angle + Math.PI / 2) * half
  const p1 = { x: baseX + nx, y: baseY + ny }
  const p2 = { x: baseX - nx, y: baseY - ny }
  ctx.fillStyle = ctx.strokeStyle as string
  if (style === 'triangle') {
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.closePath()
    ctx.fill()
    return
  }
  // Classic open arrow: two strokes meeting at the tip.
  ctx.beginPath()
  ctx.moveTo(p1.x, p1.y)
  ctx.lineTo(tip.x, tip.y)
  ctx.lineTo(p2.x, p2.y)
  ctx.lineWidth = width
  ctx.stroke()
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
  type: RectLikeType | 'arrow',
  a: Point,
  b: Point,
  style: {
    strokeColor: string
    strokeWidth: number
    background: string
    dashed?: boolean
    startArrowhead?: ArrowheadStyle | null
    endArrowhead?: ArrowheadStyle | null
  },
): void {
  if (type === 'arrow') {
    const route = elbowRoute(a, b)
    ctx.lineWidth = style.strokeWidth
    ctx.strokeStyle = style.strokeColor
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.setLineDash(style.dashed ? [8, 7] : [])
    ctx.beginPath()
    traceRoute(ctx, route)
    ctx.stroke()
    ctx.setLineDash([])
    const endStyle = style.endArrowhead === undefined ? 'arrow' : style.endArrowhead
    if (endStyle) {
      drawArrowHead(
        ctx,
        route[route.length - 1],
        route[route.length - 2],
        endStyle,
        style.strokeWidth,
      )
    }
    if (style.startArrowhead) {
      drawArrowHead(ctx, route[0], route[1], style.startArrowhead, style.strokeWidth)
    }
    return
  }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const w = Math.abs(b.x - a.x)
  const h = Math.abs(b.y - a.y)
  drawBoxShape(ctx, type as RectLikeType, x, y, w, h, style)
}
