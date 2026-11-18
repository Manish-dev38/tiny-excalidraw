import { SHAPE_KINDS, type ShapeKind } from '../core/types'
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
  laptop: svgIcon([
    '<rect x="5.5" y="5" width="13" height="9.5" rx="1"/>',
    '<path d="M3.5 18.5h17"/>',
  ]),
  database: svgIcon([
    '<ellipse cx="12" cy="6.5" rx="6.5" ry="2.5"/>',
    '<path d="M5.5 6.5v11c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-11"/>',
    '<path d="M5.5 12c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5"/>',
  ]),
  server: svgIcon([
    '<rect x="6" y="4" width="12" height="16" rx="1"/>',
    '<path d="M6 9.3h12"/>',
    '<path d="M6 14.6h12"/>',
    '<path d="M9 6.7h1.5M9 12h1.5M9 17.3h1.5"/>',
  ]),
  cloud: svgIcon([
    '<path d="M7 17.5a4 4 0 0 1-.4-8 5.5 5.5 0 0 1 10.5-1.2 3.6 3.6 0 0 1 .9 7.1 3 3 0 0 1-1 .6H7z"/>',
  ]),
  user: svgIcon([
    '<circle cx="12" cy="8.2" r="3.2"/>',
    '<path d="M5.8 19c0-3.4 2.8-5.4 6.2-5.4s6.2 2 6.2 5.4"/>',
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
  laptop: 'Laptop',
  database: 'Database',
  server: 'Server',
  cloud: 'Cloud',
  user: 'User',
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
      const shortcut = TOOL_SHORTCUTS[tool] ?? ''
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'tb-btn'
      b.title = shortcut ? `${LABELS[tool]} (${shortcut})` : LABELS[tool]
      b.setAttribute('aria-label', LABELS[tool])
      b.setAttribute('aria-pressed', String(tool === initial))
      b.innerHTML = `${ICONS[tool]}${shortcut ? `<span class="tb-key" aria-hidden="true">${shortcut}</span>` : ''}`
      b.addEventListener('click', () => onSelect(tool))
      buttons.set(tool, b)
      groupEl.appendChild(b)
    }
    el.appendChild(groupEl)
  }

  // Infrastructure shapes live in a picker so the tool pill stays compact.
  const shapesGroup = document.createElement('div')
  shapesGroup.className = 'tb-group tb-shapes-group'
  const shapesButton = document.createElement('button')
  shapesButton.type = 'button'
  shapesButton.className = 'tb-btn tb-shapes-btn'
  shapesButton.title = 'Shapes'
  shapesButton.setAttribute('aria-label', 'Shapes')
  shapesButton.setAttribute('aria-haspopup', 'menu')
  shapesButton.setAttribute('aria-expanded', 'false')
  shapesButton.innerHTML = svgIcon([
    '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/>',
    '<circle cx="17.5" cy="7" r="3.5"/>',
    '<path d="M3.5 14.5h7v6h-7z"/>',
    '<path d="M14 14.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>',
  ])

  const menu = document.createElement('div')
  menu.className = 'tb-menu'
  menu.setAttribute('role', 'menu')
  menu.hidden = true

  const shapeButtons = new Map<ShapeKind, HTMLButtonElement>()
  for (const kind of SHAPE_KINDS) {
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'tb-menu-item'
    b.setAttribute('role', 'menuitemradio')
    b.setAttribute('aria-label', LABELS[kind])
    b.innerHTML = `${ICONS[kind]}<span>${LABELS[kind]}</span>`
    b.addEventListener('click', () => {
      closeMenu()
      onSelect(kind)
    })
    shapeButtons.set(kind, b)
    menu.appendChild(b)
  }

  let menuClosed = true
  function closeMenu() {
    menuClosed = true
    menu.hidden = true
    shapesButton.setAttribute('aria-expanded', 'false')
  }

  shapesButton.addEventListener('click', (e) => {
    e.stopPropagation()
    menuClosed = !menuClosed
    menu.hidden = menuClosed
    shapesButton.setAttribute('aria-expanded', String(!menuClosed))
  })
  const closeOnOutside = (e: MouseEvent) => {
    if (!menuClosed && !menu.contains(e.target as Node)) closeMenu()
  }
  const closeOnEscape = (e: KeyboardEvent) => {
    if (!menuClosed && e.key === 'Escape') closeMenu()
  }
  window.addEventListener('pointerdown', closeOnOutside)
  window.addEventListener('keydown', closeOnEscape)

  shapesGroup.append(shapesButton, menu)
  el.appendChild(shapesGroup)

  return {
    el,
    update(tool) {
      for (const [candidate, button] of buttons) {
        const active = candidate === tool
        button.classList.toggle('active', active)
        button.setAttribute('aria-pressed', String(active))
      }
      const shapesActive = SHAPE_KINDS.includes(tool as ShapeKind)
      shapesButton.classList.toggle('active', shapesActive)
      shapesButton.setAttribute('aria-pressed', String(shapesActive))
      for (const [kind, button] of shapeButtons) {
        const active = kind === tool
        button.classList.toggle('active', active)
        button.setAttribute('aria-checked', String(active))
      }
    },
  }
}
