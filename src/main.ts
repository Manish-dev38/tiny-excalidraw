import './style.css'
import { generateRoomId, parseRoomFromHash } from './core/room'
import { deserializeScene, serializeScene } from './core/serialize'
import {
  defaultFileName,
  fileNameFromSource,
  MAX_FILE_BYTES,
  parseBoardFile,
} from './core/boardFile'
import { openBoardRepository, type BoardRepository } from './ui/storage'
import { renderHome } from './ui/home'
import { CanvasApp } from './ui/canvas'
import { showImportError } from './ui/dialogs'
import type { Scene } from './core/scene'

const app = document.querySelector<HTMLDivElement>('#app')!
const legacyStore = localStorage
let repo: BoardRepository

const homeImportInput = document.createElement('input')
homeImportInput.type = 'file'
homeImportInput.accept = '.whiteboard,.json,application/json'
homeImportInput.hidden = true
homeImportInput.addEventListener('change', () => {
  const file = homeImportInput.files?.[0]
  homeImportInput.value = ''
  if (file) void importBoardFromHome(file)
})
document.body.appendChild(homeImportInput)

async function importBoardFromHome(file: File) {
  if (file.size > MAX_FILE_BYTES) {
    await showImportError('This file is too large (max 5 MB).')
    return
  }
  let parsed: ReturnType<typeof parseBoardFile>
  try {
    parsed = parseBoardFile(await file.text())
  } catch (error) {
    await showImportError(
      error instanceof Error ? error.message : "This isn't a Tiny Excalidraw board file.",
    )
    return
  }

  const roomId = generateRoomId()
  const fileName = fileNameFromSource(file.name, defaultFileName(roomId))
  await repo.save({
    roomId,
    data: serializeScene(parsed.scene),
    updatedAt: Date.now(),
    fileName,
  })
  await navigateToRoom(roomId)
}

async function navigateToRoom(roomId: string) {
  history.replaceState(null, '', `#room=${encodeURIComponent(roomId)}`)
  await repo.setMeta('lastRoomId', roomId).catch(() => {})
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
  await repo.setMeta('lastRoomId', null).catch(() => {})
  const boards = await repo.list()
  app.replaceChildren(
    renderHome(boards, {
      onNewRoom: () => {
        void navigateToRoom(generateRoomId())
      },
      onImport: () => homeImportInput.click(),
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
  if (roomId) {
    await navigateToRoom(roomId)
  } else {
    const lastRoomId = await repo.getMeta<string>('lastRoomId')
    if (lastRoomId) await navigateToRoom(lastRoomId)
    else await renderHomeScreen()
  }
}

void boot()
