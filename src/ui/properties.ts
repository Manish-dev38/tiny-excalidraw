import type { ArrowheadStyle, ExcalidrawElement, TextAlign } from '../core/types'
import { FONT_SIZES } from '../core/textLayout'
import { BACKGROUND_COLORS, STROKE_COLORS } from './palette'
import { panelGroups, type PanelMode, type StyleGroup, type UiTool } from './uiState'

export interface StyleValues {
  strokeColor: string
  background: string
  strokeWidth: number
  dashed: boolean
  fontSize: number
  textAlign: TextAlign
  startArrowhead: ArrowheadStyle | null
  endArrowhead: ArrowheadStyle | null
}

export type StyleKey = keyof StyleValues

export interface PropertiesState {
  tool: UiTool
  selection: ExcalidrawElement | null
  selectionCount: number
  mode: PanelMode
  values: StyleValues
  /** Properties whose selected values disagree; shown as "Mixed". */
  mixed: ReadonlySet<StyleKey>
}

export interface PropertiesCallbacks {
  onStrokeColor(color: string): void
  onBackground(color: string): void
  onStrokeWidth(width: number): void
  onDashed(dashed: boolean): void
  onFontSize(size: number): void
  onTextAlign(align: TextAlign): void
  onStartArrowhead(style: ArrowheadStyle | null): void
  onEndArrowhead(style: ArrowheadStyle | null): void
}

export const STROKE_WIDTHS = [1, 2, 4]
export const TEXT_ALIGNS: TextAlign[] = ['left', 'center', 'right']
export const ARROWHEADS: { value: ArrowheadStyle | null; label: string }[] = [
  { value: null, label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'triangle', label: 'Triangle' },
]

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

function group(label: string): {
  el: HTMLElement
  body: HTMLElement
  mixed: HTMLElement
} {
  const el = document.createElement('section')
  el.className = 'prop-group'
  const title = document.createElement('h3')
  title.className = 'prop-label'
  title.textContent = label
  const mixed = document.createElement('span')
  mixed.className = 'prop-mixed'
  mixed.textContent = 'Mixed'
  mixed.hidden = true
  title.appendChild(mixed)
  const body = document.createElement('div')
  el.append(title, body)
  return { el, body, mixed }
}

function optionButton(
  className: string,
  label: string,
  onClick: () => void,
): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = className
  b.title = label
  b.setAttribute('aria-label', label)
  b.addEventListener('click', onClick)
  return b
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

  const width = group('Stroke width')
  width.body.classList.add('width-row')
  const widthButtons: HTMLButtonElement[] = []
  for (const w of STROKE_WIDTHS) {
    const b = optionButton('width-btn', `${w}px stroke`, () => cb.onStrokeWidth(w))
    b.dataset.width = String(w)
    const line = document.createElement('span')
    line.className = 'w-line'
    line.style.height = `${w}px`
    b.appendChild(line)
    widthButtons.push(b)
    width.body.appendChild(b)
  }

  const lineStyle = group('Line style')
  lineStyle.body.classList.add('line-row')
  const dashedButtons: HTMLButtonElement[] = []
  for (const dashed of [false, true]) {
    const b = optionButton(
      'line-btn',
      dashed ? 'Dashed line' : 'Solid line',
      () => cb.onDashed(dashed),
    )
    b.dataset.dashed = String(dashed)
    const preview = document.createElement('span')
    preview.className = dashed ? 'l-line is-dashed' : 'l-line'
    b.appendChild(preview)
    dashedButtons.push(b)
    lineStyle.body.appendChild(b)
  }

  const background = group('Background')
  const backgroundSwatches: HTMLButtonElement[] = []
  for (const color of BACKGROUND_COLORS) {
    const label = color === 'transparent' ? 'Transparent background' : `Background ${color}`
    const b = swatch(color, label, () => cb.onBackground(color))
    backgroundSwatches.push(b)
    background.body.appendChild(b)
  }
  background.body.classList.add('swatch-grid')

  const font = group('Font')
  font.body.classList.add('font-row')
  const fontButtons: HTMLButtonElement[] = []
  for (const size of FONT_SIZES) {
    const b = optionButton('font-btn', `${size}px font`, () => cb.onFontSize(size))
    b.dataset.font = String(size)
    b.style.fontSize = `${Math.max(11, Math.round(size * 0.6))}px`
    b.textContent = 'Aa'
    fontButtons.push(b)
    font.body.appendChild(b)
  }

  const align = group('Align')
  align.body.classList.add('align-row')
  const alignButtons: HTMLButtonElement[] = []
  for (const value of TEXT_ALIGNS) {
    const b = optionButton('align-btn', `Align ${value}`, () => cb.onTextAlign(value))
    b.dataset.align = value
    const icon = document.createElement('span')
    icon.className = `align-icon align-${value}`
    for (const lineWidth of [14, 9, 12]) {
      const line = document.createElement('i')
      line.style.width = `${lineWidth}px`
      icon.appendChild(line)
    }
    b.appendChild(icon)
    alignButtons.push(b)
    align.body.appendChild(b)
  }

  const heads = group('Arrowheads')
  heads.body.classList.add('head-rows')
  const headButtons = new Map<'start' | 'end', HTMLButtonElement[]>()
  for (const which of ['start', 'end'] as const) {
    const row = document.createElement('div')
    row.className = 'head-row'
    const label = document.createElement('span')
    label.className = 'head-label'
    label.textContent = which === 'start' ? 'Start' : 'End'
    row.appendChild(label)
    const buttons: HTMLButtonElement[] = []
    for (const head of ARROWHEADS) {
      const b = optionButton(
        `head-btn head-${head.value ?? 'none'}`,
        `${which === 'start' ? 'Start' : 'End'} ${head.label.toLowerCase()}`,
        () =>
          which === 'start' ? cb.onStartArrowhead(head.value) : cb.onEndArrowhead(head.value),
      )
      b.dataset.head = head.value ?? 'none'
      const icon = document.createElement('span')
      icon.className = 'head-icon'
      if (head.value === 'triangle') icon.textContent = '▶'
      else if (head.value === 'arrow') icon.textContent = '›'
      else icon.textContent = '—'
      b.appendChild(icon)
      buttons.push(b)
      row.appendChild(b)
    }
    headButtons.set(which, buttons)
    heads.body.appendChild(row)
  }

  const sections: Record<StyleGroup, HTMLElement> = {
    stroke: stroke.el,
    strokeWidth: width.el,
    lineStyle: lineStyle.el,
    background: background.el,
    fontSize: font.el,
    textAlign: align.el,
    arrowheads: heads.el,
  }
  const mixedBadges: Partial<Record<StyleGroup, HTMLElement>> = {
    stroke: stroke.mixed,
    strokeWidth: width.mixed,
    lineStyle: lineStyle.mixed,
    background: background.mixed,
    fontSize: font.mixed,
    textAlign: align.mixed,
    arrowheads: heads.mixed,
  }

  // Panel order mirrors Excalidraw: stroke, width, style, fill, font, align, heads.
  el.append(
    stroke.el,
    width.el,
    lineStyle.el,
    background.el,
    font.el,
    align.el,
    heads.el,
  )

  function markActive(buttons: HTMLButtonElement[], key: string, value: string): void {
    for (const b of buttons) {
      const active = b.dataset[key] === value
      b.classList.toggle('active', active)
      b.setAttribute('aria-pressed', String(active))
    }
  }

  function isMixed(state: PropertiesState, key: StyleKey): boolean {
    return state.mixed.has(key)
  }

  function apply(state: PropertiesState): void {
    const visible = new Set(panelGroups(state.tool, state.selection, state.mode))
    el.hidden = visible.size === 0
    for (const [name, section] of Object.entries(sections)) {
      section.hidden = !visible.has(name as StyleGroup)
    }
    if (el.hidden) return

    const v = state.values
    markActive(strokeSwatches, 'color', isMixed(state, 'strokeColor') ? '' : v.strokeColor)
    markActive(backgroundSwatches, 'color', isMixed(state, 'background') ? '' : v.background)
    markActive(widthButtons, 'width', isMixed(state, 'strokeWidth') ? '' : String(v.strokeWidth))
    markActive(dashedButtons, 'dashed', isMixed(state, 'dashed') ? '' : String(v.dashed))
    markActive(fontButtons, 'font', isMixed(state, 'fontSize') ? '' : String(v.fontSize))
    markActive(alignButtons, 'align', isMixed(state, 'textAlign') ? '' : v.textAlign)

    const startButtons = headButtons.get('start') ?? []
    const endButtons = headButtons.get('end') ?? []
    markActive(
      startButtons,
      'head',
      isMixed(state, 'startArrowhead') ? '' : (v.startArrowhead ?? 'none'),
    )
    markActive(
      endButtons,
      'head',
      isMixed(state, 'endArrowhead') ? '' : (v.endArrowhead ?? 'none'),
    )

    for (const [name, badge] of Object.entries(mixedBadges)) {
      const keys: Record<string, StyleKey[]> = {
        stroke: ['strokeColor'],
        strokeWidth: ['strokeWidth'],
        lineStyle: ['dashed'],
        background: ['background'],
        fontSize: ['fontSize'],
        textAlign: ['textAlign'],
        arrowheads: ['startArrowhead', 'endArrowhead'],
      }
      badge.hidden = !keys[name]?.some((key) => isMixed(state, key))
    }
  }

  apply(initial)

  return { el, update: apply }
}
