import type { ExcalidrawElement } from '../core/types'
import { BACKGROUND_COLORS, STROKE_COLORS } from './palette'
import { panelGroups, type PanelMode, type StyleGroup, type UiTool } from './uiState'

export interface StyleValues {
  strokeColor: string
  background: string
  strokeWidth: number
}

export interface PropertiesState {
  tool: UiTool
  selection: ExcalidrawElement | null
  mode: PanelMode
  values: StyleValues
}

export interface PropertiesCallbacks {
  onStrokeColor(color: string): void
  onBackground(color: string): void
  onStrokeWidth(width: number): void
}

export const STROKE_WIDTHS = [1, 2, 4]

export interface PropertiesPanel {
  el: HTMLElement
  update(state: PropertiesState): void
}

function swatch(
  color: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'swatch'
  b.title = label
  b.setAttribute('aria-label', label)
  if (color === 'transparent') {
    b.classList.add('is-transparent')
  } else {
    b.style.background = color
  }
  b.dataset.color = color
  b.addEventListener('click', onClick)
  return b
}

function group(label: string): { el: HTMLElement; body: HTMLElement } {
  const el = document.createElement('section')
  el.className = 'prop-group'
  const title = document.createElement('h3')
  title.className = 'prop-label'
  title.textContent = label
  const body = document.createElement('div')
  el.append(title, body)
  return { el, body }
}

export function buildProperties(
  initial: PropertiesState,
  cb: PropertiesCallbacks,
): PropertiesPanel {
  const el = document.createElement('aside')
  el.className = 'panel'
  el.setAttribute('aria-label', 'Element properties')

  const stroke = group('Stroke')
  const strokeSwatches: HTMLButtonElement[] = []
  for (const color of STROKE_COLORS) {
    const b = swatch(color, `Stroke ${color}`, () => cb.onStrokeColor(color))
    strokeSwatches.push(b)
    stroke.body.appendChild(b)
  }
  stroke.body.classList.add('swatch-grid')

  const background = group('Background')
  const backgroundSwatches: HTMLButtonElement[] = []
  for (const color of BACKGROUND_COLORS) {
    const label = color === 'transparent' ? 'Transparent background' : `Background ${color}`
    const b = swatch(color, label, () => cb.onBackground(color))
    backgroundSwatches.push(b)
    background.body.appendChild(b)
  }
  background.body.classList.add('swatch-grid')

  const width = group('Stroke width')
  width.body.classList.add('width-row')
  const widthButtons: HTMLButtonElement[] = []
  for (const w of STROKE_WIDTHS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'width-btn'
    b.title = `${w}px stroke`
    b.setAttribute('aria-label', `${w}px stroke`)
    b.dataset.width = String(w)
    const line = document.createElement('span')
    line.className = 'w-line'
    line.style.height = `${w}px`
    b.appendChild(line)
    b.addEventListener('click', () => cb.onStrokeWidth(w))
    widthButtons.push(b)
    width.body.appendChild(b)
  }

  const sections: Record<StyleGroup, HTMLElement> = {
    stroke: stroke.el,
    background: background.el,
    strokeWidth: width.el,
  }

  el.append(stroke.el, background.el, width.el)

  function markActive(buttons: HTMLButtonElement[], key: string, value: string): void {
    for (const b of buttons) {
      const active = b.dataset[key] === value
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', String(active))
    }
  }

  function apply(state: PropertiesState): void {
    const visible = new Set(panelGroups(state.tool, state.selection, state.mode))
    el.hidden = visible.size === 0
    for (const [name, section] of Object.entries(sections)) {
      section.hidden = !visible.has(name as StyleGroup)
    }
    if (el.hidden) return
    markActive(strokeSwatches, 'color', state.values.strokeColor)
    markActive(backgroundSwatches, 'color', state.values.background)
    markActive(widthButtons, 'width', String(state.values.strokeWidth))
  }

  apply(initial)

  return { el, update: apply }
}
