import type { Theme } from './palette'
import { statusLabel, type ConnectionStatus } from './uiState'
import type { SaveStatus } from './autosave'

export interface ChromeState {
  status: ConnectionStatus
  saveStatus: SaveStatus
  saveReason?: string
  canUndo: boolean
  canRedo: boolean
  zoomPct: number
  roomId: string
  theme: Theme
  panelVisible: boolean
  hint: string
  hintVisible: boolean
}

export interface ChromeCallbacks {
  onTogglePanel(): void
  onSave(): void
  onSaveAs(): void
  onImport(): void
  onShare(): void
  onExportPng(): void
  onExportSvg(): void
  onFit(): void
  onToggleTheme(): void
  onHome(): void
  onZoom(factor: number): void
  onZoomReset(): void
  onUndo(): void
  onRedo(): void
}

export interface Chrome {
  topLeft: HTMLElement
  topRight: HTMLElement
  bottomLeft: HTMLElement
  bottomRight: HTMLElement
  hint: HTMLElement
  update(state: ChromeState): void
  flashShare(message: string): void
}

function svg(paths: string, size = 18): string {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`
}

function iconButton(label: string, html: string, className = 'chrome-btn'): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = className
  b.title = label
  b.setAttribute('aria-label', label)
  b.innerHTML = html
  return b
}

function menuItem(label: string, onClick: () => void, shortcut?: string): HTMLButtonElement {
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'menu-item'
  b.setAttribute('role', 'menuitem')
  const text = document.createElement('span')
  text.textContent = label
  b.appendChild(text)
  if (shortcut) {
    const hint = document.createElement('span')
    hint.className = 'shortcut'
    hint.textContent = shortcut
    b.appendChild(hint)
  }
  b.addEventListener('click', onClick)
  return b
}

const SAVE_LABELS: Record<SaveStatus, string> = {
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Not saved',
}

const HELP_ROWS: Array<[string, string]> = [
  ['V', 'Select'],
  ['H', 'Hand'],
  ['R', 'Rectangle'],
  ['O', 'Ellipse'],
  ['A', 'Arrow'],
  ['P', 'Draw'],
  ['T', 'Text'],
  ['E', 'Eraser'],
  ['Space', 'Pan while dragging'],
  ['Wheel', 'Zoom'],
  ['Ctrl/⌘ Z', 'Undo'],
  ['Ctrl/⌘ ⇧ Z', 'Redo'],
  ['Delete', 'Remove selection'],
  ['Esc', 'Back to select'],
]

export function buildChrome(initial: ChromeState, cb: ChromeCallbacks): Chrome {
  // --- Top-left: hamburger toggles the properties panel. ---
  const topLeft = document.createElement('div')
  topLeft.className = 'top-left'
  const hamburger = iconButton(
    'Toggle properties panel',
    svg('<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>'),
    'chrome-btn hamburger',
  )
  hamburger.setAttribute('aria-expanded', String(initial.panelVisible))
  hamburger.addEventListener('click', () => cb.onTogglePanel())
  topLeft.appendChild(hamburger)

  // --- Top-right: Share + overflow menu. ---
  const topRight = document.createElement('div')
  topRight.className = 'top-actions'

  const saveStatusEl = document.createElement('span')
  saveStatusEl.className = 'save-status saved'
  const saveStatusDot = document.createElement('span')
  saveStatusDot.className = 'save-status-dot'
  saveStatusDot.setAttribute('aria-hidden', 'true')
  const saveStatusLabel = document.createElement('span')
  saveStatusLabel.className = 'save-status-label'
  saveStatusLabel.textContent = 'Saved'
  saveStatusEl.append(saveStatusDot, saveStatusLabel)
  saveStatusEl.title = 'Saved to this browser'

  const save = iconButton(
    'Save board (Ctrl+S)',
    svg(
      '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/>',
    ),
    'chrome-btn save-btn',
  )
  save.addEventListener('click', () => cb.onSave())

  const share = document.createElement('button')
  share.type = 'button'
  share.className = 'share-btn'
  share.title = 'Copy room link'
  const shareIcon = document.createElement('span')
  shareIcon.className = 'share-icon'
  shareIcon.innerHTML = svg(
    '<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M8.1 11l7.8-3.9"/><path d="M8.1 13l7.8 3.9"/>',
  )
  const shareLabel = document.createElement('span')
  shareLabel.className = 'share-label'
  shareLabel.textContent = 'Share'
  const statusDot = document.createElement('span')
  statusDot.className = 'status-dot connecting'
  statusDot.setAttribute('aria-hidden', 'true')
  share.append(shareIcon, shareLabel, statusDot)
  share.addEventListener('click', () => cb.onShare())

  const menuWrap = document.createElement('div')
  menuWrap.className = 'menu-wrap'
  const menuBtn = iconButton(
    'More actions',
    svg('<circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>'),
  )
  menuBtn.setAttribute('aria-haspopup', 'menu')
  menuBtn.setAttribute('aria-expanded', 'false')

  const menu = document.createElement('div')
  menu.className = 'menu-pop'
  menu.setAttribute('role', 'menu')
  menu.hidden = true

  const themeItem = menuItem('Toggle theme', () => {
    closeMenu()
    cb.onToggleTheme()
  })
  menu.append(
    menuItem('Save As…', () => {
      closeMenu()
      cb.onSaveAs()
    }, 'Ctrl/⌘ ⇧ S'),
    menuItem('Import board', () => {
      closeMenu()
      cb.onImport()
    }),
    menuItem('Export PNG', () => {
      closeMenu()
      cb.onExportPng()
    }),
    menuItem('Export SVG', () => {
      closeMenu()
      cb.onExportSvg()
    }),
    menuItem('Fit to screen', () => {
      closeMenu()
      cb.onFit()
    }),
    themeItem,
    menuItem('Back to home', () => {
      closeMenu()
      cb.onHome()
    }),
  )
  const sep = document.createElement('div')
  sep.className = 'menu-sep'
  const room = document.createElement('div')
  room.className = 'menu-room'
  const roomLabel = document.createElement('span')
  roomLabel.textContent = 'Room'
  const roomCode = document.createElement('code')
  roomCode.textContent = initial.roomId
  room.append(roomLabel, roomCode)
  menu.append(sep, room)

  menuWrap.append(menuBtn, menu)
  topRight.append(saveStatusEl, save, share, menuWrap)

  let detachMenu: (() => void) | null = null

  function closeMenu(): void {
    if (menu.hidden) return
    menu.hidden = true
    menuBtn.setAttribute('aria-expanded', 'false')
    detachMenu?.()
    detachMenu = null
  }

  function openMenu(): void {
    menu.hidden = false
    menuBtn.setAttribute('aria-expanded', 'true')
    const onPointer = (e: PointerEvent) => {
      if (!menuWrap.contains(e.target as Node)) closeMenu()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    detachMenu = () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }

  menuBtn.addEventListener('click', () => {
    if (menu.hidden) openMenu()
    else closeMenu()
  })

  // --- Hint under the tool pill. ---
  const hint = document.createElement('div')
  hint.className = 'hint'
  hint.textContent = initial.hint

  // --- Bottom-left: zoom pill + undo/redo pill. ---
  const bottomLeft = document.createElement('div')
  bottomLeft.className = 'bottom-left'

  const zoomPill = document.createElement('div')
  zoomPill.className = 'pill zoom-pill'
  const zoomOut = iconButton('Zoom out', svg('<path d="M6 12h12"/>'), 'pill-btn')
  const zoomPct = document.createElement('button')
  zoomPct.type = 'button'
  zoomPct.className = 'zoom-pct'
  zoomPct.title = 'Reset zoom to 100%'
  zoomPct.setAttribute('aria-label', 'Reset zoom to 100%')
  zoomPct.textContent = `${Math.round(initial.zoomPct)}%`
  const zoomIn = iconButton('Zoom in', svg('<path d="M12 6v12"/><path d="M6 12h12"/>'), 'pill-btn')
  zoomOut.addEventListener('click', () => cb.onZoom(1 / 1.2))
  zoomIn.addEventListener('click', () => cb.onZoom(1.2))
  zoomPct.addEventListener('click', () => cb.onZoomReset())
  zoomPill.append(zoomOut, zoomPct, zoomIn)

  const historyPill = document.createElement('div')
  historyPill.className = 'pill history-pill'
  const undo = iconButton(
    'Undo (Ctrl+Z)',
    svg('<path d="M9 7L4 12l5 5"/><path d="M4 12h10a5 5 0 0 1 0 10"/>'),
    'pill-btn',
  )
  const redo = iconButton(
    'Redo (Ctrl+Shift+Z)',
    svg('<path d="M15 7l5 5-5 5"/><path d="M20 12H10a5 5 0 0 0 0 10"/>'),
    'pill-btn',
  )
  undo.addEventListener('click', () => cb.onUndo())
  redo.addEventListener('click', () => cb.onRedo())
  historyPill.append(undo, redo)

  bottomLeft.append(zoomPill, historyPill)

  // --- Bottom-right: help. ---
  const bottomRight = document.createElement('div')
  bottomRight.className = 'bottom-right'
  const helpWrap = document.createElement('div')
  helpWrap.className = 'menu-wrap'
  const helpBtn = iconButton('Keyboard shortcuts', '<span aria-hidden="true">?</span>', 'help-btn')
  helpBtn.setAttribute('aria-haspopup', 'dialog')
  helpBtn.setAttribute('aria-expanded', 'false')

  const help = document.createElement('div')
  help.className = 'help-pop'
  help.setAttribute('role', 'dialog')
  help.setAttribute('aria-label', 'Keyboard shortcuts')
  help.hidden = true
  const helpTitle = document.createElement('h2')
  helpTitle.textContent = 'Keyboard shortcuts'
  help.appendChild(helpTitle)
  for (const [key, label] of HELP_ROWS) {
    const row = document.createElement('div')
    row.className = 'help-row'
    const kbd = document.createElement('kbd')
    kbd.textContent = key
    const text = document.createElement('span')
    text.textContent = label
    row.append(kbd, text)
    help.appendChild(row)
  }
  helpWrap.append(helpBtn, help)
  bottomRight.appendChild(helpWrap)

  let detachHelp: (() => void) | null = null

  function closeHelp(): void {
    if (help.hidden) return
    help.hidden = true
    helpBtn.setAttribute('aria-expanded', 'false')
    detachHelp?.()
    detachHelp = null
  }

  function openHelp(): void {
    help.hidden = false
    helpBtn.setAttribute('aria-expanded', 'true')
    const onPointer = (e: PointerEvent) => {
      if (!helpWrap.contains(e.target as Node)) closeHelp()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHelp()
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    detachHelp = () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }

  helpBtn.addEventListener('click', () => {
    if (help.hidden) openHelp()
    else closeHelp()
  })

  // --- Share feedback. ---
  let flashTimer: number | undefined
  function flashShare(message: string): void {
    window.clearTimeout(flashTimer)
    shareLabel.textContent = message
    share.classList.add('is-flash')
    flashTimer = window.setTimeout(() => {
      shareLabel.textContent = 'Share'
      share.classList.remove('is-flash')
    }, 1400)
  }

  return {
    topLeft,
    topRight,
    bottomLeft,
    bottomRight,
    hint,
    update(state) {
      undo.disabled = !state.canUndo
      redo.disabled = !state.canRedo
      zoomPct.textContent = `${Math.round(state.zoomPct)}%`
      statusDot.className = `status-dot ${state.status}`
      statusDot.title = statusLabel(state.status)
      saveStatusEl.className = `save-status ${state.saveStatus}`
      saveStatusLabel.textContent = SAVE_LABELS[state.saveStatus]
      saveStatusEl.title =
        state.saveStatus === 'error'
          ? state.saveReason ?? 'Could not save this board.'
          : state.saveStatus === 'saving'
            ? 'Saving to this browser'
            : 'Saved to this browser'
      share.title = `Copy room link · ${statusLabel(state.status)}`
      hamburger.classList.toggle('active', state.panelVisible)
      hamburger.setAttribute('aria-expanded', String(state.panelVisible))
      hint.textContent = state.hint
      hint.hidden = !state.hintVisible
      roomCode.textContent = state.roomId
      themeItem.firstElementChild!.textContent =
        state.theme === 'dark' ? 'Light mode' : 'Dark mode'
    },
    flashShare,
  }
}
