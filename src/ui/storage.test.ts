import { describe, expect, it } from 'vitest'
import {
  MAX_BOARDS,
  createLocalStorageBoardRepository,
  createMemoryBoardRepository,
  migrateLegacyBoards,
  openBoardRepository,
  type BoardStore,
  type StoredBoard,
} from './storage'

function memoryStore(): BoardStore {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const board = (roomId: string, updatedAt = 0, fileName = `${roomId}.whiteboard`): StoredBoard => ({
  roomId,
  data: JSON.stringify({ elements: [] }),
  updatedAt,
  fileName,
})

describe('memory board repository', () => {
  it('starts empty', async () => {
    expect(await createMemoryBoardRepository().list()).toEqual([])
  })

  it('saves, reads, and deletes a board', async () => {
    const repo = createMemoryBoardRepository()
    await repo.save(board('abc'))
    expect(await repo.get('abc')).toEqual(board('abc'))
    await repo.delete('abc')
    expect(await repo.get('abc')).toBeNull()
  })

  it('orders boards newest first', async () => {
    const repo = createMemoryBoardRepository([board('old', 1), board('new', 3), board('mid', 2)])
    expect((await repo.list()).map((b) => b.roomId)).toEqual(['new', 'mid', 'old'])
  })

  it(`caps the recent list at ${MAX_BOARDS}`, async () => {
    const repo = createMemoryBoardRepository(
      Array.from({ length: MAX_BOARDS + 2 }, (_, i) => board(`room-${i}`, i)),
    )
    const listed = await repo.list()
    expect(listed).toHaveLength(MAX_BOARDS)
    expect(listed[0].roomId).toBe(`room-${MAX_BOARDS + 1}`)
  })

  it('stores metadata', async () => {
    const repo = createMemoryBoardRepository()
    await repo.setMeta('lastRoomId', 'abc')
    expect(await repo.getMeta('lastRoomId')).toBe('abc')
    expect(await repo.getMeta('missing')).toBeNull()
  })
})

describe('localStorage board repository', () => {
  it('persists boards and metadata', async () => {
    const store = memoryStore()
    const repo = createLocalStorageBoardRepository(store)
    await repo.save(board('abc', 2))
    await repo.setMeta('lastRoomId', 'abc')

    const reopened = createLocalStorageBoardRepository(store)
    expect(await reopened.get('abc')).toEqual(board('abc', 2))
    expect(await reopened.getMeta('lastRoomId')).toBe('abc')
    await reopened.delete('abc')
    expect(await reopened.list()).toEqual([])
  })

  it('reads legacy boards without filenames and fills a default', async () => {
    const store = memoryStore()
    store.setItem(
      'tiny-excalidraw.boards',
      JSON.stringify([{ roomId: 'legacy', data: '{"elements":[]}', updatedAt: 0 }]),
    )
    const [stored] = await createLocalStorageBoardRepository(store).list()
    expect(stored.fileName).toContain('whiteboard-legacy-')
  })
})

describe('migrateLegacyBoards', () => {
  it('copies missing legacy boards once and leaves the source alone', async () => {
    const legacy = memoryStore()
    legacy.setItem(
      'tiny-excalidraw.boards',
      JSON.stringify([board('one', 1), board('two', 2)]),
    )
    const repo = createMemoryBoardRepository([board('one', 99, 'kept.whiteboard')])

    expect(await migrateLegacyBoards(repo, legacy)).toBe(1)
    expect((await repo.get('one'))?.fileName).toBe('kept.whiteboard')
    expect(await repo.get('two')).not.toBeNull()
    expect(legacy.getItem('tiny-excalidraw.boards')).not.toBeNull()
    expect(await repo.getMeta('migratedFromLocalStorage')).toBe(true)
  })

  it('does not resurrect a board deleted after migration', async () => {
    const legacy = memoryStore()
    legacy.setItem('tiny-excalidraw.boards', JSON.stringify([board('one', 1)]))
    const repo = createMemoryBoardRepository()
    await migrateLegacyBoards(repo, legacy)
    await repo.delete('one')

    expect(await migrateLegacyBoards(repo, legacy)).toBe(0)
    expect(await repo.get('one')).toBeNull()
  })
})

describe('openBoardRepository', () => {
  it('falls back to localStorage with a warning when IndexedDB is unavailable', async () => {
    const opened = await openBoardRepository(memoryStore())
    expect(opened.warning).toContain('IndexedDB')
    await opened.repo.save(board('abc', 1))
    expect(await opened.repo.get('abc')).not.toBeNull()
  })
})
