import { describe, expect, it } from 'vitest'
import { deleteBoard, loadBoards, saveBoard, type BoardStore } from './storage'

function memoryStore(): BoardStore {
  const data = new Map<string, string>()
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const board = (roomId: string) => ({ roomId, data: '', updatedAt: 0 })

describe('loadBoards', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadBoards(memoryStore())).toEqual([])
  })
})

describe('saveBoard', () => {
  it('adds a board and persists it', () => {
    const store = memoryStore()
    saveBoard(store, board('abc'))
    expect(loadBoards(store)).toHaveLength(1)
    expect(loadBoards(store)[0].roomId).toBe('abc')
  })
  it('updates an existing board by roomId without duplicating', () => {
    const store = memoryStore()
    saveBoard(store, board('abc'))
    saveBoard(store, { ...board('def'), updatedAt: 1 })
    saveBoard(store, { ...board('abc'), updatedAt: 2 })
    const boards = loadBoards(store)
    expect(boards).toHaveLength(2)
    expect(boards[0].roomId).toBe('abc')
    expect(boards[0].updatedAt).toBe(2)
  })
  it('caps the list at the maximum, dropping oldest', () => {
    const store = memoryStore()
    for (let i = 0; i < 12; i++) saveBoard(store, board(`room-${i}`))
    const boards = loadBoards(store)
    expect(boards).toHaveLength(10)
    expect(boards[0].roomId).toBe('room-11')
    expect(boards[9].roomId).toBe('room-2')
  })
})

describe('deleteBoard', () => {
  it('removes a board by roomId', () => {
    const store = memoryStore()
    saveBoard(store, board('abc'))
    saveBoard(store, board('def'))
    deleteBoard(store, 'abc')
    expect(loadBoards(store).map((b) => b.roomId)).toEqual(['def'])
  })
})
