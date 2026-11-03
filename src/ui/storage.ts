export interface RecentBoard {
  roomId: string
  /** Serialized scene JSON. */
  data: string
  updatedAt: number
}

/** Minimal Storage-like interface so logic is testable outside the browser. */
export interface BoardStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const KEY = 'tiny-excalidraw.boards'
const MAX_BOARDS = 10

function readBoards(store: BoardStore): RecentBoard[] {
  const raw = store.getItem(KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RecentBoard[]) : []
  } catch {
    return []
  }
}

function writeBoards(store: BoardStore, boards: RecentBoard[]): void {
  store.setItem(KEY, JSON.stringify(boards))
}

export function loadBoards(store: BoardStore): RecentBoard[] {
  return readBoards(store)
}

/** Upserts a board by roomId (moves it to the front) and caps the total. */
export function saveBoard(store: BoardStore, board: RecentBoard): RecentBoard[] {
  const boards = readBoards(store).filter((b) => b.roomId !== board.roomId)
  const next = [board, ...boards].slice(0, MAX_BOARDS)
  writeBoards(store, next)
  return next
}

export function deleteBoard(store: BoardStore, roomId: string): RecentBoard[] {
  const next = readBoards(store).filter((b) => b.roomId !== roomId)
  writeBoards(store, next)
  return next
}
