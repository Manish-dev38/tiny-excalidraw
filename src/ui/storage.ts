import { defaultFileName } from '../core/boardFile'

export interface StoredBoard {
  roomId: string
  /** Serialized scene JSON. */
  data: string
  updatedAt: number
  fileName: string
}

/** Kept for callers that only need the home-screen row shape. */
export type RecentBoard = StoredBoard

export interface BoardRepository {
  list(): Promise<StoredBoard[]>
  get(roomId: string): Promise<StoredBoard | null>
  save(board: StoredBoard): Promise<void>
  delete(roomId: string): Promise<void>
  getMeta<T = unknown>(key: string): Promise<T | null>
  setMeta(key: string, value: unknown): Promise<void>
}

/** Minimal Storage-like interface so logic is testable outside the browser. */
export interface BoardStore {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const MAX_BOARDS = 10
const LEGACY_BOARDS_KEY = 'tiny-excalidraw.boards'
const META_KEY = 'tiny-excalidraw.meta'
const DB_NAME = 'tiny-excalidraw'
const DB_VERSION = 1
const BOARDS_STORE = 'boards'
const META_STORE = 'meta'

function withFileName(board: Partial<StoredBoard> & { roomId: string; data: string; updatedAt: number }): StoredBoard {
  return {
    ...board,
    fileName:
      board.fileName ??
      defaultFileName(board.roomId, new Date(board.updatedAt || Date.now())),
  }
}

function capBoards(boards: StoredBoard[]): StoredBoard[] {
  return [...boards]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_BOARDS)
}

/** In-memory repository used by tests and as a last-resort fallback. */
export function createMemoryBoardRepository(seed: StoredBoard[] = []): BoardRepository {
  const boards = new Map(seed.map((board) => [board.roomId, board]))
  const meta = new Map<string, unknown>()

  return {
    async list() {
      return capBoards([...boards.values()])
    },
    async get(roomId) {
      return boards.get(roomId) ?? null
    },
    async save(board) {
      boards.set(board.roomId, board)
      const kept = new Set(capBoards([...boards.values()]).map((b) => b.roomId))
      for (const roomId of [...boards.keys()]) {
        if (!kept.has(roomId)) boards.delete(roomId)
      }
    },
    async delete(roomId) {
      boards.delete(roomId)
    },
    async getMeta<T>(key: string) {
      return (meta.get(key) as T | undefined) ?? null
    },
    async setMeta(key, value) {
      meta.set(key, value)
    },
  }
}

/** localStorage repository used when IndexedDB is unavailable. */
export function createLocalStorageBoardRepository(store: BoardStore): BoardRepository {
  const readBoards = (): StoredBoard[] => {
    const raw = store.getItem(LEGACY_BOARDS_KEY)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return (parsed as Array<Partial<StoredBoard>>)
        .filter(
          (board): board is Partial<StoredBoard> & { roomId: string; data: string; updatedAt: number } =>
            typeof board?.roomId === 'string' &&
            typeof board.data === 'string' &&
            typeof board.updatedAt === 'number',
        )
        .map(withFileName)
    } catch {
      return []
    }
  }

  const writeBoards = (boards: StoredBoard[]) => {
    store.setItem(LEGACY_BOARDS_KEY, JSON.stringify(capBoards(boards)))
  }

  const readMeta = (): Record<string, unknown> => {
    const raw = store.getItem(META_KEY)
    if (!raw) return {}
    try {
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return {}
    }
  }

  return {
    async list() {
      return capBoards(readBoards())
    },
    async get(roomId) {
      return readBoards().find((board) => board.roomId === roomId) ?? null
    },
    async save(board) {
      writeBoards([...readBoards().filter((b) => b.roomId !== board.roomId), board])
    },
    async delete(roomId) {
      writeBoards(readBoards().filter((board) => board.roomId !== roomId))
    },
    async getMeta<T>(key: string) {
      return (readMeta()[key] as T | undefined) ?? null
    },
    async setMeta(key, value) {
      store.setItem(META_KEY, JSON.stringify({ ...readMeta(), [key]: value }))
    },
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(BOARDS_STORE)) {
        db.createObjectStore(BOARDS_STORE, { keyPath: 'roomId' })
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade is blocked'))
  })
}

export async function createIndexedDbBoardRepository(): Promise<BoardRepository> {
  if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable')
  const db = await openDatabase()

  const allBoards = async (): Promise<StoredBoard[]> => {
    const tx = db.transaction(BOARDS_STORE, 'readonly')
    return requestResult(tx.objectStore(BOARDS_STORE).getAll() as IDBRequest<StoredBoard[]>)
  }

  const list = async (): Promise<StoredBoard[]> => capBoards(await allBoards())

  const get = async (roomId: string): Promise<StoredBoard | null> => {
    const tx = db.transaction(BOARDS_STORE, 'readonly')
    const board = await requestResult(
      tx.objectStore(BOARDS_STORE).get(roomId) as IDBRequest<StoredBoard | undefined>,
    )
    return board ?? null
  }

  return {
    list,
    get,
    async save(board) {
      const tx = db.transaction(BOARDS_STORE, 'readwrite')
      tx.objectStore(BOARDS_STORE).put(board)
      await transactionDone(tx)
      const all = await allBoards()
      const kept = new Set(capBoards(all).map((b) => b.roomId))
      const removed = all.filter((b) => !kept.has(b.roomId))
      if (removed.length > 0) {
        const trimTx = db.transaction(BOARDS_STORE, 'readwrite')
        for (const old of removed) trimTx.objectStore(BOARDS_STORE).delete(old.roomId)
        await transactionDone(trimTx)
      }
    },
    async delete(roomId) {
      const tx = db.transaction(BOARDS_STORE, 'readwrite')
      tx.objectStore(BOARDS_STORE).delete(roomId)
      await transactionDone(tx)
    },
    async getMeta<T>(key: string) {
      const tx = db.transaction(META_STORE, 'readonly')
      const value = await requestResult(
        tx.objectStore(META_STORE).get(key) as IDBRequest<T | undefined>,
      )
      return value ?? null
    },
    async setMeta(key, value) {
      const tx = db.transaction(META_STORE, 'readwrite')
      tx.objectStore(META_STORE).put(value, key)
      await transactionDone(tx)
    },
  }
}

function readLegacyBoards(store: BoardStore): StoredBoard[] {
  const raw = store.getItem(LEGACY_BOARDS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as Array<Partial<StoredBoard>>)
      .filter(
        (board): board is Partial<StoredBoard> & { roomId: string; data: string; updatedAt: number } =>
          typeof board?.roomId === 'string' &&
          typeof board.data === 'string' &&
          typeof board.updatedAt === 'number',
      )
      .map(withFileName)
  } catch {
    return []
  }
}

/**
 * Copies legacy localStorage boards into the repository once. Only rooms that
 * are missing are copied; legacy data is left untouched as a rollback copy.
 */
export async function migrateLegacyBoards(
  repo: BoardRepository,
  legacy: BoardStore,
): Promise<number> {
  if (await repo.getMeta<boolean>('migratedFromLocalStorage')) return 0
  let migrated = 0
  for (const board of readLegacyBoards(legacy)) {
    if (!(await repo.get(board.roomId))) {
      await repo.save(board)
      migrated++
    }
  }
  await repo.setMeta('migratedFromLocalStorage', true)
  return migrated
}

export interface OpenedBoardRepository {
  repo: BoardRepository
  warning: string | null
}

/**
 * Opens IndexedDB with a localStorage fallback. The fallback survives reloads
 * and is reported once so the app never silently loses persistence.
 */
export async function openBoardRepository(
  legacy: BoardStore,
): Promise<OpenedBoardRepository> {
  try {
    const repo = await createIndexedDbBoardRepository()
    try {
      await migrateLegacyBoards(repo, legacy)
    } catch {
      /* A failed migration must not stop the app from opening. */
    }
    return { repo, warning: null }
  } catch {
    return {
      repo: createLocalStorageBoardRepository(legacy),
      warning: "IndexedDB isn't available. Boards will be saved in local storage instead.",
    }
  }
}
