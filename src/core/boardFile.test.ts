import { describe, expect, it } from 'vitest'
import {
  BOARD_FORMAT,
  BOARD_VERSION,
  BoardFileError,
  MAX_ELEMENTS,
  MAX_FILE_BYTES,
  MAX_POINTS,
  buildBoardFile,
  defaultFileName,
  fileNameFromSource,
  normalizeFileName,
  parseBoardFile,
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

describe('parseBoardFile', () => {
  const envelope = (elements: unknown[]) =>
    JSON.stringify({
      format: BOARD_FORMAT,
      version: BOARD_VERSION,
      savedAt: '2026-11-05T00:00:00.000Z',
      roomId: 'abc123',
      scene: { elements },
    })

  it('parses a versioned board and keeps its metadata', () => {
    const parsed = parseBoardFile(envelope([rect, text]))
    expect(parsed).toEqual({
      scene: { elements: [rect, text] },
      roomId: 'abc123',
      savedAt: '2026-11-05T00:00:00.000Z',
      legacy: false,
    })
  })

  it('parses a legacy raw scene', () => {
    const parsed = parseBoardFile(JSON.stringify({ elements: [rect] }))
    expect(parsed.legacy).toBe(true)
    expect(parsed.scene.elements).toEqual([rect])
  })

  it('accepts an empty scene', () => {
    expect(parseBoardFile(envelope([])).scene).toEqual({ elements: [] })
  })

  it('rejects invalid JSON and non-board JSON', () => {
    expect(() => parseBoardFile('not json')).toThrow(BoardFileError)
    expect(() => parseBoardFile('[]')).toThrow(BoardFileError)
    expect(() => parseBoardFile('null')).toThrow(BoardFileError)
  })

  it('rejects a foreign format and unsupported versions', () => {
    expect(() =>
      parseBoardFile(JSON.stringify({ format: 'excalidraw', version: 1, scene: { elements: [] } })),
    ).toThrow("This isn't a Tiny Excalidraw board file.")
    expect(() =>
      parseBoardFile(JSON.stringify({ format: BOARD_FORMAT, version: 2, scene: { elements: [] } })),
    ).toThrow('newer version')
    expect(() =>
      parseBoardFile(JSON.stringify({ format: BOARD_FORMAT, version: 0, scene: { elements: [] } })),
    ).toThrow('unsupported version')
  })

  it('rejects missing or malformed scenes', () => {
    expect(() =>
      parseBoardFile(JSON.stringify({ format: BOARD_FORMAT, version: 1 })),
    ).toThrow(BoardFileError)
    expect(() => parseBoardFile(JSON.stringify({ elements: 'nope' }))).toThrow(BoardFileError)
  })

  it('rejects unknown and image element types with specific reasons', () => {
    expect(() => parseBoardFile(envelope([{ ...rect, type: 'image' }]))).toThrow(
      "contains images",
    )
    expect(() => parseBoardFile(envelope([{ ...rect, type: 'frame' }]))).toThrow(
      "doesn't support",
    )
  })

  it('rejects invalid base properties and non-finite numbers', () => {
    expect(() => parseBoardFile(envelope([{ ...rect, x: Infinity }]))).toThrow(BoardFileError)
    expect(() => parseBoardFile(envelope([{ ...rect, id: '' }]))).toThrow(BoardFileError)
    expect(() => parseBoardFile(envelope([{ ...rect, background: 1 }]))).toThrow(BoardFileError)
  })

  it('rejects malformed pen, shape, arrow, and text geometry', () => {
    expect(() =>
      parseBoardFile(envelope([{ ...rect, type: 'pen', points: [{ x: 0, y: NaN }] }])),
    ).toThrow('stroke with invalid points')
    expect(() =>
      parseBoardFile(envelope([{ ...rect, width: 'wide' }])),
    ).toThrow('shape with invalid size')
    expect(() =>
      parseBoardFile(envelope([{ ...rect, type: 'arrow', points: [{ x: 0, y: 0 }] }])),
    ).toThrow('arrow with invalid points')
    expect(() =>
      parseBoardFile(envelope([{ ...text, fontSize: 0 }])),
    ).toThrow('text with invalid properties')
  })

  it('rejects duplicate ids', () => {
    expect(() => parseBoardFile(envelope([rect, { ...text, id: rect.id }]))).toThrow(
      'same id',
    )
  })

  it('rejects too many elements, points, and bytes', () => {
    const tooManyElements = Array.from({ length: MAX_ELEMENTS + 1 }, (_, i) => ({
      ...rect,
      id: `rect-${i}`,
    }))
    expect(() => parseBoardFile(envelope(tooManyElements))).toThrow('too many elements')
    expect(() =>
      parseBoardFile(
        envelope([
          {
            ...rect,
            type: 'pen',
            points: Array.from({ length: MAX_POINTS + 1 }, () => ({ x: 0, y: 0 })),
          },
        ]),
      ),
    ).toThrow('too many points')
    expect(() => parseBoardFile('x'.repeat(MAX_FILE_BYTES + 1))).toThrow('too large')
  })
})
