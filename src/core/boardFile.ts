import type { Scene } from './scene'
import type { ElementType, ExcalidrawElement, Point } from './types'

export const BOARD_FORMAT = 'tiny-excalidraw'
export const BOARD_VERSION = 1
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_ELEMENTS = 10_000
export const MAX_POINTS = 50_000
export const MAX_TEXT_LENGTH = 100_000

const ELEMENT_TYPES: ElementType[] = ['pen', 'rectangle', 'ellipse', 'arrow', 'text']

export class BoardFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardFileError'
  }
}

export interface ParsedBoardFile {
  scene: Scene
  roomId?: string
  savedAt?: string
  /** True for the older raw `{ elements }` shape. */
  legacy: boolean
}

export interface BoardFile {
  format: typeof BOARD_FORMAT
  version: typeof BOARD_VERSION
  savedAt: string
  roomId: string
  scene: Scene
}

/** Builds the versioned envelope written to a `.whiteboard` file. */
export function buildBoardFile(
  scene: Scene,
  roomId: string,
  savedAt: Date = new Date(),
): BoardFile {
  return {
    format: BOARD_FORMAT,
    version: BOARD_VERSION,
    savedAt: savedAt.toISOString(),
    roomId,
    scene,
  }
}

export function serializeBoardFile(
  scene: Scene,
  roomId: string,
  savedAt: Date = new Date(),
): string {
  return JSON.stringify(buildBoardFile(scene, roomId, savedAt))
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** `whiteboard-<roomId>-<YYYY-MM-DD>.whiteboard`, using the local date. */
export function defaultFileName(roomId: string, date: Date = new Date()): string {
  const day = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  return `whiteboard-${roomId}-${day}.whiteboard`
}

const UNSAFE_FILENAME = /[<>:"/\\|?*\u0000-\u001f]/g
const EXPLICIT_SUFFIX = /\.(whiteboard|json)$/i

/**
 * Keeps an explicit `.whiteboard`/`.json` suffix, otherwise appends
 * `.whiteboard`. Unsafe path and control characters are removed, and a name
 * that collapses to nothing uses the fallback.
 */
export function normalizeFileName(name: string, fallback: string): string {
  const stripped = name
    .replace(UNSAFE_FILENAME, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
  if (!stripped) return fallback
  if (EXPLICIT_SUFFIX.test(stripped)) return stripped
  return `${stripped}.whiteboard`
}

/** Derives a safe board filename from an imported file's name. */
export function fileNameFromSource(source: string, fallback: string): string {
  const base = source.split(/[\\/]/).pop() ?? source
  return normalizeFileName(base, fallback)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPoint(value: unknown): value is Point {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
}

function readElements(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new BoardFileError('This board file is missing its drawing.')
  if (value.length > MAX_ELEMENTS) {
    throw new BoardFileError(`This board has too many elements (max ${MAX_ELEMENTS.toLocaleString()}).`)
  }
  return value
}

function validateElement(value: unknown): ExcalidrawElement {
  if (!isRecord(value)) throw new BoardFileError('This board contains an invalid element.')
  const type = value.type
  if (typeof type !== 'string' || !ELEMENT_TYPES.includes(type as ElementType)) {
    if (type === 'image') {
      throw new BoardFileError("This board contains images, which this app can't open.")
    }
    throw new BoardFileError("This board contains an element type this app doesn't support.")
  }
  if (
    typeof value.id !== 'string' ||
    !value.id ||
    value.id.length > 200 ||
    !isFiniteNumber(value.x) ||
    !isFiniteNumber(value.y) ||
    typeof value.strokeColor !== 'string' ||
    value.strokeColor.length > 100 ||
    typeof value.background !== 'string' ||
    value.background.length > 100 ||
    !isFiniteNumber(value.strokeWidth)
  ) {
    throw new BoardFileError('This board contains an element with invalid properties.')
  }

  switch (type as ElementType) {
    case 'pen': {
      if (!Array.isArray(value.points) || value.points.length < 1) {
        throw new BoardFileError('This board contains a drawing stroke with invalid points.')
      }
      if (value.points.length > MAX_POINTS) {
        throw new BoardFileError(
          `A drawing stroke has too many points (max ${MAX_POINTS.toLocaleString()}).`,
        )
      }
      if (!value.points.every(isPoint)) {
        throw new BoardFileError('This board contains a drawing stroke with invalid points.')
      }
      break
    }
    case 'rectangle':
    case 'ellipse':
      if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) {
        throw new BoardFileError('This board contains a shape with invalid size.')
      }
      break
    case 'arrow':
      if (
        !Array.isArray(value.points) ||
        value.points.length !== 2 ||
        !value.points.every(isPoint)
      ) {
        throw new BoardFileError('This board contains an arrow with invalid points.')
      }
      break
    case 'text':
      if (
        typeof value.text !== 'string' ||
        value.text.length > MAX_TEXT_LENGTH ||
        !isFiniteNumber(value.fontSize) ||
        value.fontSize <= 0
      ) {
        throw new BoardFileError('This board contains text with invalid properties.')
      }
      break
  }

  return value as unknown as ExcalidrawElement
}

/** Validates a whole element list; any invalid element rejects the scene. */
export function parseSceneElements(value: unknown): Scene {
  const seen = new Set<string>()
  const validated = readElements(value).map((element) => {
    const result = validateElement(element)
    if (seen.has(result.id)) {
      throw new BoardFileError('This board contains two elements with the same id.')
    }
    seen.add(result.id)
    return result
  })
  return { elements: validated }
}

/**
 * Parses a `.whiteboard` envelope or a legacy raw `{ elements }` file.
 * Throws a BoardFileError with a user-facing reason for any invalid input.
 */
export function parseBoardFile(raw: string): ParsedBoardFile {
  if (new TextEncoder().encode(raw).byteLength > MAX_FILE_BYTES) {
    throw new BoardFileError('This file is too large (max 5 MB).')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new BoardFileError("This isn't a Tiny Excalidraw board file.")
  }
  if (!isRecord(parsed)) throw new BoardFileError("This isn't a Tiny Excalidraw board file.")

  if (parsed.format !== undefined) {
    if (parsed.format !== BOARD_FORMAT) {
      throw new BoardFileError("This isn't a Tiny Excalidraw board file.")
    }
    if (parsed.version !== BOARD_VERSION) {
      if (typeof parsed.version === 'number' && parsed.version > BOARD_VERSION) {
        throw new BoardFileError('This board was created by a newer version of the app.')
      }
      throw new BoardFileError('This board file uses an unsupported version.')
    }
    if (!isRecord(parsed.scene)) {
      throw new BoardFileError('This board file is missing its drawing.')
    }
    const roomId =
      typeof parsed.roomId === 'string' && parsed.roomId.length <= 200
        ? parsed.roomId
        : undefined
    const savedAt = typeof parsed.savedAt === 'string' ? parsed.savedAt : undefined
    return {
      scene: parseSceneElements(parsed.scene.elements),
      roomId,
      savedAt,
      legacy: false,
    }
  }

  return { scene: parseSceneElements(parsed.elements), legacy: true }
}
