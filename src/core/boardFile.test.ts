import { describe, expect, it } from 'vitest'
import {
  BOARD_FORMAT,
  BOARD_VERSION,
  buildBoardFile,
  defaultFileName,
  fileNameFromSource,
  normalizeFileName,
  serializeBoardFile,
} from './boardFile'
import { createScene } from './scene'
import type { ExcalidrawElement } from './types'

const rect: ExcalidrawElement = {
  id: 'rect-1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 120,
  height: 80,
  strokeColor: '#ff0000',
  background: 'transparent',
  strokeWidth: 2,
}

const text: ExcalidrawElement = {
  id: 'text-1',
  type: 'text',
  x: 0,
  y: 0,
  text: 'Hello',
  fontSize: 24,
  strokeColor: '#ffffff',
  background: 'transparent',
  strokeWidth: 1,
}

const scene = { elements: [rect, text] }

describe('buildBoardFile', () => {
  it('wraps the scene in the versioned envelope', () => {
    const savedAt = new Date('2026-11-05T10:00:00.000Z')
    expect(buildBoardFile(scene, 'abc123', savedAt)).toEqual({
      format: BOARD_FORMAT,
      version: BOARD_VERSION,
      savedAt: '2026-11-05T10:00:00.000Z',
      roomId: 'abc123',
      scene,
    })
  })

  it('preserves every element property through JSON', () => {
    const restored = JSON.parse(serializeBoardFile(scene, 'abc123')) as {
      scene: { elements: ExcalidrawElement[] }
    }
    expect(restored.scene.elements).toEqual(scene.elements)
  })

  it('serialises an empty board', () => {
    const restored = JSON.parse(serializeBoardFile(createScene(), 'abc123'))
    expect(restored.scene).toEqual({ elements: [] })
  })
})

describe('defaultFileName', () => {
  it('uses the room id and local date', () => {
    expect(defaultFileName('abc123', new Date(2026, 10, 5))).toBe(
      'whiteboard-abc123-2026-11-05.whiteboard',
    )
  })
})

describe('normalizeFileName', () => {
  const fallback = 'whiteboard-abc-2026-11-05.whiteboard'

  it('appends the board suffix when none is given', () => {
    expect(normalizeFileName('team retro', fallback)).toBe('team retro.whiteboard')
  })

  it('keeps explicit board and JSON suffixes', () => {
    expect(normalizeFileName('team.whiteboard', fallback)).toBe('team.whiteboard')
    expect(normalizeFileName('team.json', fallback)).toBe('team.json')
  })

  it('strips path separators and control characters', () => {
    expect(normalizeFileName('../a\\b:c*?.json', fallback)).toBe('abc.json')
    expect(normalizeFileName('a\u0000b', fallback)).toBe('ab.whiteboard')
  })

  it('falls back when the name is empty or only dots', () => {
    expect(normalizeFileName('   ', fallback)).toBe(fallback)
    expect(normalizeFileName('...', fallback)).toBe(fallback)
    expect(normalizeFileName('/', fallback)).toBe(fallback)
  })
})

describe('fileNameFromSource', () => {
  it('uses the base name of an imported file', () => {
    expect(fileNameFromSource('C:\\boards\\lesson.whiteboard', 'fallback.whiteboard')).toBe(
      'lesson.whiteboard',
    )
    expect(fileNameFromSource('lesson.json', 'fallback.whiteboard')).toBe('lesson.json')
  })
})
