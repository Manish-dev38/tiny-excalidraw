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
  normalizeFileName,
  parseBoardFile,
  serializeBoardFile,
} from '../core/boardFile'
import { downloadTextFile } from './download'
import { confirmReplaceBoard, showImportError, showSaveAsDialog } from './dialogs'
import { createAutosave, type Autosave, type AutosaveState } from './autosave'
import { bboxOf } from '../core/geometry'
import type { Point } from '../core/types'
import type { RectLikeType } from '../core/types'
import { eraserHitTest } from './eraser'
import { clipboard, cloneElements } from './clipboard'
import { textEditOp } from './textEdit'
import {
  bindArrowEnds,
  isBoxShape,
  resnapArrow,
} from '../core/binding'
import {
  boundArrows,
  boundText,
  containerLabelWidth,
  deletionSet,
  isContainer,
  reflowLabel,
  withBoundText,
  withoutBoundText,
  type ContainerElement,
} from '../core/containers'
import {
  HANDLE_HIT_SLOP,
  HANDLE_SIZE,
  groupFontScale,
  handlePoints,
  hitHandle,
  resizeBox,
  resizeElement,
  resizeTextBox,
  selectionBox,
  type Box,
  type HandlePoint,
  type ResizeHandle,
} from '../core/resize'
import {
  DEFAULT_FONT_SIZE,
  MIN_TEXT_WIDTH,
  TEXT_FONT_FAMILY,
  TEXT_LINE_HEIGHT,
  textBlock,
} from '../core/textLayout'
import { makeArrowElement, makePenElement, makeShapeElement, makeTextElement } from './factories'
import type { DrawStyle } from './factories'
import { startPeerSession, type PeerSession } from '../collab/peer'
import type { ClientMessage } from '../collab/protocol'
import { clearCanvas, drawElement, renderPath, renderShape } from './render'
import { buildToolbar } from './toolbar'
import { buildProperties } from './properties'
import type { PropertiesState, StyleKey, StyleValues } from './properties'
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
import { hitTestTop, translateElement, acceptsStyle, elementsInRect } from './select'
import type { ExcalidrawElement } from '../core/types'
import type { ArrowElement, RectLikeElement, TextElement } from '../core/types'
import { assignColor, availablePeers, formatName } from './participants'

const MIN_DRAG = 2

function genId(): string {
  return `el-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** Structural comparison used to skip no-op update ops. */
function sameElement(a: ExcalidrawElement, b: ExcalidrawElement): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type Gesture =
  | { kind: 'pen'; points: Point[] }
  | {
      kind: 'shape'
      type: RectLikeType | 'arrow'
      start: Point
      current: Point
    }
  | { kind: 'eraser'; points: Point[] }
  | { kind: 'pan'; last: Point }
  | { kind: 'marquee'; start: Point; current: Point }
  | {
      kind: 'move'
      /** One entry per selected element, as they were when the move started. */
      items: { id: string; original: ExcalidrawElement }[]
      /** Bound labels/arrows that follow the moved containers. */
      followups: { id: string; original: ExcalidrawElement }[]
      startScene: Point
      lastScene: Point
      moved: boolean
    }
  | {
      kind: 'resize'
      handle: ResizeHandle
      items: { id: string; original: ExcalidrawElement }[]
      followups: { id: string; original: ExcalidrawElement }[]
      startBox: Box
      box: Box
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
  private style: DrawStyle = {
    strokeColor: '#1e1e1e',
    background: 'transparent',
    strokeWidth: 2,
    dashed: false,
    fontSize: DEFAULT_FONT_SIZE,
    textAlign: 'left',
    startArrowhead: null,
    endArrowhead: 'arrow',
  }
  private theme: Theme = 'light'
  private gesture: Gesture = null
  private spaceDown = false
  private peer: PeerSession
  private remoteCursor: { x: number; y: number; name: string; color: string } | null = null
  /** Ordered selection; the last id is the primary element for panel values. */
  private selectedIds: string[] = []
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
  /** How many times the same clipboard has been pasted; fans out the offset. */
  private pasteCount = 0

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
      onDashed: (dashed) => this.setStyle({ dashed }),
      onFontSize: (fontSize) => this.setStyle({ fontSize }),
      onTextAlign: (textAlign) => this.setStyle({ textAlign }),
      onStartArrowhead: (startArrowhead) => this.setStyle({ startArrowhead }),
      onEndArrowhead: (endArrowhead) => this.setStyle({ endArrowhead }),
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
      onSaveAs: () => {
        void this.saveBoardAsFile()
      },
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
    const id = this.selectedIds[this.selectedIds.length - 1]
    if (!id) return null
    return getElement(this.scene, id) ?? null
  }

  private selectedElements(): ExcalidrawElement[] {
    return this.selectedIds
      .map((id) => getElement(this.scene, id))
      .filter((el): el is ExcalidrawElement => !!el)
  }

  private panelState(): PropertiesState {
    const selection = this.selectedElement()
    const els = this.selectedElements()
    const defaults = this.defaultStyleValues()
    const values: StyleValues = { ...defaults }
    const mixed = new Set<StyleKey>()

    const aggregate = <T>(key: StyleKey, list: T[], fallback: T): void => {
      if (list.length === 0) {
        values[key] = fallback as never
        return
      }
      const first = list[0]
      const differs = list.some((value) => value !== first)
      values[key] = (first ?? fallback) as never
      if (differs) mixed.add(key)
    }

    if (els.length > 0) {
      aggregate('strokeColor', els.map((el) => el.strokeColor), defaults.strokeColor)
      aggregate('background', els.map((el) => el.background), defaults.background)
      aggregate('strokeWidth', els.map((el) => el.strokeWidth), defaults.strokeWidth)
      aggregate('dashed', els.map((el) => el.dashed ?? false), defaults.dashed)

      const textHosts = els
        .map((el) => this.textHostFor(el))
        .filter((el): el is TextElement => !!el)
      aggregate('fontSize', textHosts.map((el) => el.fontSize), defaults.fontSize)
      aggregate('textAlign', textHosts.map((el) => el.textAlign), defaults.textAlign)

      const arrows = els.filter((el): el is ArrowElement => el.type === 'arrow')
      aggregate(
        'startArrowhead',
        arrows.map((el) => el.startArrowhead ?? null),
        defaults.startArrowhead,
      )
      aggregate(
        'endArrowhead',
        arrows.map((el) => el.endArrowhead ?? 'arrow'),
        defaults.endArrowhead,
      )
    }

    return {
      tool: this.tool,
      selection,
      selectionCount: els.length,
      mode: this.panelMode,
      values,
      mixed,
    }
  }

  private defaultStyleValues(): StyleValues {
    return {
      strokeColor: this.style.strokeColor,
      background: this.style.background,
      strokeWidth: this.style.strokeWidth,
      dashed: this.style.dashed,
      fontSize: this.style.fontSize ?? DEFAULT_FONT_SIZE,
      textAlign: this.style.textAlign ?? 'left',
      startArrowhead: this.style.startArrowhead ?? null,
      endArrowhead: this.style.endArrowhead ?? 'arrow',
    }
  }

  /** Text element that owns a selection's font/alignment values. */
  private textHostFor(el: ExcalidrawElement): TextElement | null {
    if (el.type === 'text') return el
    if (!isContainer(el)) return null
    return boundText(this.scene.elements, el.id)
  }

  /** Selection plus the labels owned by selected shapes/arrows. */
  private styleTargets(key: StyleKey): ExcalidrawElement[] {
    const els = this.selectedElements()
    if (key !== 'fontSize' && key !== 'textAlign') return els
    const targets: ExcalidrawElement[] = []
    for (const el of els) {
      const host = this.textHostFor(el)
      if (host) targets.push(host)
    }
    return targets
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
    if (tool !== 'select') this.selectedIds = []
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
    const selection = this.selectedElements()
    if (selection.length === 0) {
      this.render()
      this.syncUi()
      return
    }
    const key = Object.keys(patch)[0] as StyleKey
    const value = patch[key]
    const targets = this.styleTargets(key).filter((el) => acceptsStyle(el.type, key))
    const ops: Op[] = targets.map((el): Op => ({
      type: 'update',
      id: el.id,
      prev: { ...el },
      next: this.stylePatchFor(el, key, value),
    }))
    if (ops.length === 0) {
      this.render()
      this.syncUi()
      return
    }
    const op: Op = ops.length === 1 ? ops[0] : { type: 'batch', ops }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.broadcastOp(op)
    this.afterChange()
  }

  /** Builds the field patch for one style change, re-wrapping text if needed. */
  private stylePatchFor(
    el: ExcalidrawElement,
    key: StyleKey,
    value: StyleValues[StyleKey] | undefined,
  ): Partial<ExcalidrawElement> {
    if (el.type === 'text' && key === 'fontSize') {
      const fontSize = typeof value === 'number' ? value : el.fontSize
      const maxWidth = el.containerId
        ? el.width
        : el.autoResize
          ? null
          : el.width
      const block = textBlock(el.originalText ?? el.text, fontSize, {
        maxWidth,
        lineHeight: el.lineHeight ?? TEXT_LINE_HEIGHT,
      })
      return {
        fontSize,
        text: block.lines.join('\n'),
        width: maxWidth === null ? block.width : Math.max(MIN_TEXT_WIDTH, maxWidth),
        height: block.height,
      }
    }
    return { [key]: value } as Partial<ExcalidrawElement>
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
    if (this.selectedIds.length > 0) this.drawSelection()
  }

  private drawGesture(g: NonNullable<Gesture>) {
    if (g.kind === 'pen') {
      renderPath(this.ctx, g.points, this.style)
    } else if (g.kind === 'shape') {
      renderShape(this.ctx, g.type, g.start, g.current, this.style)
    } else if (g.kind === 'eraser') {
      renderPath(this.ctx, g.points, { strokeColor: '#868e96', strokeWidth: 8 })
    } else if (g.kind === 'marquee') {
      const zoom = this.viewport.zoom
      const x = Math.min(g.start.x, g.current.x)
      const y = Math.min(g.start.y, g.current.y)
      const w = Math.abs(g.current.x - g.start.x)
      const h = Math.abs(g.current.y - g.start.y)
      this.ctx.save()
      this.ctx.strokeStyle = '#1971c2'
      this.ctx.fillStyle = 'rgba(25, 113, 194, 0.05)'
      this.ctx.lineWidth = 1 / zoom
      this.ctx.setLineDash([4 / zoom, 3 / zoom])
      this.ctx.beginPath()
      this.ctx.rect(x, y, w, h)
      this.ctx.fill()
      this.ctx.stroke()
      this.ctx.restore()
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
    const els = this.selectedElements()
    if (els.length === 0) return
    const box = selectionBox(els)
    const zoom = this.viewport.zoom
    this.ctx.save()
    this.ctx.strokeStyle = '#1971c2'
    this.ctx.fillStyle = 'rgba(25, 113, 194, 0.06)'
    this.ctx.lineWidth = 1 / zoom
    this.ctx.setLineDash([4 / zoom, 3 / zoom])
    this.ctx.beginPath()
    this.ctx.rect(box.x, box.y, box.width, box.height)
    this.ctx.fill()
    this.ctx.stroke()
    this.ctx.restore()

    // Arrows have no resize handles (resizing happens through their shapes).
    if (els.every((el) => el.type === 'arrow')) return
    const textOnly = els.length === 1 && els[0].type === 'text'
    const size = HANDLE_SIZE / zoom
    this.ctx.save()
    this.ctx.fillStyle = '#ffffff'
    this.ctx.strokeStyle = '#1971c2'
    this.ctx.lineWidth = 1.5 / zoom
    for (const handle of handlePoints(box, textOnly)) {
      this.ctx.beginPath()
      this.ctx.rect(handle.x - size / 2, handle.y - size / 2, size, size)
      this.ctx.fill()
      this.ctx.stroke()
    }
    this.ctx.restore()
  }

  /** Current resize handles for the selection, if it has any. */
  private selectionHandles(): HandlePoint[] {
    const els = this.selectedElements()
    if (els.length === 0 || els.every((el) => el.type === 'arrow')) return []
    return handlePoints(selectionBox(els), els.length === 1 && els[0].type === 'text')
  }

  private bindEvents() {
    const c = this.canvas
    c.addEventListener('pointerdown', (e) => this.onPointerDown(e))
    c.addEventListener('pointermove', (e) => this.onPointerMove(e))
    c.addEventListener('pointerup', () => this.onPointerUp())
    c.addEventListener('pointercancel', () => this.onPointerUp())
    c.addEventListener('dblclick', (e) => {
      if (this.isEditingText()) return
      const hit = hitTestTop(this.scene.elements, this.toScene(e))
      if (!hit) return
      e.preventDefault()
      if (hit.type === 'text') {
        this.beginText({ x: hit.x, y: hit.y }, hit)
        return
      }
      if (isContainer(hit)) this.editContainerLabel(hit)
    })
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
        if (e.shiftKey) void this.saveBoardAsFile()
        else this.saveBoardFile()
        return
      }
      if (this.isEditingText()) return
      const target = e.target as HTMLElement | null
      const inTextfield =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
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
        this.selectedIds = []
        this.selectTool('select')
        return
      }
      if (!inTextfield && e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = this.selectedElement()
        if (el?.type === 'text') {
          e.preventDefault()
          this.beginText({ x: el.x, y: el.y }, el)
          return
        }
        if (el && isContainer(el)) {
          e.preventDefault()
          this.editContainerLabel(el)
          return
        }
      }
      // Clipboard shortcuts skip text fields (dialogs keep native behaviour).
      if (!inTextfield && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        if (this.copySelection()) e.preventDefault()
        return
      }
      if (!inTextfield && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') {
        if (this.copySelection()) {
          e.preventDefault()
          this.removeSelected()
        }
        return
      }
      if (!inTextfield && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        this.pasteClipboard()
        return
      }
      if (!inTextfield && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        this.duplicateSelection()
        return
      }
      if (e.code === 'Space') {
        this.spaceDown = true
        e.preventDefault()
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && this.selectedIds.length > 0) {
        e.preventDefault()
        this.removeSelected()
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

  private async saveBoardAsFile(): Promise<void> {
    this.commitOpenEditor()
    const chosen = await showSaveAsDialog(this.fileName)
    if (chosen === null) return
    this.fileName = normalizeFileName(
      chosen,
      defaultFileName(this.mount.roomId),
    )
    this.autosave.change()
    await this.autosave.flush()
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
    this.selectedIds = []
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
      const handle = hitHandle(
        this.selectionHandles(),
        p,
        HANDLE_HIT_SLOP / this.viewport.zoom,
      )
      if (handle && !e.shiftKey) {
        const els = this.selectedElements()
        const items = els.map((el) => ({ id: el.id, original: el }))
        const box = selectionBox(els)
        this.gesture = {
          kind: 'resize',
          handle: handle.handle,
          items,
          followups: this.followupsFor(items),
          startBox: box,
          box,
          moved: false,
        }
        this.canvas.style.cursor = handle.cursor
        this.syncUi()
        this.render()
        this.canvas.setPointerCapture(e.pointerId)
        return
      }

      const rawHit = hitTestTop(this.scene.elements, p)
      const hit = rawHit ? this.resolveSelectable(rawHit) : null
      if (hit) {
        if (e.shiftKey) {
          // Shift-click toggles membership; no move gesture on a toggle.
          this.selectedIds = this.selectedIds.includes(hit.id)
            ? this.selectedIds.filter((id) => id !== hit.id)
            : [...this.selectedIds, hit.id]
          this.syncUi()
          this.render()
          this.canvas.setPointerCapture(e.pointerId)
          return
        }
        if (!this.selectedIds.includes(hit.id)) {
          this.selectedIds = [hit.id]
        }
        const items = this.selectedElements().map((el) => ({ id: el.id, original: el }))
        this.gesture = {
          kind: 'move',
          items,
          followups: this.followupsFor(items),
          startScene: p,
          lastScene: p,
          moved: false,
        }
      } else if (e.shiftKey) {
        // Shift-click on empty canvas keeps the current selection.
        this.syncUi()
        this.render()
        this.canvas.setPointerCapture(e.pointerId)
        return
      } else {
        this.selectedIds = []
        this.gesture = { kind: 'marquee', start: p, current: p }
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
      case 'laptop':
      case 'database':
      case 'server':
      case 'cloud':
      case 'user':
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
      const p = this.toScene(e)
      this.updateHoverCursor(p)
      if (this.peer.status === 'connected') {
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
    } else if (this.gesture.kind === 'marquee') {
      this.gesture.current = p
    } else if (this.gesture.kind === 'move') {
      const g = this.gesture
      const dx = p.x - g.startScene.x
      const dy = p.y - g.startScene.y
      if (Math.hypot(dx, dy) >= MIN_DRAG) g.moved = true
      if (g.moved) this.applyMove(g, dx, dy)
      g.lastScene = p
    } else if (this.gesture.kind === 'resize') {
      const g = this.gesture
      this.applyResize(g, p, e.shiftKey, e.altKey)
      g.moved = true
    }
    this.render()
  }

  /** Live move: translate the selection, then reflow labels and bound arrows. */
  private applyMove(
    g: Extract<NonNullable<Gesture>, { kind: 'move' }>,
    dx: number,
    dy: number,
  ) {
    const movedShapes = new Map<string, RectLikeElement>()
    for (const { id, original } of g.items) {
      const moved = translateElement(original, { dx, dy })
      this.scene = updateElement(this.scene, id, moved as Partial<ExcalidrawElement>)
      if (isBoxShape(moved)) movedShapes.set(id, moved)
    }
    for (const { id, original } of g.followups) {
      if (original.type === 'text' && original.containerId) {
        const container = this.containerAfterMove(original.containerId, g, dx, dy)
        if (!container) continue
        const next = reflowLabel(original, container)
        this.scene = updateElement(this.scene, id, next as Partial<ExcalidrawElement>)
        continue
      }
      if (original.type === 'arrow') {
        const snapped = resnapArrow(original, movedShapes)
        if (snapped) {
          this.scene = updateElement(this.scene, id, this.arrowPatch(snapped))
        }
      }
    }
  }

  private containerAfterMove(
    containerId: string,
    g: Extract<NonNullable<Gesture>, { kind: 'move' }>,
    dx: number,
    dy: number,
  ): ContainerElement | null {
    const item = g.items.find((entry) => entry.id === containerId)
    if (item) {
      const moved = translateElement(item.original, { dx, dy })
      return isContainer(moved) ? moved : null
    }
    return null
  }

  /** Live resize: scale selected geometry, reflow labels, resnap bound arrows. */
  private applyResize(
    g: Extract<NonNullable<Gesture>, { kind: 'resize' }>,
    p: Point,
    shift: boolean,
    alt: boolean,
  ) {
    const singleText =
      g.items.length === 1 && g.items[0].original.type === 'text'
    const nextBox = singleText
      ? resizeTextBox(g.startBox, g.handle, p)
      : resizeBox(g.startBox, g.handle, p, {
          shift,
          alt,
          minWidth: singleText ? MIN_TEXT_WIDTH : undefined,
        })
    g.box = nextBox
    const fontScale = g.items.length > 1 ? groupFontScale(g.startBox, nextBox) : 1
    const containers = new Map<string, ContainerElement>()
    const shapes = new Map<string, RectLikeElement>()

    for (const { id, original } of g.items) {
      const next = resizeElement(original, g.startBox, nextBox, {
        fontScale,
        group: g.items.length > 1,
      })
      this.scene = updateElement(this.scene, id, next as Partial<ExcalidrawElement>)
      if (isContainer(next)) containers.set(id, next)
      if (isBoxShape(next)) shapes.set(id, next)
    }

    for (const { id, original } of g.followups) {
      if (original.type === 'text' && original.containerId) {
        const container = containers.get(original.containerId)
        if (!container) continue
        const next = reflowLabel(original, container)
        this.scene = updateElement(this.scene, id, next as Partial<ExcalidrawElement>)
      } else if (original.type === 'arrow') {
        const snapped = resnapArrow(original, shapes)
        if (snapped) {
          this.scene = updateElement(this.scene, id, this.arrowPatch(snapped))
        }
      }
    }
  }

  private updateHoverCursor(p: Point) {
    if (this.tool !== 'select' || this.isEditingText()) {
      this.canvas.style.cursor = ''
      return
    }
    const handle = hitHandle(
      this.selectionHandles(),
      p,
      HANDLE_HIT_SLOP / this.viewport.zoom,
    )
    this.canvas.style.cursor = handle ? handle.cursor : ''
  }

  private onPointerUp() {
    const g = this.gesture
    this.gesture = null
    this.canvas.classList.remove('is-panning')
    this.canvas.style.cursor = ''
    if (!g) return
    if (g.kind === 'pan') return
    if (g.kind === 'pen') {
      if (g.points.length > 1) {
        this.commitCreated(makePenElement(genId(), g.points, this.style))
      }
    } else if (g.kind === 'shape') {
      if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) >= MIN_DRAG) {
        const el =
          g.type === 'arrow'
            ? bindArrowEnds(
                makeArrowElement(genId(), g.start, g.current, this.style),
                this.scene.elements,
              )
            : makeShapeElement(genId(), g.type, g.start, g.current, this.style)
        this.commitCreated(el)
      }
    } else if (g.kind === 'eraser') {
      if (g.points.length > 0) {
        const ids = eraserHitTest(this.scene, g.points, 8)
        for (const id of ids) this.commitRemove(id)
      }
    } else if (g.kind === 'marquee') {
      if (Math.hypot(g.current.x - g.start.x, g.current.y - g.start.y) >= MIN_DRAG) {
        const hits = elementsInRect(this.scene.elements, g.start, g.current)
        this.selectedIds = this.normalizeSelection(hits.map((el) => el.id))
        this.syncUi()
      }
    } else if (g.kind === 'move') {
      if (g.moved) this.commitMove(g)
    } else if (g.kind === 'resize') {
      if (g.moved) this.commitResize(g)
    }
    this.render()
  }

  private commitMove(g: Extract<NonNullable<Gesture>, { kind: 'move' }>) {
    const dx = g.lastScene.x - g.startScene.x
    const dy = g.lastScene.y - g.startScene.y
    const movingIds = new Set(g.items.map((item) => item.id))
    const ops: Op[] = g.items.map(({ id, original }): Op => {
      let next = translateElement(original, { dx, dy })
      if (next.type === 'arrow') {
        // Keep bindings that follow the selection; detach from everything else.
        const detached = { ...next }
        if (detached.startBinding && !movingIds.has(detached.startBinding.elementId)) {
          delete detached.startBinding
        }
        if (detached.endBinding && !movingIds.has(detached.endBinding.elementId)) {
          delete detached.endBinding
        }
        next = detached
      }
      return {
        type: 'update',
        id,
        prev: original,
        next: next.type === 'arrow' ? this.arrowPatch(next) : next,
      }
    })
    for (const { id, original } of g.followups) {
      const final = getElement(this.scene, id)
      if (!final || sameElement(original, final)) continue
      ops.push({
        type: 'update',
        id,
        prev: original,
        next: final.type === 'arrow' ? this.arrowPatch(final) : final,
      })
    }
    this.commitOps(ops, false)
  }

  private commitResize(g: Extract<NonNullable<Gesture>, { kind: 'resize' }>) {
    const ops: Op[] = []
    for (const { id, original } of g.items) {
      const final = getElement(this.scene, id)
      if (!final || sameElement(original, final)) continue
      ops.push({
        type: 'update',
        id,
        prev: original,
        next: final.type === 'arrow' ? this.arrowPatch(final) : final,
      })
    }
    for (const { id, original } of g.followups) {
      const final = getElement(this.scene, id)
      if (!final || sameElement(original, final)) continue
      ops.push({
        type: 'update',
        id,
        prev: original,
        next: final.type === 'arrow' ? this.arrowPatch(final) : final,
      })
    }
    this.commitOps(ops, false)
  }

  /** Applies and records a set of ops as one undoable step. */
  private commitOps(ops: Op[], keepSelection: boolean) {
    if (ops.length === 0) return
    const op: Op = ops.length === 1 ? ops[0] : { type: 'batch', ops }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.broadcastOp(op)
    if (!keepSelection) {
      this.selectedIds = this.selectedIds.filter((id) => !!getElement(this.scene, id))
    }
    this.afterChange()
  }

  private commitAdd(element: import('../core/types').ExcalidrawElement) {
    const op: Op = { type: 'add', element }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.peer.send({ type: 'add', element })
    this.afterChange()
  }

  /**
   * Commits a freshly drawn element and selects it, switching to the select
   * tool. Style changes in the properties panel then apply to the shape just
   * drawn instead of silently only affecting future shapes.
   */
  private commitCreated(element: import('../core/types').ExcalidrawElement) {
    this.selectedIds = [element.id]
    this.tool = 'select'
    this.updateCursor()
    this.commitAdd(element)
  }

  private commitRemove(id: string) {
    if (!getElement(this.scene, id)) return
    this.applyRemoval(deletionSet(this.scene.elements, [id]))
  }

  /** Removes the whole selection as one undoable step. */
  private removeSelected() {
    const els = this.selectedElements()
    if (els.length === 0) return
    this.applyRemoval(deletionSet(this.scene.elements, els.map((el) => el.id)))
  }

  /**
   * Removes elements plus their labels/arrows, and clears container references
   * that point at deleted labels. The whole cascade is one undoable step.
   */
  private applyRemoval(doomed: ReadonlySet<string>) {
    const ops: Op[] = []
    for (const el of this.scene.elements) {
      if (doomed.has(el.id)) {
        ops.push({ type: 'remove', element: el })
        continue
      }
      if (!isContainer(el) || !el.boundElements) continue
      const dropped = el.boundElements.filter((ref) => doomed.has(ref.id))
      if (dropped.length === 0) continue
      let next: ContainerElement = el
      for (const ref of dropped) next = withoutBoundText(next, ref.id)
      ops.push({ type: 'update', id: el.id, prev: el, next })
    }
    this.commitOps(ops, false)
  }

  /** Labels and bound arrows that follow a moved/resized selection. */
  private followupsFor(
    items: { id: string; original: ExcalidrawElement }[],
  ): { id: string; original: ExcalidrawElement }[] {
    const selected = new Set(items.map((item) => item.id))
    const out = new Map<string, ExcalidrawElement>()
    for (const { original } of items) {
      if (!isContainer(original)) continue
      const label = boundText(this.scene.elements, original.id)
      if (label && !selected.has(label.id)) out.set(label.id, label)
      if (!isBoxShape(original)) continue
      for (const arrow of boundArrows(this.scene.elements, original.id)) {
        if (!selected.has(arrow.id)) out.set(arrow.id, arrow)
      }
    }
    return [...out].map(([id, original]) => ({ id, original }))
  }

  /** Clicking a label selects its container, like Excalidraw. */
  private resolveSelectable(el: ExcalidrawElement): ExcalidrawElement {
    if (el.type === 'text' && el.containerId) {
      const container = getElement(this.scene, el.containerId)
      if (container && isContainer(container)) return container
    }
    return el
  }

  /** Replaces selected labels with their containers and preserves z-order. */
  private normalizeSelection(ids: string[]): string[] {
    const set = new Set(ids)
    for (const id of [...set]) {
      const el = getElement(this.scene, id)
      if (el?.type === 'text' && el.containerId) {
        const container = getElement(this.scene, el.containerId)
        if (container && isContainer(container)) {
          set.delete(id)
          set.add(container.id)
        }
      }
    }
    return this.scene.elements.filter((el) => set.has(el.id)).map((el) => el.id)
  }

  private editContainerLabel(container: ContainerElement) {
    this.selectedIds = [container.id]
    const label = boundText(this.scene.elements, container.id)
    if (label) {
      this.beginText({ x: label.x, y: label.y }, label)
      return
    }
    this.beginText(
      { x: container.x, y: container.y },
      undefined,
      container,
    )
  }

  /**
   * Patch for an arrow update. Absent binding keys are written explicitly as
   * `undefined` so `updateElement` removes them (merge alone cannot).
   */
  private arrowPatch(arrow: ArrowElement): Partial<ExcalidrawElement> {
    return { ...arrow, startBinding: arrow.startBinding, endBinding: arrow.endBinding }
  }

  /** Copies the selection to the internal clipboard. Returns false if empty. */
  private copySelection(): boolean {
    const els = this.selectedElements()
    if (els.length === 0) return false
    clipboard.write(els)
    this.pasteCount = 0
    return true
  }

  /** Pastes clipboard contents with a cumulative offset so copies fan out. */
  private pasteClipboard() {
    const source = clipboard.read()
    if (source.length === 0) return
    this.pasteCount += 1
    const offset = 20 * this.pasteCount
    this.insertElements(cloneElements(source, () => genId(), offset, offset))
  }

  /** Duplicates the current selection right next to it. */
  private duplicateSelection() {
    const els = this.selectedElements()
    if (els.length === 0) return
    this.insertElements(cloneElements(els, () => genId(), 20, 20))
  }

  /** Inserts elements as one undoable step and selects them. */
  private insertElements(els: import('../core/types').ExcalidrawElement[]) {
    const ops: Op[] = els.map((el): Op => ({ type: 'add', element: el }))
    const op: Op = ops.length === 1 ? ops[0] : { type: 'batch', ops }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.broadcastOp(op)
    this.selectedIds = this.normalizeSelection(els.map((el) => el.id))
    this.tool = 'select'
    this.updateCursor()
    this.afterChange()
  }

  private broadcastOp(op: Op) {
    if (op.type === 'batch') {
      for (const child of op.ops) this.broadcastOp(child)
    } else if (op.type === 'add') {
      this.peer.send({ type: 'add', element: op.element })
    } else if (op.type === 'remove') {
      this.peer.send({ type: 'remove', id: op.element.id })
    } else {
      // JSON drops undefined keys, so removals travel as null and are
      // converted back in `handleRemote`.
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(op.next)) {
        patch[key] = value === undefined ? null : value
      }
      this.peer.send({ type: 'update', id: op.id, patch: patch as Partial<ExcalidrawElement> })
    }
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
      case 'update': {
        // `null` means "remove this optional property" (see broadcastOp).
        const patch: Record<string, unknown> = { ...msg.patch }
        for (const key of Object.keys(patch)) {
          if (patch[key] === null) patch[key] = undefined
        }
        this.scene = updateElement(this.scene, msg.id, patch as Partial<ExcalidrawElement>)
        break
      }
      case 'remove':
        this.scene = removeElement(this.scene, msg.id)
        break
      case 'replace':
        this.finishText?.(false)
        this.scene = msg.scene
        this.history = createHistory()
        this.selectedIds = []
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

  /**
   * Opens the inline editor. Text elements edit in place; containers without a
   * label get a new bound label positioned by `layoutLabel`.
   */
  private beginText(at: Point, existing?: TextElement, container?: ContainerElement) {
    // Never stack editors: commit whatever is open first.
    this.finishText?.(true)
    const rect = this.canvas.getBoundingClientRect()
    const fontSize = existing?.fontSize ?? this.style.fontSize ?? DEFAULT_FONT_SIZE
    const align =
      existing?.textAlign ??
      (container ? 'center' : (this.style.textAlign ?? 'left'))
    const provisional =
      !existing && container ? this.newLabel(container, '', fontSize, align) : null
    const anchor = existing
      ? { x: existing.x, y: existing.y }
      : provisional
        ? { x: provisional.x, y: provisional.y }
        : at
    const fixedWidth = existing
      ? existing.containerId || existing.autoResize === false
        ? Math.max(MIN_TEXT_WIDTH, existing.width)
        : null
      : provisional
        ? provisional.width
        : null
    const screen = sceneToScreen(this.viewport, anchor)
    const zoom = this.viewport.zoom

    const ta = document.createElement('textarea')
    ta.className = 'editing'
    ta.rows = 1
    ta.spellcheck = false
    ta.style.left = `${rect.left + screen.x}px`
    ta.style.top = `${rect.top + screen.y}px`
    ta.style.fontSize = `${fontSize * zoom}px`
    ta.style.fontFamily = TEXT_FONT_FAMILY
    ta.style.lineHeight = String(TEXT_LINE_HEIGHT)
    ta.style.textAlign = align
    ta.style.color = existing ? existing.strokeColor : this.style.strokeColor
    ta.style.minWidth = fixedWidth === null ? `${MIN_TEXT_WIDTH * zoom}px` : '0px'
    if (fixedWidth !== null) ta.style.width = `${fixedWidth * zoom + 10}px`
    ta.value = existing ? (existing.originalText ?? existing.text) : ''
    this.container.appendChild(ta)

    let done = false

    const grow = () => {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
      if (fixedWidth === null) {
        ta.style.width = '0px'
        ta.style.width = `${Math.max(MIN_TEXT_WIDTH * zoom, ta.scrollWidth + 10)}px`
      }
    }

    const finish = (keep: boolean) => {
      if (done) return
      done = true
      if (this.finishText === finish) this.finishText = null
      const raw = ta.value
      ta.remove()
      this.syncUi()
      if (existing) {
        if (keep) this.commitTextEdit(existing, raw)
        this.render()
        return
      }
      const text = raw.trim()
      if (keep && text) {
        if (container) this.commitLabel(container, text, fontSize, align)
        else this.commitCreated(makeTextElement(genId(), at, text, fontSize, this.style))
      }
      this.render()
    }

    ta.addEventListener('input', grow)
    ta.addEventListener('keydown', (e) => {
      // Enter inserts a newline like Excalidraw; Escape/click-away commit.
      if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault()
        finish(true)
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

  /** A new label laid out inside its container (used for editor placement). */
  private newLabel(
    container: ContainerElement,
    raw: string,
    fontSize: number,
    align: TextElement['textAlign'],
  ): TextElement {
    const el = makeTextElement(genId(), { x: container.x, y: container.y }, raw, fontSize, {
      ...this.style,
      textAlign: align,
    })
    el.containerId = container.id
    el.autoResize = false
    el.textAlign = align
    el.verticalAlign = 'middle'
    return reflowLabel(el, container)
  }

  /** Adds a new label to a container as one undoable step. */
  private commitLabel(
    container: ContainerElement,
    raw: string,
    fontSize: number,
    align: TextElement['textAlign'],
  ) {
    const label = this.newLabel(container, raw, fontSize, align)
    const updated = withBoundText(container, label.id)
    const ops: Op[] = [
      { type: 'add', element: label },
      { type: 'update', id: container.id, prev: container, next: updated },
    ]
    this.scene = applyOp(this.scene, { type: 'batch', ops })
    this.history = record(this.history, ops.length === 1 ? ops[0] : { type: 'batch', ops })
    this.broadcastOp(ops.length === 1 ? ops[0] : { type: 'batch', ops })
    this.selectedIds = [container.id]
    this.tool = 'select'
    this.updateCursor()
    this.afterChange()
  }

  /** Applies an inline edit to an existing text element. */
  private commitTextEdit(existing: TextElement, raw: string) {
    this.tool = 'select'
    this.updateCursor()
    const container = existing.containerId
      ? getElement(this.scene, existing.containerId)
      : null
    const containerEl = container && isContainer(container) ? container : null
    const op = textEditOp(existing, raw, {
      maxWidth: containerEl ? containerLabelWidth(containerEl) : undefined,
    })
    if (!op) {
      this.selectedIds = containerEl ? [containerEl.id] : [existing.id]
      this.syncUi()
      return
    }
    if (op.type === 'remove') {
      this.selectedIds = containerEl ? [containerEl.id] : []
      this.applyRemoval(deletionSet(this.scene.elements, [existing.id]))
      return
    }
    if (op.type !== 'update') {
      this.selectedIds = containerEl ? [containerEl.id] : [existing.id]
      this.syncUi()
      return
    }
    if (containerEl) {
      const nextText = { ...existing, ...op.next } as TextElement
      const laid = reflowLabel(nextText, containerEl)
      op.next = {
        ...op.next,
        text: laid.text,
        x: laid.x,
        y: laid.y,
        width: laid.width,
        height: laid.height,
      }
    }
    this.scene = applyOp(this.scene, op)
    this.history = record(this.history, op)
    this.broadcastOp(op)
    this.selectedIds = containerEl ? [containerEl.id] : [existing.id]
    this.afterChange()
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
