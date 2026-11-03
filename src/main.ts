import './style.css'
import { generateRoomId, parseRoomFromHash } from './core/room'
import { deserializeScene } from './core/serialize'
import { loadBoards, type BoardStore } from './ui/storage'
import { renderHome } from './ui/home'
import { CanvasApp } from './ui/canvas'
import type { Scene } from './core/scene'

const app = document.querySelector<HTMLDivElement>('#app')!
const store: BoardStore = localStorage

function navigateToRoom(roomId: string) {
  history.replaceState(null, '', `#room=${encodeURIComponent(roomId)}`)
  let initialScene: Scene | undefined
  const saved = loadBoards(store).find((b) => b.roomId === roomId)
  if (saved) {
    try {
      initialScene = deserializeScene(saved.data)
    } catch {
      initialScene = undefined
    }
  }
  const canvas = new CanvasApp({
    roomId,
    store,
    initialScene,
    onHome: renderHomeScreen,
  })
  app.replaceChildren(canvas.el)
}

function renderHomeScreen() {
  app.replaceChildren(
    renderHome(store, {
      onNewRoom: () => navigateToRoom(generateRoomId()),
      onOpenRoom: (id) => navigateToRoom(id),
    }),
  )
}

window.addEventListener('popstate', () => {
  const id = parseRoomFromHash(location.hash)
  if (id) navigateToRoom(id)
  else renderHomeScreen()
})

const roomId = parseRoomFromHash(location.hash)
if (roomId) navigateToRoom(roomId)
else renderHomeScreen()
