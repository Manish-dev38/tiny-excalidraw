import type { RecentBoard } from './storage'

export interface HomeCallbacks {
  onNewRoom(): void
  onOpenRoom(roomId: string): void
  onDelete(roomId: string): void
}

export function renderHome(boards: RecentBoard[], cb: HomeCallbacks): HTMLElement {
  const root = document.createElement('div')
  root.className = 'home'

  const card = document.createElement('div')
  card.className = 'home-card'

  const logo = document.createElement('div')
  logo.className = 'home-logo'
  logo.innerHTML =
    '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20l4.4-1L19 8.4l-3.4-3.4L5 15.6z"/><path d="M13.8 6.8l3.4 3.4"/></svg>'
  card.appendChild(logo)

  const title = document.createElement('h1')
  title.className = 'home-title'
  title.textContent = 'Tiny Excalidraw'
  card.appendChild(title)

  const subtitle = document.createElement('p')
  subtitle.className = 'home-sub'
  subtitle.textContent = 'Two of you, one board — draw it out together, live.'
  card.appendChild(subtitle)

  const newBtn = document.createElement('button')
  newBtn.className = 'primary-btn'
  newBtn.textContent = 'Create a board'
  newBtn.addEventListener('click', () => cb.onNewRoom())
  card.appendChild(newBtn)

  const hint = document.createElement('p')
  hint.className = 'home-hint'
  hint.textContent = 'Send the link to your friend and start drawing.'
  card.appendChild(hint)

  if (boards.length > 0) {
    const recent = document.createElement('div')
    recent.className = 'recent'
    const heading = document.createElement('h2')
    heading.className = 'recent-heading'
    heading.textContent = 'Recent boards'
    recent.appendChild(heading)

    const list = document.createElement('ul')
    list.className = 'recent-list'
    for (const b of boards) {
      list.appendChild(renderBoardRow(b, cb.onOpenRoom, cb.onDelete))
    }
    recent.appendChild(list)
    card.appendChild(recent)
  }

  root.appendChild(card)
  return root
}

function renderBoardRow(
  board: RecentBoard,
  onOpen: (id: string) => void,
  onDelete: (id: string) => void,
): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'recent-row'

  const open = document.createElement('button')
  open.className = 'recent-open'
  open.textContent = `Board ${board.roomId}`
  open.addEventListener('click', () => onOpen(board.roomId))

  const when = document.createElement('span')
  when.className = 'recent-when'
  when.textContent = new Date(board.updatedAt).toLocaleDateString()

  const del = document.createElement('button')
  del.className = 'recent-delete'
  del.textContent = '✕'
  del.setAttribute('aria-label', 'Delete board')
  del.addEventListener('click', () => onDelete(board.roomId))

  li.append(open, when, del)
  return li
}
