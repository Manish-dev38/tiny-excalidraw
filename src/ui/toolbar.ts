import type { Tool } from '../collab/protocol'
import { STROKE_COLORS } from './palette'

export type UiTool = Tool | 'eraser'

export interface ToolbarState {
  tool: UiTool
  canUndo: boolean
  canRedo: boolean
  zoomPct: number
  strokeColor: string
}

export interface ToolbarCallbacks {
  onSelectTool(tool: UiTool): void
  onSelectStrokeColor(color: string): void
  onUndo(): void
  onRedo(): void
  onZoomDelta(factor: number): void
  onZoomReset(): void
  onFit(): void
  onToggleTheme(): void
  onExportPng(): void
  onExportSvg(): void
  onCopyLink(): void
}

function svgIcon(paths: string[]): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</svg>`
}

const ICONS: Record<UiTool, string> = {
  pen: svgIcon(['<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/>', '<path d="M13 6l3 3"/>']),
  rectangle: svgIcon(['<rect x="4" y="5" width="15" height="13"/>']),
  ellipse: svgIcon(['<ellipse cx="12" cy="12" rx="7.5" ry="6"/>']),
  arrow: svgIcon(['<path d="M4 16L18 6"/>', '<path d="M12 5l6 1-1 6"/>']),
  text: svgIcon(['<path d="M5 6h14"/>', '<path d="M12 6v12"/>', '<path d="M8 18h8"/>']),
  eraser: svgIcon(['<path d="M7 20L3 16l8-9 6 6-4 7z"/>', '<path d="M6 18h12"/>']),
}

const TOOL_ORDER: UiTool[] = ['pen', 'rectangle', 'ellipse', 'arrow', 'text', 'eraser']

function button(
  label: string,
  onClick: () => void,
  active = false,
  disabled = false,
): HTMLButtonElement {
  const b = document.createElement('button')
  b.className = 'tb-btn'
  b.title = label
  b.setAttribute('aria-label', label)
  if (active) b.classList.add('active')
  if (disabled) b.disabled = true
  b.addEventListener('click', onClick)
  return b
}

export function buildToolbar(
  initial: ToolbarState,
  cb: ToolbarCallbacks,
): { el: HTMLElement; update: (s: ToolbarState) => void } {
  const el = document.createElement('div')
  el.className = 'toolbar'

  const toolButtons = new Map<UiTool, HTMLButtonElement>()
  const toolGroup = document.createElement('div')
  toolGroup.className = 'tb-group'
  for (const t of TOOL_ORDER) {
    const b = button(`${t} tool`, () => cb.onSelectTool(t), initial.tool === t)
    b.innerHTML = ICONS[t]
    toolButtons.set(t, b)
    toolGroup.appendChild(b)
  }
  el.appendChild(toolGroup)

  const undo = button('Undo (Ctrl+Z)', () => cb.onUndo(), false, !initial.canUndo)
  undo.innerHTML = svgIcon(['<path d="M9 7L4 12l5 5"/>', '<path d="M4 12h10a5 5 0 0 1 0 10"/>'])
  const redo = button('Redo (Ctrl+Shift+Z)', () => cb.onRedo(), false, !initial.canRedo)
  redo.innerHTML = svgIcon(['<path d="M15 7l5 5-5 5"/>', '<path d="M20 12H10a5 5 0 0 0 0 10"/>'])
  const undoRedo = document.createElement('div')
  undoRedo.className = 'tb-group'
  undoRedo.append(undo, redo)
  el.appendChild(undoRedo)

  const zoomOut = button('Zoom out', () => cb.onZoomDelta(1 / 1.2))
  zoomOut.innerHTML = svgIcon(['<path d="M15 12H8"/>'])
  const zoomIn = button('Zoom in', () => cb.onZoomDelta(1.2))
  zoomIn.innerHTML = svgIcon(['<path d="M12 8v8M8 12h8"/>'])
  const zoomLabel = document.createElement('span')
  zoomLabel.className = 'tb-zoom'
  zoomLabel.textContent = `${Math.round(initial.zoomPct)}%`
  const zoomReset = button('Reset zoom', () => cb.onZoomReset())
  zoomReset.innerHTML = svgIcon(['<circle cx="12" cy="12" r="7"/>', '<path d="M9 12h6"/>'])
  const fit = button('Fit to screen', () => cb.onFit())
  fit.innerHTML = svgIcon(['<path d="M4 9V4h5"/>', '<path d="M20 9V4h-5"/>', '<path d="M4 15v5h5"/>', '<path d="M20 15v5h-5"/>'])
  const zoomGroup = document.createElement('div')
  zoomGroup.className = 'tb-group'
  zoomGroup.append(zoomOut, zoomLabel, zoomIn, zoomReset, fit)
  el.appendChild(zoomGroup)

  // Stroke color swatches.
  const colorGroup = document.createElement('div')
  colorGroup.className = 'tb-group tb-colors'
  for (const c of STROKE_COLORS) {
    const swatch = document.createElement('button')
    swatch.className = 'swatch'
    swatch.style.background = c
    swatch.title = c
    if (c === initial.strokeColor) swatch.classList.add('active')
    swatch.addEventListener('click', () => cb.onSelectStrokeColor(c))
    colorGroup.appendChild(swatch)
  }
  el.appendChild(colorGroup)

  const exportBtn = button('Export', () => {})
  exportBtn.innerHTML = svgIcon(['<path d="M12 3v12"/>', '<path d="M8 11l4 4 4-4"/>', '<path d="M4 19h16"/>'])

  const png = button('Download PNG', () => cb.onExportPng())
  png.innerHTML = '<span class="sub">PNG</span>'
  const svg = button('Download SVG', () => cb.onExportSvg())
  svg.innerHTML = '<span class="sub">SVG</span>'
  const exportMenu = document.createElement('div')
  exportMenu.className = 'tb-export'
  exportMenu.append(exportBtn, png, svg)
  el.appendChild(exportMenu)

  const link = button('Copy room link', () => cb.onCopyLink())
  link.innerHTML = svgIcon(['<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/>', '<path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'])
  const theme = button('Toggle theme', () => cb.onToggleTheme())
  theme.innerHTML = svgIcon(['<circle cx="12" cy="12" r="5"/>', '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'])
  const rightGroup = document.createElement('div')
  rightGroup.className = 'tb-group tb-right'
  rightGroup.append(link, theme)
  el.appendChild(rightGroup)

  return {
    el,
    update(s) {
      for (const [t, b] of toolButtons) b.classList.toggle('active', s.tool === t)
      undo.disabled = !s.canUndo
      redo.disabled = !s.canRedo
      zoomLabel.textContent = `${Math.round(s.zoomPct)}%`
      const swatches = colorGroup.querySelectorAll('.swatch')
      swatches.forEach((sw) =>
        sw.classList.toggle('active', (sw as HTMLButtonElement).style.background === s.strokeColor),
      )
    },
  }
}
