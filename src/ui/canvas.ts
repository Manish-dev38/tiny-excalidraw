import { getElement, type Scene } from '../core/scene'
import { addElement, createScene, removeElement, updateElement } from '../core/scene'
import { applyOp, createHistory, redo as historyRedo, record, undo as historyUndo } from '../core/history'
import type { History, Op } from '../core/history'
import { buildRoomUrl } from '../core/room'
import { toSVG } from '../core/export'
import { serializeScene } from '../core/serialize'
import { bboxOf } from '../core/geometry'
import type { Point } from '../core/types'
import { eraserHitTest } from './eraser'
import { makeArrowElement, makeEllipseElement, makePenElement, makeRectElement, makeTextElement } from './factories'
import type { DrawStyle } from './factories'
import { startPeerSession, type PeerSession } from '../collab/peer'
import type { ClientMessage } from '../collab/protocol'
import { clearCanvas, drawElement, renderPath, renderShape } from './render'
import { buildToolbar } from './toolbar'
import type { ToolbarState, UiTool } from './toolbar'
import { THEME_VARS } from './palette'
import type { Theme } from './palette'
import { saveBoard } from './storage'
import type { BoardStore } from './storage'
import { screenToScene, sceneToScreen, zoomAt, panBy } from './viewport'
import type { Viewport } from './viewport'
import { hitTestTop, translateElement } from './select'
import type { ExcalidrawElement } from '../core/types'
import { assignColor, availablePeers, formatName } from './participants'

const MIN_DRAG = 2

function genId(): string {
  return `el-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

type Gesture =
  | { kind: 'pen'; points: Point[] }
  | { kind: 'shape'; type: 'rectangle' | 'ellipse' | 'arrow'; start: Point; current: Point }
  | { kind: 'eraser'; points: Point[] }
  | { kind: 'pan'; last: Point }
  | {
      kind: 'move'
      id: string
      /** The element as it was when the move started. */
      original: ExcalidrawElement
      startScene: Point
      lastScene: Point
      moved: boolean
    }
  | null

export interface CanvasMount {
  roomId: string
  store: BoardStore
  initialScene?: Scene
  onHome?(): void
}

export class CanvasApp {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene: Scene
  private history: History
  private viewport: Viewport = { x: 40, y: 40, zoom: 1 }
  private tool: UiTool = 'pen'
  private style: DrawStyle = { strokeColor: '#1e1e1e', background: 'transparent', strokeWidth: 2 }
  private theme: Theme = 'light'
  private gesture: Gesture = null
  private spaceDown = false
  private peer: PeerSession
  private remoteCursor: { x: number; y: number; name: string; color: string } | null = null
  private selectedId: string | null = null
  private selfName = availablePeers()
  private abort: AbortController = new AbortController()
  private ro: ResizeObserver | null = null
  private statusEl: HTMLElement
  private toolbarUpdate: (s: ToolbarState) => void
  private savedFlag = false
  private persistTimer: number | undefined

  constructor(private mount: CanvasMount) {
    this.container = document.createElement('div')
    this.container.className = 'app'
    this.scene = mount.initialScene ?? createScene()
    this.history = createHistory()

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'canvas'
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not supported')
    this.ctx = ctx
    this.container.appendChild(this.canvas)

    const tb = buildToolbar(this.toolbarState(), this.callbacks())
    this.toolbarUpdate = tb.update
    this.container.appendChild(tb.el)

    this.statusEl = document.createElement('div')
    this.statusEl.className = 'status-pill'
    this.statusEl.textContent = 'Connecting…'
    this.container.appendChild(this.statusEl)

    this.theme = (localStorage.getItem('tiny-theme') as Theme) || 'light'
    this.applyTheme()
    this.bindEvents()
    this.resize()

    this.peer = startPeerSession(mount.roomId, {
      onMessage: (m) => this.handleRemote(m),
      onStatus: (_role, status) => {
        this.statusEl.textContent =
          status === 'connected' ? 'Live' : status === 'error' ? 'Friend offline' : 'Connecting…'
        this.statusEl.classList.toggle('ok', status === 'connected')
      },
      onConnected: (role) => {
        if (role === 'host') this.broadcastScene()
      },
    })

    if (!mount.initialScene) this.persist()
  }

  get el(): HTMLElement {
    return this.container
  }

  private callbacks() {
    return {
      onSelectTool: (t: UiTool) => {
        this.tool = t
        this.toolbarUpdate(this.toolbarState())
      },
      onSelectStrokeColor: (c: string) => {
        this.style = { ...this.style, strokeColor: c }
        this.toolbarUpdate(this.toolbarState())
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onZoomDelta: (f: number) => {
        this.viewport = zoomAt(this.viewport, this.center(), f)
        this.render()
        this.toolbarUpdate(this.toolbarState())
      },
      onZoomReset: () => {
        this.viewport = { x: 40, y: 40, zoom: 1 }
        this.render()
        this.toolbarUpdate(this.toolbarState())
      },
      onFit: () => this.fitToScene(),
      onToggleTheme: () => {
        this.theme = this.theme === 'light' ? 'dark' : 'light'
        localStorage.setItem('tiny-theme', this.theme)
        this.applyTheme()
        this.render()
      },
      onExportPng: () => this.exportPng(),
      onExportSvg: () => this.exportSvg(),
      onCopyLink: () => {
        void navigator.clipboard.writeText(buildRoomUrl(this.mount.roomId))
        this.statusEl.textContent = 'Link copied'
        this.statusEl.classList.add('ok')
      },
      onHome: () => {
        this.destroy()
        if (this.mount.onHome) this.mount.onHome()
        else history.replaceState(null, '', location.pathname)
      },
    }
  }

  private toolbarState(): ToolbarState {
    return {
      tool: this.tool,
      canUndo: this.history.past.length > 0,
      canRedo: this.history.future.length > 0,
      zoomPct: this.viewport.zoom * 100,
      strokeColor: this.style.strokeColor,
    }
  }

  private center(): Point {
    return { x: this.canvas.clientWidth / 2, y: this.canvas.clientHeight / 2 }
  }

  private resize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    if (!w || !h) return
    const dpr = window.devicePixelRatio || 1
    const bw = Math.floor(w * dpr)
    const bh = Math.floor(h * dpr)
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw
      this.canvas.height = bh
    }
    this.render()
  }

  private render() {
    if (!this.canvas.clientWidth || !this.canvas.clientHeight) return
    // Belt-and-suspenders: ensure the backing buffer matches the element size.
    const dpr = window.devicePixelRatio || 1
    const bw = Math.floor(this.canvas.clientWidth * dpr)
    const bh = Math.floor(this.canvas.clientHeight * dpr)
    if (this.canvas.width !== bw || this.canvas.height !== bh) {
      this.canvas.width = bw
      this.canvas.height = bh
    }
    const dvp: Viewport = {
      zoom: this.viewport.zoom * dpr,
      x: this.viewport.x * dpr,
      y: this.viewport.y * dpr,
    }
    const bg = this.theme === 'dark' ? '#141414' : '#ffffff'
    clearCanvas(this.ctx, dvp, bg)
    for (const el of this.scene.elements) {
      drawElement(this.ctx, el)
    }
    if (this.gesture) this.drawGesture(this.gesture)
    if (this.remoteCursor) this.drawCursor()
    if (this.selectedId) this.drawSelection()
  }

  private drawGesture(g: NonNullable<Gesture>) {
    if (g.kind === 'pen') {
      renderPath(this.ctx, g.points, this.style)
    } else if (g.kind === 'shape') {
      renderShape(this.ctx, g.type, g.start, g.current, this.style)
    } else if (g.kind === 'eraser') {
      renderPath(this.ctx, g.points, { strokeColor: '#868e96', strokeWidth: 8 })
    }
  }

  private drawCursor() {
    const c = this.remoteCursor
    if (!c) return
    this.ctx.save()
    // Cursor dot.
    this.ctx.fillStyle = c.color
    this.ctx.beginPath()
    this.ctx.arc(c.x, c.y, 6, 0, Math.PI * 2)
    this.ctx.fill()
    // Name label chip.
    this.ctx.font = '12px Inter, system-ui, sans-serif'
    const w = this.ctx.measureText(c.name).width + 14
    const bx = c.x + 10
    const by = c.y + 8
    this.ctx.fillStyle = c.color
    this.roundRect(bx, by, w, 20, 4)
    this.ctx.fill()
    this.ctx.fillStyle = '#ffffff'
    this.ctx.textBaseline = 'middle'
    this.ctx.fillText(c.name, bx + 7, by + 10)
    this.ctx.restore()
  }

  private roundRect(x: number, y: number, w: number, h: number, r: number) {
    this.ctx.beginPath()
    this.ctx.moveTo(x + r, y)
    this.ctx.arcTo(x + w, y, x + w, y + h, r)
    this.ctx.arcTo(x + w, y + h, x, y + h, r)
    this.ctx.arcTo(x, y + h, x, y, r)
    this.ctx.arcTo(x, y, x + w, y, r)
    this.ctx.closePath()
  }

  private drawSelection() {
    const el = getElement(this.scene, this.selectedId!)
    if (!el) return
    const b = bboxOf(el)
    const pad = 4
    this.ctx.save()
    this.ctx.strokeStyle = '#1971c2'
    this.ctx.fillStyle = 'rgba(25, 113, 194, 0.07)'
    this.ctx.lineWidth = 1 / this.viewport.zoom
    this.ctx.setLineDash([4 / this.viewport.zoom, 3 / this.viewport.zoom])
    const x = b.minX - pad
    const y = b.minY - pad
    const w = b.maxX - b.minX + pad * 2
    const h = b.maxY - b.minY + pad * 2
    this.ctx.beginPath()
    this.ctx.rect(x, y, w, h)
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.restore()
  }

  private bindEvents() {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    c.addEventListener('pointermove', (e) => this.onPointerMove(e))
    c.addEventListener('pointerup', () => this.onPointerUp())
    c.addEventListener('pointercancel', () => this.onPointerUp())
    c.addEventListener('wheel', (e) => {
      e.preventDefault()
      const d = e.ctrlKey ? Math.exp(-e.deltaY * 0.004) : Math.exp(-e.deltaY * 0.0015)
      this.viewport = zoomAt(this.viewport, this.toScene(e), d)
      this.render()
      this.toolbarUpdate(this.toolbarState())
    }, { passive: false })
    const sig = this.abort.signal
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isEditingText()) {
        this.spaceDown = true
        e.preventDefault()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) this.redo()
        else this.undo()
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        this.redo()
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId && !this.isEditingText()) {
        e.preventDefault()
        this.commitRemove(this.selectedId)
        this.selectedId = null
      }
    }, { signal: sig })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false
    }, { signal: sig })
    window.addEventListener('resize', () => this.resize(), { signal: sig })
    // Resize when the canvas is laid out, resized, or first painted.
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.canvas)
    requestAnimationFrame(() => this.resize())
  }

  private isEditingText(): boolean {
    return !!this.container.querySelector('textarea.editing')
  }

  private toScene(e: { clientX: number; clientY: number }): Point {
    const rect = this.canvas.getBoundingClientRect()
    return screenToScene(this.viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button === 2 || this.spaceDown) {
      this.gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } }
      this.canvas.setPointerCapture(e.pointerId)
      return
    }
    const p = this.toScene(e)
    if (this.tool === 'select') {
      const hit = hitTestTop(this.scene.elements, p)
      if (hit) {
        this.selectedId = hit.id
        this.gesture = {
          kind: 'move',
          id: hit.id,
          original: hit,
          startScene: p,
          lastScene: p,
          moved: false,
        }
      } else {
        this.selectedId = null
      }
      this.render()
      this.canvas.setPointerCapture(e.pointerId)
      return
    }
    switch (this.tool) {
      case 'pen':
        this.gesture = { kind: 'pen', points: [p] }
        break
      case 'rectangle':
      case 'ellipse':
      case 'arrow':
        this.gesture = { kind: 'shape', type: this.tool, start: p, current: p }
        break
      case 'eraser':
        this.gesture = { kind: 'eraser', points: [p] }
        break
      case 'text':
        this.beginText(p)
        return
      default:
        return
    }
    this.canvas.setPointerCapture(e.pointerId)
  }

  private onPointerMove(e: PointerEvent) {
    if (!this.gesture) {
      if (this.peer.status === 'connected') {
        const p = this.toScene(e)
        this.peer.send({
          type: 'cursor',
          x: p.x,
          y: p.y,
          tool: this.tool === 'eraser' || this.tool === 'select' ? null : this.tool,
          name: this.selfName,
        })
      }
      return
    }
    if (this.gesture.kind === 'pan') {
      const dx = e.clientX - this.gesture.last.x
      const dy = e.clientY - this.gesture.last.y
      this.viewport = panBy(this.viewport, dx, dy)
      this.gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } }
      this.render()
      return
    }
    const p = this.toScene(e)
    if (this.gesture.kind === 'pen') {
      this.gesture.points.push(p)
    } else if (this.gesture.kind === 'shape') {
      this.gesture.current = p
    } else if (this.gesture.kind === 'eraser') {
      this.gesture.points.push(p)
    } else if (this.gesture.kind === 'move') {
      const g = this.gesture
      const dx = p.x - g.startScene.x
      const dy = p.y - g.startScene.y
      if (Math.hypot(dx, dy) >= MIN_DRAG) g.moved = true
      if (g.moved) {
        const moved = translateElement(g.original, { dx, dy })
        this.scene = updateElement(this.scene, g.id, moved as Partial<ExcalidrawElement>)
      }
      g.lastScene = p
    }
    this.render()
  }

  private onPointerUp() {
    const g = this.gesture
    this.gesture = null
    if (!g) return
    if (g.kind === 'pan') return
    if (g.kind === 'pen') {
      if (g.points.length > 1) {
        this.commitAdd(makePenElement(genId(), g.points, this.style))
      }
    } else if (g.kind === 'shape') {
      if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) >= MIN_DRAG) {
        const el =
          g.type === 'rectangle'
            ? makeRectElement(genId(), g.start, g.current, this.style)
            : g.type === 'ellipse'
              ? makeEllipseElement(genId(), g.start, g.current, this.style)
              : makeArrowElement(genId(), g.start, g.current, this.style)
        this.commitAdd(el)
      }
    } else if (g.kind === 'eraser') {
      if (g.points.length > 0) {
        const ids = eraserHitTest(this.scene, g.points, 8)
        for (const id of ids) this.commitRemove(id)
      }
    } else if (g.kind === 'move') {
      if (g.moved) {
        const dx = g.lastScene.x - g.startScene.x
        const dy = g.lastScene.y - g.startScene.y
        const next = translateElement(g.original, { dx, dy })
        const op: Op = {
          type: 'update',
          id: g.id,
          prev: g.original,
          next: next as Partial<ExcalidrawElement>,
        }
        this.scene = applyOp(this.scene, op)
        this.history = record(this.history, op)
        this.broadcastOp(op)
        this.afterChange()
      }
    }
    this.render()
  }

  private commitAdd(element: import('../core/types').ExcalidrawElement) {
    const op: Op = { type: 'add', element }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.peer.send({ type: 'add', element })
    this.afterChange()
  }

  private commitRemove(id: string) {
    const el = getElement(this.scene, id)
    if (!el) return
    const op: Op = { type: 'remove', element: el }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.peer.send({ type: 'remove', id })
    this.afterChange()
  }

  private broadcastOp(op: Op) {
    if (op.type === 'add') this.peer.send({ type: 'add', element: op.element })
    else if (op.type === 'remove') this.peer.send({ type: 'remove', id: op.element.id })
    else this.peer.send({ type: 'update', id: op.id, patch: op.next })
  }

  private undo() {
    const r = historyUndo(this.history)
    if (!r) return
    this.history = r.history
    this.scene = applyOp(this.scene, r.op)
    this.broadcastOp(r.op)
    this.afterChange()
  }

  private redo() {
    const r = historyRedo(this.history)
    if (!r) return
    this.history = r.history
    this.scene = applyOp(this.scene, r.op)
    this.broadcastOp(r.op)
    this.afterChange()
  }

  private afterChange() {
    this.render()
    this.toolbarUpdate(this.toolbarState())
    this.persist()
  }

  private handleRemote(msg: ClientMessage) {
    switch (msg.type) {
      case 'add':
        if (!getElement(this.scene, msg.element.id)) {
          this.scene = addElement(this.scene, msg.element)
        }
        break
      case 'update':
        this.scene = updateElement(this.scene, msg.id, msg.patch)
        break
      case 'remove':
        this.scene = removeElement(this.scene, msg.id)
        break
      case 'cursor': {
        const color = assignColor(String(msg.name ?? 'remote'))
        this.remoteCursor = {
          x: msg.x,
          y: msg.y,
          name: formatName(msg.name ?? 'Peer'),
          color,
        }
        break
      }
    }
    if (msg.type !== 'cursor') {
      this.afterChange()
    } else {
      this.render()
    }
  }

  private broadcastScene() {
    for (const el of this.scene.elements) {
      this.peer.send({ type: 'add', element: el })
    }
  }

  private beginText(at: Point) {
    const rect = this.canvas.getBoundingClientRect()
    const screen = sceneToScreen(this.viewport, at)
    const ta = document.createElement('textarea')
    ta.className = 'editing'
    ta.style.left = `${rect.left + screen.x}px`
    ta.style.top = `${rect.top + screen.y}px`
    ta.style.fontSize = '24px'
    document.body.appendChild(ta)
    ta.focus()
    const commit = () => {
      const text = ta.value.trim()
      ta.remove()
      if (text) this.commitAdd(makeTextElement(genId(), at, text, 24))
      this.canvas.focus()
    }
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commit()
      }
    })
    ta.addEventListener('blur', commit)
  }

  private fitToScene() {
    if (this.scene.elements.length === 0) return
    const b = bboxOf(this.scene.elements[0])
    let minX = b.minX, minY = b.minY, maxX = b.maxX, maxY = b.maxY
    for (const el of this.scene.elements.slice(1)) {
      const c = bboxOf(el)
      minX = Math.min(minX, c.minX)
      minY = Math.min(minY, c.minY)
      maxX = Math.max(maxX, c.maxX)
      maxY = Math.max(maxY, c.maxY)
    }
    const w = maxX - minX
    const h = maxY - minY
    const pad = 40
    const zoom = Math.min(
      4,
      Math.max(
        0.1,
        Math.min((this.canvas.clientWidth - pad * 2) / (w || 1), (this.canvas.clientHeight - pad * 2) / (h || 1)),
      ),
    )
    const x = (this.canvas.clientWidth - w * zoom) / 2 - minX * zoom
    const y = (this.canvas.clientHeight - h * zoom) / 2 - minY * zoom
    this.viewport = { zoom, x, y }
    this.render()
    this.toolbarUpdate(this.toolbarState())
  }

  private exportPng() {
    if (this.scene.elements.length === 0) return
    let b = bboxOf(this.scene.elements[0])
    for (const el of this.scene.elements.slice(1)) {
      const c = bboxOf(el)
      b = {
        minX: Math.min(b.minX, c.minX),
        minY: Math.min(b.minY, c.minY),
        maxX: Math.max(b.maxX, c.maxX),
        maxY: Math.max(b.maxY, c.maxY),
      }
    }
    const scale = 2
    const w = Math.max(1, Math.ceil((b.maxX - b.minX) * scale))
    const h = Math.max(1, Math.ceil((b.maxY - b.minY) * scale))
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')!
    const bg = this.theme === 'dark' ? '#141414' : '#ffffff'
    octx.fillStyle = bg
    octx.fillRect(0, 0, w, h)
    octx.setTransform(scale, 0, 0, scale, -b.minX * scale, -b.minY * scale)
    for (const el of this.scene.elements) drawElement(octx, el)
    const a = document.createElement('a')
    a.href = off.toDataURL('image/png')
    a.download = `board-${this.mount.roomId}.png`
    a.click()
  }

  private exportSvg() {
    const svg = toSVG(this.scene)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `board-${this.mount.roomId}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  private applyTheme() {
    const vars = THEME_VARS[this.theme]
    const root = document.documentElement
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v)
    root.style.setProperty('--canvas-bg', this.theme === 'dark' ? '#141414' : '#ffffff')
  }

  private persist() {
    if (this.savedFlag) return
    this.savedFlag = true
    window.clearTimeout(this.persistTimer)
    this.persistTimer = window.setTimeout(() => {
      this.savedFlag = false
      const scene = this.scene
      saveBoard(this.mount.store, {
        roomId: this.mount.roomId,
        data: serializeScene(scene),
        updatedAt: Date.now(),
      })
    }, 300)
  }

  destroy() {
    this.abort.abort()
    this.ro?.disconnect()
    this.ro = null
    window.clearTimeout(this.persistTimer)
    this.peer.close()
    this.container.remove()
  }
}
