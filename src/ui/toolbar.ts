import { TOOL_GROUPS, TOOL_SHORTCUTS, type UiTool } from './uiState'

function svgIcon(paths: string[]): string {
  return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.join('')}</svg>`
}

const ICONS: Record<UiTool, string> = {
  hand: svgIcon([
    '<path d="M9 11.5V6.6a1.5 1.5 0 0 1 3 0v4.9"/>',
    '<path d="M12 11.5V5.6a1.5 1.5 0 0 1 3 0v5.9"/>',
    '<path d="M15 11.5V7.6a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1a5 5 0 0 1-3.7-1.6L4 14.2a1.6 1.6 0 0 1 2.4-2.1L9 14.2"/>',
  ]),
  select: svgIcon(['<path d="M6 4l12 7.2-5.6 1.1L10 18.5z"/>']),
  rectangle: svgIcon(['<rect x="4.5" y="6" width="15" height="12" rx="0.6"/>']),
  ellipse: svgIcon(['<ellipse cx="12" cy="12" rx="8" ry="6.4"/>']),
  arrow: svgIcon(['<path d="M4.5 16.5L19 6.5"/>', '<path d="M13 6h6v6"/>']),
  pen: svgIcon([
    '<path d="M4 20l4.4-1L19 8.4l-3.4-3.4L5 15.6z"/>',
    '<path d="M13.8 6.8l3.4 3.4"/>',
  ]),
  text: svgIcon(['<path d="M6 19L12 5l6 14"/>', '<path d="M8.5 14h7"/>']),
  eraser: svgIcon([
    '<path d="M8.5 20l-4.8-4.8 8.6-9.4 6.2 6.2-6.2 8z"/>',
    '<path d="M6.2 17.6h12"/>',
  ]),
}

const LABELS: Record<UiTool, string> = {
  hand: 'Hand tool',
  select: 'Select tool',
  rectangle: 'Rectangle tool',
  ellipse: 'Ellipse tool',
  arrow: 'Arrow tool',
  pen: 'Draw tool',
  text: 'Text tool',
  eraser: 'Eraser tool',
}

export interface Toolbar {
  el: HTMLElement
  update(tool: UiTool): void
}

export function buildToolbar(initial: UiTool, onSelect: (tool: UiTool) => void): Toolbar {
  const el = document.createElement('div')
  el.className = 'toolbar'
  el.setAttribute('role', 'toolbar')
  el.setAttribute('aria-label', 'Drawing tools')

  const buttons = new Map<UiTool, HTMLButtonElement>()

  for (const group of TOOL_GROUPS) {
    const groupEl = document.createElement('div')
    groupEl.className = 'tb-group'
    for (const tool of group) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'tb-btn'
      b.title = `${LABELS[tool]} (${TOOL_SHORTCUTS[tool]})`
      b.setAttribute('aria-label', LABELS[tool])
      b.setAttribute('aria-pressed', String(tool === initial))
      b.innerHTML = `${ICONS[tool]}<span class="tb-key" aria-hidden="true">${TOOL_SHORTCUTS[tool]}</span>`
      b.addEventListener('click', () => onSelect(tool))
      buttons.set(tool, b)
      groupEl.appendChild(b)
    }
    el.appendChild(groupEl)
  }

  return {
    el,
    update(tool) {
      for (const [candidate, button] of buttons) {
        const active = candidate === tool
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      }
    },
  }
}
