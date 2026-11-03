import type { BoardStore, RecentBoard } from './storage'
import { deleteBoard, loadBoards } from './storage'

export interface HomeCallbacks {
  onNewRoom(): void
  onOpenRoom(roomId: string): void
}

export function renderHome(store: BoardStore, cb: HomeCallbacks): HTMLElement {
  const root = document.createElement('div')
  root.className = 'home'

  const card = document.createElement('div')
  card.className = 'home-card'

  const logo = document.createElement('div')
  logo.className = 'home-logo'
  logo.textContent = '✏️'
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

  const boards = loadBoards(store)
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
      list.appendChild(renderBoardRow(b, store, cb.onOpenRoom))
    }
    recent.appendChild(list)
    card.appendChild(recent)
  }

  root.appendChild(card)
  return root
}

function renderBoardRow(
  board: RecentBoard,
  store: BoardStore,
  onOpen: (id: string) => void,
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
  del.addEventListener('click', () => {
    deleteBoard(store, board.roomId)
    li.remove()
  })

  li.append(open, when, del)
  return li
}
