import './style.css'
import { generateRoomId, parseRoomFromHash } from './core/room'
import { deserializeScene } from './core/serialize'
import { openBoardRepository, type BoardRepository } from './ui/storage'
import { renderHome } from './ui/home'
import { CanvasApp } from './ui/canvas'
import type { Scene } from './core/scene'

const app = document.querySelector<HTMLDivElement>('#app')!
const legacyStore = localStorage
let repo: BoardRepository

async function navigateToRoom(roomId: string) {
  history.replaceState(null, '', `#room=${encodeURIComponent(roomId)}`)
  let initialScene: Scene | undefined
  const saved = await repo.get(roomId)
  if (saved) {
    try {
      initialScene = deserializeScene(saved.data)
    } catch {
      initialScene = undefined
    }
  }
  const canvas = new CanvasApp({
    roomId,
    repo,
    initialScene,
    fileName: saved?.fileName,
    onHome: () => {
      void renderHomeScreen()
    },
  })
  app.replaceChildren(canvas.el)
}

async function renderHomeScreen() {
  const boards = await repo.list()
  app.replaceChildren(
    renderHome(boards, {
      onNewRoom: () => {
        void navigateToRoom(generateRoomId())
      },
      onOpenRoom: (id) => {
        void navigateToRoom(id)
      },
      onDelete: (id) => {
        void repo.delete(id).then(() => renderHomeScreen())
      },
    }),
  )
}

function showStorageWarning(message: string) {
  const warning = document.createElement('div')
  warning.className = 'storage-warning'
  warning.setAttribute('role', 'status')
  warning.textContent = message
  warning.addEventListener('click', () => warning.remove())
  document.body.appendChild(warning)
  window.setTimeout(() => warning.remove(), 8000)
}

async function boot() {
  const opened = await openBoardRepository(legacyStore)
  repo = opened.repo
  if (opened.warning) showStorageWarning(opened.warning)

  window.addEventListener('popstate', () => {
    const id = parseRoomFromHash(location.hash)
    if (id) void navigateToRoom(id)
    else void renderHomeScreen()
  })

  const roomId = parseRoomFromHash(location.hash)
  if (roomId) await navigateToRoom(roomId)
  else await renderHomeScreen()
}

void boot()
