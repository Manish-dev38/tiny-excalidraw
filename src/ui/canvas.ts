import { getElement, type Scene } from '../core/scene'
import { addElement, createScene, removeElement, updateElement } from '../core/scene'
import { applyOp, createHistory, redo as historyRedo, record, undo as historyUndo } from '../core/history'
import type { History, Op } from '../core/history'
import { buildRoomUrl } from '../core/room'
import { toSVG } from '../core/export'
import { serializeScene } from '../core/serialize'
import {
  defaultFileName,
  fileNameFromSource,
  MAX_FILE_BYTES,
  parseBoardFile,
  serializeBoardFile,
} from '../core/boardFile'
import { downloadTextFile } from './download'
import { confirmReplaceBoard, showImportError } from './dialogs'
import { createAutosave, type Autosave, type AutosaveState } from './autosave'
import { bboxOf } from '../core/geometry'
import type { Point } from '../core/types'
import { eraserHitTest } from './eraser'
import { makeArrowElement, makeEllipseElement, makePenElement, makeRectElement, makeTextElement } from './factories'
import type { DrawStyle } from './factories'
import { startPeerSession, type PeerSession } from '../collab/peer'
import type { ClientMessage } from '../collab/protocol'
import { clearCanvas, drawElement, renderPath, renderShape } from './render'
import { buildToolbar } from './toolbar'
import { buildProperties } from './properties'
import type { PropertiesState, StyleValues } from './properties'
import { buildChrome } from './chrome'
import type { Chrome, ChromeState } from './chrome'
import {
  SHORTCUT_TO_TOOL,
  hintFor,
  isPanelVisible,
  type ConnectionStatus,
  type PanelMode,
  type UiTool,
} from './uiState'
import { THEME_VARS } from './palette'
import type { Theme } from './palette'
import type { BoardRepository } from './storage'
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
  repo: BoardRepository
  initialScene?: Scene
  fileName?: string
  onHome?(): void
}

export class CanvasApp {
  private container: HTMLElement
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private scene: Scene
  private history: History
  private viewport: Viewport = { x: 40, y: 40, zoom: 1 }
  private tool: UiTool = 'select'
  private panelMode: PanelMode = 'auto'
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
  private status: ConnectionStatus = 'connecting'
  private chrome: Chrome
  private toolbarUpdate: (tool: UiTool) => void
  private panelUpdate: (state: PropertiesState) => void
  private chromeUpdate: (state: ChromeState) => void
  private autosave: Autosave
  private saveState: AutosaveState = { status: 'saved' }
  private finishText: ((keep: boolean) => void) | null = null
  private fileName: string
  private fileInput: HTMLInputElement

  constructor(private mount: CanvasMount) {
    this.container = document.createElement('div')
    this.container.className = 'app'
    this.scene = mount.initialScene ?? createScene()
    this.history = createHistory()
    this.fileName = mount.fileName ?? defaultFileName(mount.roomId)

    this.canvas = document.createElement('canvas')
    this.canvas.className = 'canvas'
    this.canvas.tabIndex = 0
    this.canvas.setAttribute('aria-label', 'Drawing canvas')
    const ctx = this.canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas not supported')
    this.ctx = ctx
    this.container.appendChild(this.canvas)

    const toolbar = buildToolbar(this.tool, (tool) => this.selectTool(tool))
    this.toolbarUpdate = toolbar.update

    const panel = buildProperties(this.panelState(), {
      onStrokeColor: (color) => this.setStyle({ strokeColor: color }),
      onBackground: (color) => this.setStyle({ background: color }),
      onStrokeWidth: (width) => this.setStyle({ strokeWidth: width }),
    })
    this.panelUpdate = panel.update

    this.chrome = buildChrome(this.chromeState(), this.chromeCallbacks())
    this.chromeUpdate = this.chrome.update

    this.autosave = createAutosave({
      save: () =>
        this.mount.repo.save({
          roomId: this.mount.roomId,
          data: serializeScene(this.scene),
          updatedAt: Date.now(),
          fileName: this.fileName,
        }),
      onStatus: (state) => {
        this.saveState = state
        this.syncUi()
      },
    })

    this.container.append(
      toolbar.el,
      this.chrome.topLeft,
      this.chrome.topRight,
      this.chrome.bottomLeft,
      this.chrome.bottomRight,
      this.chrome.hint,
      panel.el,
    )

    this.fileInput = document.createElement('input')
    this.fileInput.type = 'file'
    this.fileInput.accept = '.whiteboard,.json,application/json'
    this.fileInput.hidden = true
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0]
      this.fileInput.value = ''
      if (file) void this.importBoardFile(file)
    })
    this.container.appendChild(this.fileInput)

    this.theme = (localStorage.getItem('tiny-theme') as Theme) || 'dark'
    this.applyTheme()
    // Default stroke should be visible on the bg (light on dark, dark on light).
    if (this.theme === 'dark') {
      this.style = { ...this.style, strokeColor: '#ffffff' }
    }
    this.updateCursor()
    this.bindEvents()
    this.resize()
    this.syncUi()

    this.peer = startPeerSession(mount.roomId, {
      onMessage: (m) => this.handleRemote(m),
      onStatus: (_role, status) => {
        this.status =
          status === 'connected' ? 'live' : status === 'error' ? 'offline' : 'connecting'
        this.syncUi()
      },
      onConnected: (role) => {
        if (role === 'host') this.broadcastScene()
      },
    })

    if (!mount.initialScene) this.autosave.change()
  }

  get el(): HTMLElement {
    return this.container
  }

  private chromeCallbacks() {
    return {
      onTogglePanel: () => {
        const visible = isPanelVisible(this.tool, this.selectedElement(), this.panelMode)
        this.panelMode = visible ? 'closed' : 'open'
        this.syncUi()
      },
      onSave: () => this.saveBoardFile(),
      onImport: () => {
        this.commitOpenEditor()
        this.fileInput.click()
      },
      onShare: () => {
        const url = buildRoomUrl(this.mount.roomId)
        void copyText(url).then((ok) =>
          this.chrome.flashShare(ok ? 'Link copied' : 'Copy failed'),
        )
      },
      onExportPng: () => this.exportPng(),
      onExportSvg: () => this.exportSvg(),
      onFit: () => this.fitToScene(),
      onToggleTheme: () => {
        const previousDefault = this.theme === 'dark' ? '#ffffff' : '#1e1e1e'
        this.theme = this.theme === 'light' ? 'dark' : 'light'
        localStorage.setItem('tiny-theme', this.theme)
        // Keep the default stroke visible after a theme flip; a colour the user
        // picked explicitly is left alone.
        if (this.style.strokeColor === previousDefault) {
          this.style = {
            ...this.style,
            strokeColor: this.theme === 'dark' ? '#ffffff' : '#1e1e1e',
          }
        }
        this.applyTheme()
        this.render()
        this.syncUi()
      },
      onHome: () => {
        void this.leaveToHome()
      },
      onZoom: (factor: number) => {
        this.viewport = zoomAt(this.viewport, this.center(), factor)
        this.render()
        this.syncUi()
      },
      onZoomReset: () => {
        this.viewport = zoomAt(this.viewport, this.center(), 1 / this.viewport.zoom)
        this.render()
        this.syncUi()
      },
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
    }
  }

  private selectedElement(): ExcalidrawElement | null {
    if (!this.selectedId) return null
    return getElement(this.scene, this.selectedId) ?? null
  }

  private panelState(): PropertiesState {
    const selection = this.selectedElement()
    return {
      tool: this.tool,
      selection,
      mode: this.panelMode,
      values: selection
        ? {
            strokeColor: selection.strokeColor,
            background: selection.background,
            strokeWidth: selection.strokeWidth,
          }
        : { ...this.style },
    }
  }

  private chromeState(): ChromeState {
    const selection = this.selectedElement()
    return {
      status: this.status,
      saveStatus: this.saveState.status,
      saveReason: this.saveState.reason,
      canUndo: this.history.past.length > 0,
      canRedo: this.history.future.length > 0,
      zoomPct: this.viewport.zoom * 100,
      roomId: this.mount.roomId,
      theme: this.theme,
      panelVisible: isPanelVisible(this.tool, selection, this.panelMode),
      hint: hintFor(this.tool, selection),
      hintVisible: !this.isEditingText(),
    }
  }

  private syncUi() {
    this.toolbarUpdate(this.tool)
    this.panelUpdate(this.panelState())
    this.chromeUpdate(this.chromeState())
  }

  private selectTool(tool: UiTool) {
    this.tool = tool
    if (tool !== 'select') this.selectedId = null
    // Keep an explicit hamburger pin; `auto` continues to follow the tool.
    this.updateCursor()
    this.syncUi()
    this.render()
  }

  private updateCursor() {
    this.canvas.dataset.tool = this.tool
  }

  private setStyle(patch: Partial<StyleValues>) {
    this.style = { ...this.style, ...patch }
    const selection = this.selectedElement()
    if (!selection) {
      this.render()
      this.syncUi()
      return
    }
    const op: Op = { type: 'update', id: selection.id, prev: { ...selection }, next: patch }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.broadcastOp(op)
    this.afterChange()
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
    const bg = this.theme === 'dark' ? '#121212' : '#ffffff'
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
      this.syncUi()
    }, { passive: false })
    const sig = this.abort.signal
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        this.saveBoardFile()
        return
      }
      if (this.isEditingText()) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) this.redo()
        else this.undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        this.redo()
        return
      }
      if (e.key === 'Escape') {
        this.selectedId = null
        this.selectTool('select')
        return
      }
      if (e.code === 'Space') {
        this.spaceDown = true
        e.preventDefault()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedId) {
        e.preventDefault()
        this.commitRemove(this.selectedId)
        this.selectedId = null
        this.syncUi()
        return
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const tool = SHORTCUT_TO_TOOL[e.key.toLowerCase()]
        if (tool) {
          e.preventDefault()
          this.selectTool(tool)
        }
      }
    }, { signal: sig })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.spaceDown = false
    }, { signal: sig })
    window.addEventListener('resize', () => this.resize(), { signal: sig })
    window.addEventListener('pagehide', () => {
      void this.autosave.flush()
    }, { signal: sig })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void this.autosave.flush()
    }, { signal: sig })
    // Resize when the canvas is laid out, resized, or first painted.
    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(this.canvas)
    requestAnimationFrame(() => this.resize())
  }

  private isEditingText(): boolean {
    return !!this.container.querySelector('textarea.editing')
  }

  /** Commits an open inline editor so file actions include the visible text. */
  private commitOpenEditor(): void {
    this.finishText?.(true)
  }

  private saveBoardFile(): void {
    this.commitOpenEditor()
    downloadTextFile(this.fileName, serializeBoardFile(this.scene, this.mount.roomId))
  }

  private async importBoardFile(file: File): Promise<void> {
    if (file.size > MAX_FILE_BYTES) {
      await showImportError('This file is too large (max 5 MB).')
      return
    }
    let parsed: ReturnType<typeof parseBoardFile>
    try {
      parsed = parseBoardFile(await file.text())
    } catch (error) {
      await showImportError(
        error instanceof Error ? error.message : "This isn't a Tiny Excalidraw board file.",
      )
      return
    }
    if (this.scene.elements.length > 0 && !(await confirmReplaceBoard())) return

    this.scene = parsed.scene
    this.history = createHistory()
    this.selectedId = null
    this.fileName = fileNameFromSource(
      file.name,
      defaultFileName(this.mount.roomId),
    )
    this.peer.send({ type: 'replace', scene: this.scene })
    this.fitToScene()
    this.render()
    this.syncUi()
    this.autosave.change()
  }

  private toScene(e: { clientX: number; clientY: number }): Point {
    const rect = this.canvas.getBoundingClientRect()
    return screenToScene(this.viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top })
  }

  private onPointerDown(e: PointerEvent) {
    if (e.button === 2 || this.spaceDown || this.tool === 'hand') {
      this.gesture = { kind: 'pan', last: { x: e.clientX, y: e.clientY } }
      this.canvas.classList.add('is-panning')
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
      this.syncUi()
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
        e.preventDefault()
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
          tool:
            this.tool === 'eraser' || this.tool === 'select' || this.tool === 'hand'
              ? null
              : this.tool,
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
    this.canvas.classList.remove('is-panning')
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
    this.syncUi()
    this.autosave.change()
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
      case 'replace':
        this.finishText?.(false)
        this.scene = msg.scene
        this.history = createHistory()
        this.selectedId = null
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
    const fontSize = 24
    const ta = document.createElement('textarea')
    ta.className = 'editing'
    ta.rows = 1
    ta.spellcheck = false
    ta.style.left = `${rect.left + screen.x}px`
    ta.style.top = `${rect.top + screen.y}px`
    ta.style.fontSize = `${fontSize * this.viewport.zoom}px`
    ta.style.color = this.style.strokeColor
    this.container.appendChild(ta)

    let done = false

    const grow = () => {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    }

    const finish = (keep: boolean) => {
      if (done) return
      done = true
      if (this.finishText === finish) this.finishText = null
      const text = ta.value.trim()
      ta.remove()
      this.syncUi()
      if (keep && text) {
        const el = makeTextElement(genId(), at, text, fontSize, this.style)
        this.selectedId = el.id
        this.tool = 'select'
        this.commitAdd(el)
        this.updateCursor()
        this.syncUi()
      }
      this.render()
    }

    ta.addEventListener('input', grow)
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        finish(true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        finish(false)
      }
    })
    ta.addEventListener('blur', () => finish(true))

    this.finishText = finish
    grow()
    ta.focus()
    // The pointer gesture that created the editor must not steal focus back.
    requestAnimationFrame(() => {
      if (!done) ta.focus()
    })
    this.syncUi()
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
    this.syncUi()
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
    const bg = this.theme === 'dark' ? '#121212' : '#ffffff'
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
  }

  private async leaveToHome(): Promise<void> {
    await this.autosave.flush()
    this.destroy()
    history.replaceState(null, '', location.pathname)
    if (this.mount.onHome) this.mount.onHome()
  }

  destroy() {
    void this.autosave.flush()
    this.autosave.dispose()
    this.abort.abort()
    this.ro?.disconnect()
    this.ro = null
    this.peer.close()
    this.container.remove()
  }
}

/**
 * Copy text with the async Clipboard API, falling back to a hidden textarea.
 * Embedded browsers often deny clipboard permissions; the fallback keeps Share
 * usable there without prompting.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to execCommand */
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.top = '-1000px'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  ta.remove()
  return copied
}
